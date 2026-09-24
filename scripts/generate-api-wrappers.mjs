import fs from "node:fs/promises";
import path from "node:path";

const serverRoot = path.resolve("server/api");
const targetRoot = path.resolve("api");
const publicRoot = path.resolve("public");
const httpModule = path.resolve("server/lib/http.js");
const publicFiles = [
  "index.html",
  "site.css",
  "motion.css",
  "sales-theme.css",
  "site.js",
  "termos.html",
  "privacidade.html"
];

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function relativeImport(fromFile, sourceFile) {
  return "./" + path.relative(path.dirname(fromFile), sourceFile).replaceAll(path.sep, "/");
}

const files = (await walk(serverRoot).catch(() => [])).sort();
if (!files.length) throw new Error("Nenhuma rota fonte encontrada em server/api.");

const internalFiles = files.filter((file) => {
  const relative = path.relative(serverRoot, file);
  return relative.split(path.sep)[0] === "internal";
});
const directFiles = files.filter((file) => !internalFiles.includes(file));

await fs.rm(targetRoot, { recursive: true, force: true });
await fs.rm(publicRoot, { recursive: true, force: true });
await fs.mkdir(publicRoot, { recursive: true });

for (const file of publicFiles) {
  await fs.copyFile(path.resolve(file), path.join(publicRoot, file));
}

for (const source of directFiles) {
  const relative = path.relative(serverRoot, source);
  const target = path.join(targetRoot, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });

  const importPath = relativeImport(target, source);
  const httpImportPath = relativeImport(target, httpModule);
  const wrapper =
    `import handler from ${JSON.stringify(importPath)};\n` +
    `import {wrapHandler} from ${JSON.stringify(httpImportPath)};\n` +
    `export * from ${JSON.stringify(importPath)};\n` +
    `export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});\n`;

  await fs.writeFile(target, wrapper);
}

if (internalFiles.length) {
  const target = path.join(targetRoot, "internal", "[route].js");
  await fs.mkdir(path.dirname(target), { recursive: true });

  const imports = internalFiles
    .map(
      (source, index) =>
        `import route${index} from ${JSON.stringify(relativeImport(target, source))};`
    )
    .join("\n");
  const httpImportPath = relativeImport(target, httpModule);
  const entries = internalFiles
    .map((source, index) => {
      const route = path.basename(source, ".js");
      return `  [${JSON.stringify(route)}, wrapHandler(route${index}, { service })]`;
    })
    .join(",\n");

  const wrapper = `${imports}
import { apiError, wrapHandler } from ${JSON.stringify(httpImportPath)};

const service = "fluxo-juridico-vendas";
const handlers = new Map([
${entries}
]);

export default async function handler(req, res) {
  const rawRoute = req.query?.route;
  const route = Array.isArray(rawRoute) ? String(rawRoute[0] || "") : String(rawRoute || "");
  const selected = handlers.get(route);

  if (!selected) {
    return apiError(req, res, 404, "Rota interna não encontrada.", "internal_route_not_found");
  }

  return selected(req, res);
}
`;

  await fs.writeFile(target, wrapper);
}

const functionCount = directFiles.length + (internalFiles.length ? 1 : 0);
console.log(
  `Generated ${functionCount} Vercel Function wrapper(s) from ${files.length} server route(s) and ${publicFiles.length} public asset(s).`
);
