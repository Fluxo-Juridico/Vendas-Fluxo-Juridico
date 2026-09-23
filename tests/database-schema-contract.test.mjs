import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../platform/runtime/index.js", import.meta.url), "utf8");

test("runtime resolves the shared database domain schemas", () => {
  assert.match(runtime, /DATABASE_SEARCH_PATH\s*=\s*"public,billing,sales,admin,private"/);
  assert.match(runtime, /withDatabaseSearchPath/);
  assert.match(runtime, /search_path=\$\{DATABASE_SEARCH_PATH\}/);
});
