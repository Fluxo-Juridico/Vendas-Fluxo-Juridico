import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
  BILLING_CONTRACT_VERSION,
  BILLING_CONTRACT_FINGERPRINT,
  PLAN_CATALOG,
  automationForPaymentStatus,
  contractDescriptor
} from "../contracts/billing-v1.js";

test("vendas usa fingerprint íntegro do billing-v1",()=>{
  assert.equal(BILLING_CONTRACT_VERSION,"billing-v1");
  assert.equal(createHash("sha256").update(contractDescriptor()).digest("hex"),BILLING_CONTRACT_FINGERPRINT);
  assert.deepEqual(
    Object.fromEntries(Object.entries(PLAN_CATALOG).map(([name,p])=>[name,[p.price,p.seats,p.storageGb]])),
    {Solo:[99,2,5],Essencial:[197,3,15],Profissional:[297,10,25],Premium:[497,20,100]}
  );
});

test("automação de pagamento é conservadora",()=>{
  assert.equal(automationForPaymentStatus("approved"),"activate");
  assert.equal(automationForPaymentStatus("refunded"),"block");
  assert.equal(automationForPaymentStatus("charged_back"),"block");
  assert.equal(automationForPaymentStatus("cancelled"),"block");
  assert.equal(automationForPaymentStatus("in_mediation"),"review");
  assert.equal(automationForPaymentStatus("pending"),"none");
  assert.equal(automationForPaymentStatus("rejected"),"none");
});


test("configuração de produção não altera o contrato billing-v1",()=>{
  const source=fs.readFileSync(new URL("../server/lib/billing.js",import.meta.url),"utf8");
  assert.equal(source.includes('config.get("plan_'),false);
  assert.match(source,/prices:fromCatalog\("price"\)/);
  assert.match(source,/seats:fromCatalog\("seats"\)/);
  assert.match(source,/storageGb:fromCatalog\("storageGb"\)/);
});
