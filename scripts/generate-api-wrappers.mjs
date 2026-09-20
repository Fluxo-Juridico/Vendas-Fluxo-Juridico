import fs from "node:fs/promises";
import path from "node:path";

const serverRoot = path.resolve("server/api");
const targetRoot = path.resolve("api");
const publicRoot = path.resolve("public");
const publicFiles = ["index.html", "site.css", "motion.css", "site.js"];

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = await walk(serverRoot).catch(() => []);
if (!files.length) throw new Error("Nenhuma rota fonte encontrada em server/api.");

await fs.rm(targetRoot, { recursive: true, force: true });
await fs.rm(publicRoot, { recursive: true, force: true });
await fs.mkdir(publicRoot, { recursive: true });

for (const file of publicFiles) {
  await fs.copyFile(path.resolve(file), path.join(publicRoot, file));
}

for (const source of files) {
  const relative = path.relative(serverRoot, source);
  const target = path.join(targetRoot, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });

  const importPath = "./" + path.relative(path.dirname(target), source).replaceAll(path.sep, "/");
  const wrapper =
    `export * from ${JSON.stringify(importPath)};\n` +
    `import handler from ${JSON.stringify(importPath)};\n` +
    "export default handler;\n";

  await fs.writeFile(target, wrapper);
}

console.log(`Generated ${files.length} API wrapper(s) and ${publicFiles.length} public asset(s).`);
