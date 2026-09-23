import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkout = readFileSync(new URL("../server/api/checkout.js", import.meta.url), "utf8");
const webhook = readFileSync(
  new URL("../server/api/webhooks/mercado-pago.js", import.meta.url),
  "utf8"
);
const billing = readFileSync(new URL("../server/lib/billing.js", import.meta.url), "utf8");

test("checkout persists a provider plan before sending the buyer away", () => {
  assert.match(checkout, /\/preapproval_plan/);
  assert.match(checkout, /provider_plan_id/);
  assert.match(checkout, /payment_status='pending'/);
  assert.match(checkout, /back_url/);
});

test("approved provider state enters the signed SaaS provisioning bridge", () => {
  assert.match(webhook, /status\s*===\s*["']approved["']/);
  assert.match(webhook, /await tryProvision\(fresh\)/);
  assert.match(billing, /canonicalBillingSignature/);
  assert.match(billing, /X-Billing-Signature/);
  assert.match(billing, /\/api\/billing-provision/);
  assert.match(billing, /provisioning_status='retry'/);
  assert.match(billing, /provisioningStatus/);
});

test("Mercado Pago simulator probe is acknowledged only after signature validation", () => {
  const verifyIndex = webhook.indexOf("verifyHmac");
  const probeIndex = webhook.search(
    /isSignedSimulatorProbe\(\{\s*body:\s*req\.body,\s*dataId\s*\}\)/
  );
  assert.ok(verifyIndex >= 0);
  assert.ok(probeIndex > verifyIndex);
  assert.match(webhook, /simulated\s*:\s*true/);
});
