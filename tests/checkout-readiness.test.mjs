import test from "node:test";
import assert from "node:assert/strict";
import { createCheckoutVerifier } from "../server/lib/checkout-readiness.js";

test("checkout verifica a API de assinaturas apenas por leitura e não expõe credenciais ou clientes", async () => {
  let requests = 0;
  const verifier = createCheckoutVerifier({
    getToken: async () => "fixture-secret",
    request: async (url, options) => {
      requests++;
      assert.equal(url, "https://api.mercadopago.com/preapproval_plan/search?limit=1");
      assert.equal(options.method, "GET");
      assert.equal(options.headers.Authorization, "Bearer fixture-secret");
      assert.equal(options.body, undefined);
      return new globalThis.Response(
        JSON.stringify({ results: [{ id: "private-plan", payer_email: "private@example.test" }] })
      );
    }
  });
  const [a, b] = await Promise.all([verifier(), verifier()]);
  assert.equal(requests, 1);
  assert.equal(a.status, "verified");
  assert.deepEqual(a, b);
  assert.equal(a.purchaseTested, false);
  assert.doesNotMatch(JSON.stringify(a), /fixture-secret|private-plan|private@example/);
});

test("checkout diferencia credenciais recusadas, indisponibilidade e configuração ausente", async () => {
  for (const [httpStatus, body, expected] of [
    [401, {}, "rejected"],
    [403, {}, "rejected"],
    [500, {}, "unavailable"],
    [200, {}, "unavailable"]
  ]) {
    const verify = createCheckoutVerifier({
      getToken: async () => "fixture",
      request: async () => new globalThis.Response(JSON.stringify(body), { status: httpStatus })
    });
    assert.equal((await verify()).status, expected);
  }
  const verify = createCheckoutVerifier({
    getToken: async () => "",
    request: async () => assert.fail("Não deve consultar sem credencial")
  });
  assert.equal((await verify()).status, "not_configured");
  const offline = createCheckoutVerifier({
    getToken: async () => "fixture",
    request: async () => {
      throw new Error("fixture network failure");
    }
  });
  assert.equal((await offline()).status, "unavailable");
});

test("cache da verificação expira e troca de credencial força nova consulta", async () => {
  let time = 0,
    token = "first",
    calls = 0;
  const verify = createCheckoutVerifier({
    getToken: async () => token,
    now: () => time,
    request: async () => {
      calls++;
      return new globalThis.Response(JSON.stringify({ results: [] }));
    }
  });
  await verify();
  await verify();
  assert.equal(calls, 1);
  token = "second";
  await verify();
  assert.equal(calls, 2);
  time = 300001;
  await verify();
  assert.equal(calls, 3);
});
