import { createHash } from "node:crypto";
import { db } from "@fluxo-juridico/runtime";
import { apiError } from "./http.js";

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || String(req.headers?.["x-real-ip"] || "").trim() || "unknown";
}

function fingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function rateLimitSubject(req, extra = "") {
  return fingerprint([clientIp(req), String(extra || "").trim().toLowerCase()].join("|"));
}

export async function enforcePublicRateLimit(
  req,
  res,
  { scope, limit, windowSeconds, subject = "" } = {}
) {
  const safeScope = String(scope || "").trim().slice(0, 80);
  const max = Math.max(1, Math.min(10000, Number(limit) || 1));
  const window = Math.max(1, Math.min(86400, Number(windowSeconds) || 60));
  const safeSubject = rateLimitSubject(req, subject).slice(0, 220);

  if (!safeScope) {
    apiError(req, res, 500, "Limite de requisição inválido.", "rate_limit_configuration");
    return false;
  }

  const { rows } = await db.query(
    "INSERT INTO office_rate_limits (scope,subject,window_started_at,request_count,updated_at) VALUES ($1,$2,now(),1,now()) ON CONFLICT (scope,subject) DO UPDATE SET request_count=CASE WHEN office_rate_limits.window_started_at<=now()-($3::int*interval '1 second') THEN 1 ELSE office_rate_limits.request_count+1 END,window_started_at=CASE WHEN office_rate_limits.window_started_at<=now()-($3::int*interval '1 second') THEN now() ELSE office_rate_limits.window_started_at END,updated_at=now() RETURNING request_count,window_started_at",
    [safeScope, safeSubject, window]
  );

  const count = Number(rows[0]?.request_count) || 0;
  const startedAt = new Date(rows[0]?.window_started_at || Date.now()).getTime();
  const retryAfter = Math.max(1, Math.ceil((startedAt + window * 1000 - Date.now()) / 1000));

  if (count > max) {
    res.setHeader("Retry-After", String(retryAfter));
    apiError(
      req,
      res,
      429,
      "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.",
      "rate_limited",
      { retryAfter }
    );
    return false;
  }

  return true;
}
