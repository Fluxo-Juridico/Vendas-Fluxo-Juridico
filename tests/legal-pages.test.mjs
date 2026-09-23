import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    { source: "/termos.html", destination: "/api/terms" },
    { source: "/termos", destination: "/api/terms" },
    { source: "/privacidade.html", destination: "/api/privacy" },
    { source: "/privacidade", destination: "/api/privacy" }
  ]);
});
