import test from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIPTION_MANAGEMENT_VERSION,
  SUBSCRIPTION_MANAGEMENT_ACTIONS,
  canonicalSubscriptionManagementSignature
} from "../contracts/subscription-management-v1.js";

test("contrato de gestão de assinatura é estável", () => {
  assert.equal(SUBSCRIPTION_MANAGEMENT_VERSION, "subscription-management-v1");
  assert.deepEqual([...SUBSCRIPTION_MANAGEMENT_ACTIONS], ["inspect", "change_plan", "cancel"]);
});

test("assinatura HMAC normaliza o e-mail e inclui o plano", () => {
  assert.equal(
    canonicalSubscriptionManagementSignature({
      timestamp: "10",
      requestId: "req-1",
      organizationId: "org-1",
      email: " OWNER@EXAMPLE.COM ",
      action: "change_plan",
      targetPlan: "Premium"
    }),
    "10.subscription-management-v1.req-1.org-1.owner@example.com.change_plan.Premium"
  );
});
