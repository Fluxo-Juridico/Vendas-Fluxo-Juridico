import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { db, config } from "@fluxo-juridico/runtime";
import {
  officialUrl,
  renderEmail,
  deliverEmail,
  enqueueOrderEmail,
  drainEmailOutbox
} from "../server/lib/transactional-email.js";

test("HTML escapa dados do cliente e links são HTTPS oficiais", () => {
  assert.equal(
    renderEmail("<b>{{customer_name}}</b>", { customer_name: "<img src=x onerror=x>" }),
    "<b>&lt;img src=x onerror=x&gt;</b>"
  );
  assert.throws(() => officialUrl("http://example.test", "/login"));
  assert.throws(() => officialUrl("https://user:pass@example.test", "/login"));
  assert.equal(officialUrl("https://example.test/other", "/login"), "https://example.test/login");
  assert.throws(() => renderEmail("{{missing}}", {}));
});
test("quatro modelos preservam logo e links individuais de convite e recuperação", async () => {
  for (const kind of ["purchase", "access", "invite", "recovery"]) {
    const source = await readFile(
      new URL("../docs/email-templates/" + kind + ".html", import.meta.url),
      "utf8"
    );
    assert.match(source, /fluxo-juridico-email-logo\.png/);
    if (["invite", "recovery"].includes(kind)) assert.match(source, /\{\{ \.ConfirmationURL \}\}/);
  }
});
test("aceitação pelo provedor exige id e utiliza mesma chave em repetição", async () => {
  const calls = [];
  const row = {
    id: "fixture-email",
    recipient: "recipient@example.test",
    subject: "Compra",
    html: "<p>Teste</p>",
    sender: "Fluxo <saved@example.test>"
  };
  const settings = { key: "fixture-key", from: "Fluxo <new@example.test>" };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new globalThis.Response(JSON.stringify({ id: "provider-1" }), { status: 200 });
  };
  for (let i = 0; i < 2; i++)
    assert.equal(await deliverEmail(row, settings, { fetchImpl }), "provider-1");
  assert.equal(
    calls[0].options.headers["Idempotency-Key"],
    calls[1].options.headers["Idempotency-Key"]
  );
  assert.equal(JSON.parse(calls[0].options.body).from, row.sender);
  await assert.rejects(
    deliverEmail(row, settings, {
      fetchImpl: async () => new globalThis.Response("{}", { status: 403 })
    })
  );
  await assert.rejects(
    deliverEmail(row, settings, {
      fetchImpl: async () => new globalThis.Response("{}", { status: 200 })
    })
  );
});
test("não enfileira pendente, recusado ou acesso sem liberação; pedido único", async () => {
  const original = { query: db.query, get: config.get };
  const calls = [];
  try {
    config.get = async (key) =>
      ({
        EMAIL_DELIVERY_ENABLED: "true",
        EMAIL_FROM: "Fluxo <sender@example.test>",
        RESEND_API_KEY: "fixture-key"
      })[key] || "";
    db.query = async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    };
    const order = {
      id: "11111111-1111-4111-8111-111111111111",
      buyer_email: "recipient@example.test",
      buyer_name: "<Cliente>",
      plan: "Solo",
      amount_cents: 9900,
      currency: "BRL"
    };
    for (const payment_status of ["pending", "rejected"])
      assert.equal(await enqueueOrderEmail({ ...order, payment_status }, "purchase"), false);
    assert.equal(
      await enqueueOrderEmail(
        { ...order, payment_status: "approved", provisioning_status: "retry" },
        "access"
      ),
      false
    );
    assert.equal(calls.length, 0);
    assert.equal(
      await enqueueOrderEmail({ ...order, payment_status: "approved" }, "purchase"),
      true
    );
    assert.match(calls[0].sql, /ON CONFLICT \(order_id,kind\) DO NOTHING/);
    assert.match(calls[0].params[4], /&lt;Cliente&gt;/);
    assert.match(calls[0].params[4], /checkout=return&amp;order=/);
    assert.doesNotMatch(calls[0].params[4], /\{\{/);
  } finally {
    db.query = original.query;
    config.get = original.get;
  }
});
test("revalida bloqueios antes do envio e falha continua persistida para repetir", async () => {
  const original = { query: db.query, get: config.get, fetch: globalThis.fetch };
  const updates = [];
  let blocked = true;
  try {
    config.get = async (key) =>
      ({
        EMAIL_DELIVERY_ENABLED: "true",
        EMAIL_FROM: "Fluxo <sender@example.test>",
        RESEND_API_KEY: "fixture-key"
      })[key] || "";
    db.query = async (sql, params) => {
      if (sql.startsWith("WITH candidates"))
        return {
          rows: [
            {
              id: "email-1",
              order_id: "order-1",
              kind: "access",
              recipient: "test@example.test",
              subject: "Acesso",
              html: "Teste"
            }
          ]
        };
      if (sql.startsWith("SELECT so.payment_status"))
        return {
          rows: [
            {
              payment_status: "approved",
              provisioning_status: "activated",
              access_status: blocked ? "blocked" : "active",
              source_order_id: "order-1"
            }
          ]
        };
      updates.push({ sql, params });
      return { rows: [] };
    };
    let sends = 0;
    globalThis.fetch = async () => {
      sends++;
      throw new Error("fixture network error");
    };
    await drainEmailOutbox();
    assert.equal(sends, 0);
    assert.match(updates.at(-1).sql, /state='cancelled'/);
    blocked = false;
    const result = await drainEmailOutbox();
    assert.equal(sends, 1);
    assert.equal(result.failed, 1);
    assert.equal(updates.at(-1).params[1], "retry");
    assert.equal(updates.at(-1).params[2], "provider_or_persistence_unavailable");
  } finally {
    db.query = original.query;
    config.get = original.get;
    globalThis.fetch = original.fetch;
  }
});
