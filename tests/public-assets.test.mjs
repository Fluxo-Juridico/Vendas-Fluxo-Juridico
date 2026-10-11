import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("build publica marca, ícones e licença sem alterar os bytes", () => {
  execFileSync(process.execPath, ["scripts/generate-api-wrappers.mjs"]);
  for (const path of [
    "assets/fluxo-juridico-temp-mark.svg",
    "assets/fluxo-juridico-email-logo.png",
    "assets/icons/fluent/sprite.svg",
    "assets/icons/fluent/LICENSE"
  ])
    assert.deepEqual(readFileSync("public/" + path), readFileSync(path));
});
