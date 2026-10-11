import { readFile } from "node:fs/promises";
import { db, config } from "@fluxo-juridico/runtime";

const files = {
  purchase: new URL("../../docs/email-templates/purchase.html", import.meta.url),
  access: new URL("../../docs/email-templates/access.html", import.meta.url)
};
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
const subjects = {
  purchase: "Compra aprovada | Fluxo Jurídico",
  access: "Acesso liberado | Fluxo Jurídico"
};
export function officialUrl(base, path) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("email_url_invalid");
  return new URL(path, url.origin).toString();
}
export function renderEmail(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => {
    if (values[key] === undefined) throw new Error("email_template_value_missing");
    return escape(values[key]);
  });
}
export async function emailSettings() {
  const enabled = String((await config.get("EMAIL_DELIVERY_ENABLED")) || "").trim() === "true";
  if (!enabled) return { enabled: false, ready: false };
  const key = String((await config.get("RESEND_API_KEY")) || "").trim();
  const from = String((await config.get("EMAIL_FROM")) || "").trim();
  const salesBase = String(
    (await config.get("SALES_BASE_URL")) || "https://vendas-lilac.vercel.app"
  ).trim();
  const saasBase = String(
    (await config.get("SAAS_BASE_URL")) || "https://fluxo-juridico-topaz.vercel.app"
  ).trim();
  const ready = Boolean(key && /^[^\r\n]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(from));
  return { enabled, ready, key, from, salesBase, saasBase };
}
export async function enqueueOrderEmail(order, kind) {
  if (!files[kind] || order?.payment_status !== "approved") return false;
  if (kind === "access" && order.provisioning_status !== "activated") return false;
  const settings = await emailSettings();
  if (!settings.enabled) return false;
  const values = {
    customer_name: order.buyer_name || "cliente",
    plan_name: order.plan,
    amount_formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: order.currency || "BRL"
    }).format(Number(order.amount_cents || 0) / 100),
    order_reference: order.id,
    order_status_url: officialUrl(
      settings.salesBase,
      "/?checkout=return&order=" + encodeURIComponent(order.id)
    ),
    login_url: officialUrl(settings.saasBase, "/login")
  };
  const html = renderEmail(await readFile(files[kind], "utf8"), values);
  await db.query(
    "INSERT INTO billing.email_outbox (order_id,kind,recipient,subject,html) VALUES ($1::uuid,$2,$3,$4,$5) ON CONFLICT (order_id,kind) DO NOTHING",
    [order.id, kind, order.buyer_email, subjects[kind], html]
  );
  return true;
}
export async function deliverEmail(row, settings, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + settings.key,
      "Content-Type": "application/json",
      "Idempotency-Key": "fluxo/" + row.id
    },
    body: JSON.stringify({
      from: row.sender || settings.from,
      to: [row.recipient],
      subject: row.subject,
      html: row.html
    }),
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id)
    throw Object.assign(new Error("email_provider_rejected"), { status: response.status });
  return String(result.id);
}
export async function drainEmailOutbox({ limit = 10 } = {}) {
  const settings = await emailSettings();
  if (!settings.ready) return { configured: false, accepted: 0, failed: 0 };
  // An uncertain send outside the provider's 24-hour deduplication window
  // needs review; automatically creating a new attempt could duplicate it.
  await db.query(
    "UPDATE billing.email_outbox SET state='review',last_error='idempotency_window_expired',updated_at=now() WHERE state IN ('sending','retry') AND first_attempt_at<now()-interval '23 hours'"
  );
  const { rows } = await db.query(
    "WITH candidates AS (SELECT id FROM billing.email_outbox WHERE (state IN ('waiting','retry') OR (state='sending' AND lease_until<now())) AND (first_attempt_at IS NULL OR first_attempt_at>=now()-interval '23 hours') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE billing.email_outbox e SET state='sending',sender=COALESCE(sender,$2),lease_until=now()+interval '2 minutes',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,now()),updated_at=now() FROM candidates c WHERE e.id=c.id RETURNING e.*",
    [Math.max(1, Math.min(20, Number(limit) || 10)), settings.from]
  );
  let accepted = 0,
    failed = 0;
  for (const row of rows) {
    try {
      const current = (
        await db.query(
          "SELECT so.payment_status,so.provisioning_status,pa.status AS access_status,pa.source_order_id FROM sales.sales_orders so LEFT JOIN billing.platform_accounts pa ON lower(pa.email)=lower(so.buyer_email) WHERE so.id=$1",
          [row.order_id]
        )
      ).rows[0];
      if (
        current?.payment_status !== "approved" ||
        (row.kind === "access" &&
          (current.provisioning_status !== "activated" ||
            current.access_status !== "active" ||
            String(current.source_order_id) !== String(row.order_id)))
      ) {
        await db.query(
          "UPDATE billing.email_outbox SET state='cancelled',last_error='order_or_access_changed',lease_until=NULL,updated_at=now() WHERE id=$1",
          [row.id]
        );
        continue;
      }
      const providerId = await deliverEmail(row, settings);
      await db.query(
        "UPDATE billing.email_outbox SET state='accepted',provider_id=$2,accepted_at=now(),lease_until=NULL,last_error='',updated_at=now() WHERE id=$1",
        [row.id, providerId]
      );
      accepted++;
    } catch (error) {
      const state = [400, 401, 403, 404, 422].includes(Number(error.status)) ? "review" : "retry";
      await db.query(
        "UPDATE billing.email_outbox SET state=$2,last_error=$3,lease_until=NULL,updated_at=now() WHERE id=$1",
        [
          row.id,
          state,
          error.status ? "provider_http_" + error.status : "provider_or_persistence_unavailable"
        ]
      );
      failed++;
    }
  }
  return { configured: true, accepted, failed };
}
export async function notifyOrder(order, kind) {
  try {
    await enqueueOrderEmail(order, kind);
    await drainEmailOutbox();
  } catch {
    console.warn(
      JSON.stringify({
        event: "transactional_email_pending",
        orderId: String(order?.id || ""),
        kind
      })
    );
  }
}
