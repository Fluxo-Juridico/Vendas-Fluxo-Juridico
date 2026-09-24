import { existsSync, readdirSync } from "node:fs";

const errors = [];
const FUNCTION_BUDGET = 10;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) errors.push(`Missing environment variable: ${name}`);
  return value;
}
function httpsUrl(name, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${name} must use https://`);
  } catch {
    errors.push(`${name} must be a valid URL`);
  }
}
function positive(name, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) errors.push(`${name} must be a positive number`);
}

const databaseUrl = String(
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || ""
).trim();
if (!databaseUrl) errors.push("Missing database connection: DATABASE_URL (or POSTGRES_URL).");
const mpToken = required("MERCADO_PAGO_ACCESS_TOKEN");
const webhookSecret = required("MERCADO_PAGO_WEBHOOK_SECRET");
const bridgeSecret = required("BILLING_BRIDGE_SECRET");
const cronSecret = required("CRON_SECRET");
const saasBaseUrl = required("SAAS_BASE_URL");

if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl))
  errors.push("Database connection must be a PostgreSQL URL.");
if (mpToken && mpToken.length < 20) errors.push("MERCADO_PAGO_ACCESS_TOKEN looks too short.");
if (webhookSecret && webhookSecret.length < 16)
  errors.push("MERCADO_PAGO_WEBHOOK_SECRET looks too short.");
if (bridgeSecret && bridgeSecret.length < 24)
  errors.push("BILLING_BRIDGE_SECRET must contain at least 24 characters.");
if (cronSecret && cronSecret.length < 24)
  errors.push("CRON_SECRET must contain at least 24 characters.");
if (saasBaseUrl) httpsUrl("SAAS_BASE_URL", saasBaseUrl);

for (const plan of ["SOLO", "ESSENCIAL", "PROFISSIONAL", "PREMIUM"]) {
  positive(
    `PLAN_${plan}_PRICE`,
    process.env[`PLAN_${plan}_PRICE`] ||
      { SOLO: 99, ESSENCIAL: 197, PROFISSIONAL: 297, PREMIUM: 497 }[plan]
  );
  positive(
    `PLAN_${plan}_SEATS`,
    process.env[`PLAN_${plan}_SEATS`] ||
      { SOLO: 2, ESSENCIAL: 3, PROFISSIONAL: 10, PREMIUM: 20 }[plan]
  );
  positive(
    `PLAN_${plan}_STORAGE_GB`,
    process.env[`PLAN_${plan}_STORAGE_GB`] ||
      { SOLO: 5, ESSENCIAL: 15, PROFISSIONAL: 25, PREMIUM: 100 }[plan]
  );
}

const apiRoot = new URL("../api/", import.meta.url);
const generatedFunctions = existsSync(apiRoot)
  ? readdirSync(apiRoot, { recursive: true })
      .map((entry) => String(entry).replaceAll("\\", "/"))
      .filter((entry) => entry.endsWith(".js"))
  : [];

if (generatedFunctions.length > FUNCTION_BUDGET) {
  errors.push(
    `Vercel Function engineering budget exceeded: ${generatedFunctions.length}/${FUNCTION_BUDGET}. Keep at least two slots below the Hobby limit.`
  );
}

if (!generatedFunctions.includes("internal/[route].js")) {
  errors.push("Consolidated internal Vercel Function api/internal/[route].js is missing.");
}

for (const legacy of [
  "internal/billing-export.js",
  "internal/crm-export.js",
  "internal/crm-update.js",
  "internal/subscription-management.js"
]) {
  if (generatedFunctions.includes(legacy)) {
    errors.push(`Legacy internal wrapper must remain consolidated: api/${legacy}`);
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, app: "fluxo-juridico-vendas", errors }, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      ok: true,
      app: "fluxo-juridico-vendas",
      billingContract: "billing-v1",
      vercelFunctions: generatedFunctions.length,
      functionBudget: FUNCTION_BUDGET
    },
    null,
    2
  )
);
