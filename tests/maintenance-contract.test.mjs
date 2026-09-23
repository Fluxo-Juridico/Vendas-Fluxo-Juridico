import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const theme = readFileSync(new URL("../sales-theme.css", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("sales site loads the canonical stylesheet layers only", () => {
  assert.match(html, /\/site\.css/);
  assert.match(html, /\/motion\.css/);
  assert.match(html, /\/sales-theme\.css/);
  assert.doesNotMatch(html, /sales-refinement\.css/);
  assert.equal(existsSync(new URL("../sales-refinement.css", import.meta.url)), false);
});

test("sales theme contains no numbered final/refinement identity", () => {
  assert.doesNotMatch(theme, /SALES FINAL V\d|SALES V\d|single visual override layer/i);
});

test("sales source files stay inside maintenance budgets", () => {
  const budgets = {
    "index.html": 35000,
    "site.js": 25000,
    "site.css": 60000,
    "sales-theme.css": 40000
  };
  for (const [path, max] of Object.entries(budgets)) {
    const size = statSync(new URL("../" + path, import.meta.url)).size;
    assert.ok(size <= max, `${path} exceeded ${max} bytes (current: ${size})`);
  }
});

test("canonical contracts are exported as a minimal installable package", () => {
  assert.deepEqual(pkg.files, ["contracts"]);
  assert.deepEqual(pkg.exports, {
    "./billing-v1": "./contracts/billing-v1.js",
    "./subscription-management-v1": "./contracts/subscription-management-v1.js",
    "./engineering-v1": "./contracts/engineering-v1.js",
    "./acquisition-v1": "./contracts/acquisition-v1.js"
  });
  assert.equal(existsSync(new URL("../contracts/billing-v1.js", import.meta.url)), true);
  assert.equal(
    existsSync(new URL("../contracts/subscription-management-v1.js", import.meta.url)),
    true
  );
  assert.equal(existsSync(new URL("../contracts/engineering-v1.js", import.meta.url)), true);
  assert.equal(existsSync(new URL("../contracts/acquisition-v1.js", import.meta.url)), true);
});

test("API observability keeps raw exception details out of logs", () => {
  const http = readFileSync(new URL("../server/lib/http.js", import.meta.url), "utf8");
  assert.doesNotMatch(http, /api_request_start|api_unhandled_error|errorName|Unhandled API error/);
  assert.doesNotMatch(http, /error\?\.message/);
  assert.match(http, /statusCode:/);
  assert.match(http, /durationMs:/);
});
