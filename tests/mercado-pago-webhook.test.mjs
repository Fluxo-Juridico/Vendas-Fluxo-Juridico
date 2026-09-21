import assert from "node:assert/strict";
import test from "node:test";
import {
  isSignedSimulatorProbe,
  normalizedTimestamp,
  signatureManifest,
  signatureParts
} from "../server/api/webhooks/mercado-pago.js";

const simulatorBody={
  action:"updated",
  application_id:"6890332303704097",
  data:{id:"123456"},
  date:"2021-11-01T02:02:02Z",
  entity:"preapproval",
  id:"123456",
  type:"subscription_preapproval",
  version:8
};

test("parsear cabeçalho x-signature do Mercado Pago",()=>{
  assert.deepEqual(
    signatureParts("ts=1700000000,v1=abcdef"),
    {ts:"1700000000",v1:"abcdef"}
  );
});

test("montar manifesto de assinatura no formato documentado",()=>{
  assert.equal(
    signatureManifest({
      dataId:"ABC123",
      requestId:"request-42",
      timestamp:"1700000000"
    }),
    "id:abc123;request-id:request-42;ts:1700000000;"
  );
});

test("normalizar timestamp em segundos ou milissegundos",()=>{
  assert.equal(normalizedTimestamp("1700000000"),1700000000);
  assert.equal(normalizedTimestamp("1700000000000"),1700000000);
  assert.equal(normalizedTimestamp("invalid"),undefined);
});

test("reconhecer somente o payload oficial assinado do simulador",()=>{
  assert.equal(
    isSignedSimulatorProbe({body:simulatorBody,dataId:"123456"}),
    true
  );
});

test("não tratar uma notificação real parecida como teste",()=>{
  assert.equal(
    isSignedSimulatorProbe({
      body:{...simulatorBody,data:{id:"real-resource"}},
      dataId:"real-resource"
    }),
    false
  );
});
