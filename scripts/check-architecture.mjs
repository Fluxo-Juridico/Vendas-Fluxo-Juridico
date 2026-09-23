import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {PLAN_CATALOG as PLAN_DEFAULTS,BILLING_CONTRACT_VERSION,BILLING_CONTRACT_FINGERPRINT,contractDescriptor} from "../contracts/billing-v1.js";

const errors = [];
const warnings = [];
const exists = async p => fs.access(path.resolve(p)).then(() => true).catch(() => false);

const requiredFiles = [
  "package.json",
  ".env.example",
  "platform/runtime/package.json",
  "platform/runtime/index.js",
  "contracts/billing-v1.js",
  "contracts/subscription-management-v1.js",
  "server/lib/http.js",
  "tests/http-contract.test.mjs",
  "server/lib/billing.js",
  "scripts/generate-api-wrappers.mjs",
  "scripts/predeploy-check.mjs",
  "supabase/README.md",
  "docs/maintenance.md",
  "sales-theme.css",
  "vercel.json"
];

for (const file of requiredFiles) {
  if (!await exists(file)) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

for (const legacyPath of ["archive", ".vercel-redeploy", "sales-refinement.css", "MIGRATION_STATUS.md"]) {
  if (await exists(legacyPath)) errors.push(`Artefato legado não pode permanecer no repositório ativo: ${legacyPath}`);
}
if (await exists("supabase/migrations")) errors.push("O Vendas não deve possuir migrations SQL; o SaaS principal é o único dono do schema.");

if (await exists("lib")) {
  errors.push("Código backend ativo não deve permanecer em lib/; use server/lib.");
}

const gitignoreEntries = (await fs.readFile(".gitignore","utf8").catch(()=> "")).split(/\r?\n/);
if (gitignoreEntries.includes("api/")) errors.push("api/ contém adaptadores versionados exigidos pela Vercel e não pode estar ignorado.");
if (!gitignoreEntries.includes("public/")) errors.push("public/ continua sendo artefato de build e deve permanecer ignorado.");
if (!await exists("api")) errors.push("Diretório de adaptadores versionados ausente: api/");

const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
if (pkg?.scripts?.verify !== "npm test && npm run check") errors.push("package.json deve expor verify como testes + auditoria estrutural.");
if (JSON.stringify(pkg.files)!==JSON.stringify(["contracts"])) errors.push("Pacote compartilhado deve publicar somente contracts/.");
const expectedContractExports={"./billing-v1":"./contracts/billing-v1.js","./subscription-management-v1":"./contracts/subscription-management-v1.js"};
if (JSON.stringify(pkg.exports)!==JSON.stringify(expectedContractExports)) errors.push("package.json não expõe os exports canônicos de contratos.");
const runtimeDep = pkg?.dependencies?.["@fluxo-juridico/runtime"];
if (runtimeDep !== "file:./platform/runtime") {
  errors.push("A dependência @fluxo-juridico/runtime deve apontar para file:./platform/runtime.");
}
if (pkg?.scripts?.build !== "node scripts/generate-api-wrappers.mjs") {
  errors.push("O build deve gerar somente os wrappers de api/ a partir de server/api.");
}

const vercelConfig = JSON.parse(await fs.readFile("vercel.json","utf8").catch(()=> "{}"));
if (vercelConfig?.git?.deploymentEnabled?.["*"] !== false || vercelConfig?.git?.deploymentEnabled?.main !== true) {
  errors.push("Vercel deve publicar automaticamente somente a branch main.");
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
if (!serverApiFiles.length) errors.push("Nenhuma rota fonte encontrada em server/api.");

const maintenanceBudgets = {
  "index.html": 35000,
  "site.js": 25000,
  "site.css": 60000,
  "sales-theme.css": 40000
};
for (const [file,maxBytes] of Object.entries(maintenanceBudgets)) {
  const info = await fs.stat(file).catch(() => null);
  if (info && info.size > maxBytes) errors.push(`Arquivo acima do orçamento de manutenção: ${file} (${info.size} > ${maxBytes} bytes)`);
}

const activeFiles = [
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

const httpSource = await fs.readFile("server/lib/http.js", "utf8").catch(() => "");
for (const token of ["prepareHttp","wrapHandler","X-Request-Id","api_unhandled_error","internal_error"]) {
  if (!httpSource.includes(token)) errors.push(`Borda HTTP canônica incompleta: falta ${token}`);
}
const wrapperSource = await fs.readFile("scripts/generate-api-wrappers.mjs", "utf8").catch(() => "");
for (const token of ["wrapHandler","httpModule","guarded API wrapper"]) {
  if (!wrapperSource.includes(token)) errors.push(`Gerador de wrappers sem proteção HTTP: falta ${token}`);
}

const expectedPlans = {
  Solo:{price:99,seats:2,storageGb:5},
  Essencial:{price:197,seats:3,storageGb:15},
  Profissional:{price:297,seats:10,storageGb:25},
  Premium:{price:497,seats:20,storageGb:100}
};
if (BILLING_CONTRACT_VERSION!=="billing-v1") errors.push("Versão canônica de billing divergente no Vendas.");
if (createHash("sha256").update(contractDescriptor()).digest("hex")!==BILLING_CONTRACT_FINGERPRINT) errors.push("Fingerprint billing-v1 divergente no Vendas.");
for (const [name,expected] of Object.entries(expectedPlans)) {
  const actual=PLAN_DEFAULTS[name];
  if (!actual) errors.push(`Plano ausente no Vendas: ${name}`);
  else for (const key of ["price","seats","storageGb"]) {
    if (Number(actual[key])!==expected[key]) errors.push(`Plano ${name} divergente no Vendas: ${key}`);
  }
}

const billingSource = await fs.readFile("server/lib/billing.js", "utf8").catch(() => "");
const checkoutSource = await fs.readFile("server/api/checkout.js", "utf8").catch(() => "");
const exportSource = await fs.readFile("server/api/internal/billing-export.js", "utf8").catch(() => "");
for (const [label,source,tokens] of [
  ["billing",billingSource,["BILLING_CONTRACT_FINGERPRINT","seat_limit","storage_limit_gb","contractVersion","canonicalBillingSignature"]],
  ["checkout",checkoutSource,["BILLING_CONTRACT_VERSION","BILLING_CONTRACT_FINGERPRINT","seat_limit","storage_limit_gb","reused:true","15 minutes"]],
  ["billing-export",exportSource,["BILLING_CONTRACT_VERSION","BILLING_CONTRACT_FINGERPRINT","seat_limit","storage_limit_gb","contractVersion"]]
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
