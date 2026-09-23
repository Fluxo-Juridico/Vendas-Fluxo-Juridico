import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { PRIVACY_HTML, TERMS_HTML } from "../server/lib/legal-pages.js";

const terms = readFileSync(new URL("../termos.html", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../privacidade.html", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("bundled legal pages stay byte-identical to canonical HTML", () => {
  assert.equal(TERMS_HTML, terms);
  assert.equal(PRIVACY_HTML, privacy);
});

test("production routes expose both legal documents with clean and html URLs", () => {
  assert.deepEqual(vercel.rewrites, [
    { source: "/termos.html", destination: "/api/legal?document=terms" },
    { source: "/termos", destination: "/api/legal?document=terms" },
    { source: "/privacidade.html", destination: "/api/legal?document=privacy" },
    { source: "/privacidade", destination: "/api/legal?document=privacy" }
  ]);
});

test("source-time Vercel wrapper exists for the consolidated legal function", () => {
  assert.equal(existsSync(new URL("../api/legal.js", import.meta.url)), true);
  assert.equal(existsSync(new URL("../api/terms.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../api/privacy.js", import.meta.url)), false);
});

test("Vercel source function count stays within the Hobby deployment budget", () => {
  const apiFiles = readdirSync(new URL("../api/", import.meta.url), { recursive: true }).filter(
    (entry) => String(entry).endsWith(".js")
  );
  assert.ok(
    apiFiles.length <= 12,
    `Vercel Hobby allows at most 12 Functions; current source count is ${apiFiles.length}`
  );
});
