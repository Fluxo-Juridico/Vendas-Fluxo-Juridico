import test from "node:test";
import assert from "node:assert/strict";
import {
  ACQUISITION_CONTRACT_VERSION,
  ACQUISITION_FIXTURE,
  ACQUISITION_STAGES,
  isValidAcquisitionProgression
} from "../contracts/acquisition-v1.js";
import {automationForPaymentStatus} from "../contracts/billing-v1.js";

test("acquisition-v1 preserves the checkout-to-first-login progression",()=>{
  assert.equal(ACQUISITION_CONTRACT_VERSION,"acquisition-v1");
  assert.equal(automationForPaymentStatus(ACQUISITION_FIXTURE.payment.status),"activate");
  assert.deepEqual(ACQUISITION_STAGES,[
    "checkout_created",
    "payment_approved",
    "billing_activate",
    "organization_provisioned",
    "first_login"
  ]);
  assert.equal(isValidAcquisitionProgression(ACQUISITION_STAGES),true);
  assert.equal(ACQUISITION_FIXTURE.billing.seats,2);
  assert.equal(ACQUISITION_FIXTURE.billing.storageGb,5);
});
