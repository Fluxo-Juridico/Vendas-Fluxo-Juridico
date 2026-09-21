import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizedTimestamp,
  signatureManifest,
  signatureParts
} from "../server/api/webhooks/mercado-pago.js";

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
