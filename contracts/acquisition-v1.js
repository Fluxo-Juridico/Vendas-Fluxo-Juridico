import {
  BILLING_CONTRACT_VERSION,
  BILLING_CONTRACT_FINGERPRINT,
  planDefaults
} from "./billing-v1.js";

export const ACQUISITION_CONTRACT_VERSION = "acquisition-v1";
export const ACQUISITION_STAGES = Object.freeze([
  "checkout_created",
  "payment_approved",
  "billing_activate",
  "organization_provisioned",
  "first_login"
]);

export const ACQUISITION_FIXTURE = Object.freeze({
  version: ACQUISITION_CONTRACT_VERSION,
  orderId: "e2e-order-0001",
  plan: "Solo",
  buyer: Object.freeze({
    name: "Cliente E2E",
    email: "cliente.e2e@example.test",
    cpf: "52998224725",
    phone: "86999990000",
    firmName: "Escritório E2E"
  }),
  payment: Object.freeze({
    status: "approved",
    provisioningStatus: "activated"
  }),
  firstLoginPath: "/login?first=1",
  billing: Object.freeze({
    contractVersion: BILLING_CONTRACT_VERSION,
    contractFingerprint: BILLING_CONTRACT_FINGERPRINT,
    seats: planDefaults("Solo").seats,
    storageGb: planDefaults("Solo").storageGb
  })
});

export function acquisitionStageIndex(stage) {
  return ACQUISITION_STAGES.indexOf(String(stage || ""));
}

export function isValidAcquisitionProgression(stages) {
  if (!Array.isArray(stages) || !stages.length) return false;
  let previous = -1;
  for (const stage of stages) {
    const current = acquisitionStageIndex(stage);
    if (current < 0 || current <= previous) return false;
    previous = current;
  }
  return true;
}
