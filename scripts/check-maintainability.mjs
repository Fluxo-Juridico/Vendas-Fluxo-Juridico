import fs from "node:fs/promises";
import path from "node:path";

const errors = [];
const warnings = [];

async function exists(file) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false);
}

async function walk(root) {
  if (!(await exists(root))) return [];
  const out = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const roots = ["contracts", "server/api", "server/lib", "scripts"];
const files = [];
for (const root of roots) files.push(...(await walk(root)));

const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:js|mjs)$/;
const forbiddenName =
  /(?:^|[-_.])(final|old|legacy-copy|copy|new-fix|fix-new|temp|temporary)(?:[-_.]|$)|module-\d+/i;

for (const file of files) {
  if (!/\.(?:js|mjs)$/i.test(file)) continue;
  const normalized = file.split(path.sep).join("/");
  const base = path.basename(file);
  if (!kebabCase.test(base)) errors.push(`Arquivo canônico deve usar kebab-case: ${normalized}`);
  if (forbiddenName.test(base)) errors.push(`Nome temporário não permitido: ${normalized}`);

  const source = await fs.readFile(file, "utf8");
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (
      /(?:\/\/|\/\*+|\*)\s*(?:TODO|FIXME|HACK)\b/i.test(line) &&
      !/(?:#\d+|https:\/\/github\.com\/)/.test(line)
    ) {
      errors.push(`Comentário de manutenção sem issue rastreável: ${normalized}:${index + 1}`);
    }
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, warnings }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: files.filter((file) => /\.(?:js|mjs)$/i.test(file)).length,
      conventions: ["kebab-case", "tracked-maintenance-comments"],
      warnings
    },
    null,
    2
  )
);
