import test from "node:test";
import assert from "node:assert/strict";
import { db, config } from "@fluxo-juridico/runtime";
import { tryProvision } from "../server/lib/billing.js";

test("liberação exige confirmação da identidade e não aceita apenas HTTP 200", async () => {
  const original = { query: db.query, get: config.get, fetch: globalThis.fetch };
  const writes = [];
  const order = {
    id: "fixture-order",
    payment_status: "approved",
    plan: "Solo",
    buyer_email: "fixture@example.test",
    seat_limit: 2,
    storage_limit_gb: 5
  };
  try {
    config.get = async (key) =>
      key === "saas_base_url"
        ? "https://fixture.example.test"
        : key === "auto_activate_on_approved"
          ? true
          : "fixture-only-credential";
    db.query = async (sql, params) => {
      writes.push({ sql, params });
      return { rows: [] };
    };
    for (const body of [
      {},
      { ok: true, access: { ready: false } },
      { ok: true, access: { ready: true } }
    ]) {
      globalThis.fetch = async () => new globalThis.Response(JSON.stringify(body), { status: 200 });
      const confirmed = await tryProvision(order);
      assert.equal(confirmed, body.access?.ready === true);
      assert.equal(writes.at(-1).params[1], confirmed ? "activated" : "activate");
      assert.match(
        writes.at(-1).sql,
        confirmed ? /provisioning_status=\$2/ : /provisioning_status='retry'/
      );
    }
    globalThis.fetch = async () =>
      new globalThis.Response(
        JSON.stringify({ ok: true, idempotent: true, reapplied: false, access: null }),
        { status: 200 }
      );
    assert.equal(await tryProvision(order), true);
    assert.match(writes.at(-1).sql, /CASE WHEN provisioning_status/);
    assert.doesNotMatch(writes.at(-1).sql, /provisioning_status='retry'/);
  } finally {
    db.query = original.query;
    config.get = original.get;
    globalThis.fetch = original.fetch;
  }
});
