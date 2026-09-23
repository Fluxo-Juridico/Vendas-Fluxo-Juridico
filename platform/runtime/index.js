import postgres from "postgres";
import { createHmac, timingSafeEqual } from "node:crypto";

let sqlClient;

const DATABASE_SEARCH_PATH = "public,billing,sales,admin,private";
function withDatabaseSearchPath(connectionString) {
  try {
    const url = new URL(String(connectionString || ""));
    const existing = String(url.searchParams.get("options") || "").trim();
    const option = `-c search_path=${DATABASE_SEARCH_PATH}`;
    url.searchParams.set("options", existing ? `${existing} ${option}` : option);
    return url.toString();
  } catch {
    return connectionString;
  }
}

function readEnv(key) {
  const normalized = String(key || "").replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  const raw = process.env[key] ?? process.env[normalized];
  if (raw === undefined) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function getSql() {
  if (sqlClient) return sqlClient;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  sqlClient = postgres(withDatabaseSearchPath(url), {
    max: 3,
    ssl: "require",
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10
  });
  return sqlClient;
}

export const db = {
  async query(text, params = []) {
    const rows = await getSql().unsafe(text, params);
    return { rows: Array.from(rows), rowCount: rows.count ?? rows.length };
  }
};

export const config = {
  async get(key) {
    return readEnv(key);
  }
};

export const webhooks = {
  async verifyHmac({ raw, signature, secret, algorithm = "sha256", encoding = "hex", timestamp, tolerance }) {
    if (!secret || !signature) return false;
    if (timestamp && tolerance) {
      const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
      if (!Number.isFinite(age) || age > Number(tolerance)) return false;
    }
    const expected = createHmac(algorithm, String(secret)).update(String(raw ?? "")).digest(encoding);
    const left = Buffer.from(String(expected));
    const right = Buffer.from(String(signature));
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
};
