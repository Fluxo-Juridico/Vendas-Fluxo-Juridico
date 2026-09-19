import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";

const errors = [];
const warnings = [];
const exists = async p => fs.access(path.resolve(p)).then(() => true).catch(() => false);

const requiredFiles = [
  "package.json",
  ".env.example",
  "platform/runtime/package.json",
  "platform/runtime/index.js",
  "server/lib/http.js",
  "server/lib/billing.js",
  "scripts/generate-api-wrappers.mjs",
  "scripts/predeploy-check.mjs",
  "supabase/migrations/20260919_sales_billing_schema.sql",
  "supabase/migrations/20260919_sales_007_entitlement_snapshot.sql",
  "vercel.json"
];

for (const file of requiredFiles) {
  if (!await exists(file)) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

if (await exists("lib")) {
  errors.push("Código backend ativo não deve permanecer em lib/; use server/lib.");
}

const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const runtimeDep = pkg?.dependencies?.["@fluxo-juridico/runtime"];
if (runtimeDep !== "file:./platform/runtime") {
  errors.push("A dependência @fluxo-juridico/runtime deve apontar para file:./platform/runtime.");
}
if (pkg?.scripts?.build !== "node scripts/generate-api-wrappers.mjs") {
  errors.push("O build deve gerar somente os wrappers de api/ a partir de server/api.");
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

const serverApiFiles = (await walk("server/api")).filter(file => /\.js$/i.test(file));
const wrapperFiles = (await walk("api")).filter(file => /\.js$/i.test(file));
if (!serverApiFiles.length) errors.push("Nenhuma rota fonte encontrada em server/api.");
if (serverApiFiles.length !== wrapperFiles.length) {
  errors.push(`Quantidade de wrappers em api/ (${wrapperFiles.length}) difere das rotas fonte em server/api (${serverApiFiles.length}).`);
}

for (const file of wrapperFiles) {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (!content.includes("server/api/")) errors.push(`Wrapper fora do padrão server/api: ${file}`);
}

const activeFiles = [
  ...await walk("api"),
  ...await walk("server"),
  ...await walk("platform"),
  ...await walk("scripts")
];
for (const file of ["index.html","site.js","site.css","motion.css"]) if (await exists(file)) activeFiles.push(file);

const deprecatedVendorToken = ["hat","chable"].join("");
const secretPatterns = [
  /APP_USR-[0-9A-Za-z_-]{20,}/,
  /TEST-[0-9A-Za-z_-]{20,}/,
  /sb_secret_[0-9A-Za-z_-]{12,}/,
  /BILLING_BRIDGE_SECRET\s*=\s*[^\s#]+/
];

for (const file of activeFiles) {
  if (!/\.(?:js|mjs|cjs|ts|tsx|jsx|html|json|css)$/i.test(file)) continue;
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (secretPatterns.some(re => re.test(content))) errors.push(`Possível segredo versionado em ${file}`);
  if (file.toLowerCase().includes(deprecatedVendorToken) || content.toLowerCase().includes(deprecatedVendorToken)) {
    errors.push(`Nomenclatura do provedor antigo encontrada em código ativo: ${file}`);
  }
}

for (const file of activeFiles) {
  if (!/\.(?:js|mjs|cjs)$/i.test(file)) continue;
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    errors.push(`Falha de sintaxe em ${file}: ${String(checked.stderr||checked.stdout||"").trim().slice(0,500)}`);
  }
}

const billingSource = await fs.readFile("server/lib/billing.js", "utf8").catch(() => "");
const checkoutSource = await fs.readFile("server/api/checkout.js", "utf8").catch(() => "");
const exportSource = await fs.readFile("server/api/internal/billing-export.js", "utf8").catch(() => "");
for (const [label,source,tokens] of [
  ["billing",billingSource,["billing-v1","seat_limit","storage_limit_gb","contractVersion"]],
  ["checkout",checkoutSource,["BILLING_CONTRACT_VERSION","seat_limit","storage_limit_gb"]],
  ["billing-export",exportSource,["billing-v1","seat_limit","storage_limit_gb","contractVersion"]]
]) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`Contrato de billing incompleto em ${label}: falta ${token}`);
  }
}

for (const file of serverApiFiles) {
  const content = await fs.readFile(file, "utf8").catch(() => "");
  if (
    content.includes("export const methods=") &&
    !content.includes("allowMethods(req,res,methods)") &&
    !content.includes("req.method")
  ) {
    errors.push(`Rota com methods sem enforcement HTTP: ${file}`);
  }
}

if (!serverApiFiles.some(file => /checkout/i.test(file))) warnings.push("Rota de checkout não localizada automaticamente.");
if (!serverApiFiles.some(file => /webhook/i.test(file))) warnings.push("Webhook de pagamento não localizado automaticamente.");

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, warnings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  app: "fluxo-juridico-vendas",
  architecture: "server-source-plus-api-wrappers",
  localRuntimeAdapter: true,
  serverApiFiles: serverApiFiles.length,
  warnings
}, null, 2));
