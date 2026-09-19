import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";

const errors = [];
const warnings = [];
const exists = async p => fs.access(path.resolve(p)).then(() => true).catch(() => false);

for (const file of ["package.json", ".env.example", "compat/hatchable/package.json", "compat/hatchable/index.js", "lib/http.js", "supabase/migrations/20260919_sales_billing_schema.sql", "supabase/migrations/20260919_sales_007_entitlement_snapshot.sql", "scripts/predeploy-check.mjs"]) {
  if (!await exists(file)) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const hatchableDep = pkg?.dependencies?.hatchable;
if (typeof hatchableDep !== "string" || !hatchableDep.startsWith("file:")) {
  errors.push("A dependência hatchable deve apontar apenas para a camada local de compatibilidade (file:...).");
}

const envExample = await fs.readFile(".env.example", "utf8").catch(() => "");
for (const key of [
  "DATABASE_URL",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "BILLING_BRIDGE_SECRET",
  "CRON_SECRET",
  "SAAS_BASE_URL"
]) {
  if (!new RegExp(`^${key}=`, "m").test(envExample)) errors.push(`.env.example não documenta ${key}`);
}

async function walk(root) {
  if (!await exists(root)) return [];
  const out = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const liveFiles = [];
for (const root of ["api", "compat", "lib", "public", "src"]) liveFiles.push(...await walk(root));
if (await exists("site.js")) liveFiles.push("site.js");

const secretPatterns = [
  /APP_USR-[0-9A-Za-z_-]{20,}/,
  /TEST-[0-9A-Za-z_-]{20,}/,
  /sb_secret_[0-9A-Za-z_-]{12,}/,
  /BILLING_BRIDGE_SECRET\s*=\s*[^\s#]+/
];

for (const file of liveFiles) {
  if (!/\.(?:js|mjs|cjs|ts|tsx|jsx|html|json|css)$/i.test(file)) continue;
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (secretPatterns.some(re => re.test(content))) errors.push(`Possível segredo versionado em ${file}`);
  if (content.includes(".hatchable.site")) errors.push(`URL externa do Hatchable encontrada em código ativo: ${file}`);
}

for (const file of liveFiles) {
  if (!/\.(?:js|mjs|cjs)$/i.test(file)) continue;
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    errors.push(`Falha de sintaxe em ${file}: ${String(checked.stderr||checked.stdout||"").trim().slice(0,500)}`);
  }
}

if (!liveFiles.some(file => /api[\\/]checkout/i.test(file))) warnings.push("Rota de checkout não localizada automaticamente.");
if (!liveFiles.some(file => /webhook/i.test(file))) warnings.push("Webhook de pagamento não localizado automaticamente.");

const billingSource = await fs.readFile("lib/billing.js", "utf8").catch(() => "");
const checkoutSource = await fs.readFile("api/checkout.js", "utf8").catch(() => "");
const exportSource = await fs.readFile("api/internal/billing-export.js", "utf8").catch(() => "");
for (const [label,source,tokens] of [
  ["billing",billingSource,["billing-v1","seat_limit","storage_limit_gb","contractVersion"]],
  ["checkout",checkoutSource,["BILLING_CONTRACT_VERSION","seat_limit","storage_limit_gb"]],
  ["billing-export",exportSource,["billing-v1","seat_limit","storage_limit_gb","contractVersion"]]
]) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`Contrato de billing incompleto em ${label}: falta ${token}`);
  }
}

const apiFiles = (await walk("api")).filter(file => /\.js$/i.test(file));
for (const file of apiFiles) {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (
    content.includes("export const methods=") &&
    !content.includes("allowMethods(req,res,methods)") &&
    !content.includes("req.method")
  ) {
    errors.push(`Rota com methods sem enforcement HTTP: ${file}`);
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, warnings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  app: "fluxo-juridico-vendas",
  localHatchableCompat: true,
  liveFiles: liveFiles.length,
  warnings
}, null, 2));
