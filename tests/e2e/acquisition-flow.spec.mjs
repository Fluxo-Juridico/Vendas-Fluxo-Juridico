import { test, expect } from "@playwright/test";
import { ACQUISITION_FIXTURE } from "../../contracts/acquisition-v1.js";
import { PLAN_CATALOG } from "../../contracts/billing-v1.js";
import { readFileSync } from "node:fs";

test("Vendas → checkout → billing confirmado → provisionamento → primeiro acesso", async ({
  page
}) => {
  const fixture = ACQUISITION_FIXTURE;
  const localBase = "http://127.0.0.1:4174";
  let checkoutPayload = null;
  let paymentStatusReads = 0;

  await page.route("**/api/billing-config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        saasUrl: "https://saas.example.test",
        plans: PLAN_CATALOG
      })
    })
  );

  await page.route("**/api/checkout", async (route) => {
    checkoutPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        orderId: fixture.orderId,
        checkoutUrl: `${localBase}/?checkout=return&order=${encodeURIComponent(fixture.orderId)}`,
        plan: fixture.plan,
        contractVersion: fixture.billing.contractVersion,
        contractFingerprint: fixture.billing.contractFingerprint,
        seatLimit: fixture.billing.seats,
        storageLimitGb: fixture.billing.storageGb
      })
    });
  });

  await page.route("**/api/payment-status?*", (route) => {
    paymentStatusReads += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orderId: fixture.orderId,
        status: fixture.payment.status,
        provisioningStatus: fixture.payment.provisioningStatus,
        plan: fixture.plan
      })
    });
  });

  await page.goto("/");
  await page.locator(`[data-checkout-plan="${fixture.plan}"]`).click();
  await expect(page.locator("#checkoutDialog")).toHaveAttribute("open", "");

  await page.locator('#checkoutForm [name="name"]').fill(fixture.buyer.name);
  await page.locator('#checkoutForm [name="cpf"]').fill(fixture.buyer.cpf);
  await page.locator('#checkoutForm [name="email"]').fill(fixture.buyer.email);
  await page.locator('#checkoutForm [name="phone"]').fill(fixture.buyer.phone);
  await page.locator('#checkoutForm [name="firmName"]').fill(fixture.buyer.firmName);
  await page.locator('#checkoutForm [name="acceptTerms"]').check();
  await page.locator('#checkoutForm button[type="submit"]').click();

  await expect(page.locator("#checkoutResult")).toContainText(
    "Pagamento aprovado e acesso liberado"
  );
  const firstAccess = page.locator("#checkoutResult a");
  await expect(firstAccess).toHaveAttribute("href", "https://saas.example.test/login?first=1");

  expect(checkoutPayload).toMatchObject({
    plan: fixture.plan,
    name: fixture.buyer.name,
    email: fixture.buyer.email,
    firmName: fixture.buyer.firmName,
    acceptTerms: "on"
  });
  expect(String(checkoutPayload.cpf).replace(/\D/g, "")).toBe(fixture.buyer.cpf);
  expect(paymentStatusReads).toBeGreaterThan(0);
});

test("pagamento aprovado continua consultando até a liberação e mantém o pedido ao recarregar", async ({
  page
}) => {
  let reads = 0;
  await page.route("**/api/billing-config", (route) =>
    route.fulfill({
      json: { enabled: true, saasUrl: "https://saas.example.test", plans: PLAN_CATALOG }
    })
  );
  await page.route("**/api/payment-status?*", (route) => {
    reads++;
    return route.fulfill({
      json: {
        status: "approved",
        provisioningStatus: reads === 1 ? "retry" : "activated",
        accessStatus: "active"
      }
    });
  });
  await page.goto("/?checkout=return&order=" + ACQUISITION_FIXTURE.orderId);
  await expect(page.locator("#checkoutResult")).toContainText("Pagamento aprovado.");
  await expect(page.locator("#checkoutResult")).toContainText("acesso liberado", {
    timeout: 10000
  });
  await expect(page).toHaveURL(/checkout=return.*order=/);
  await page.reload();
  await expect(page.locator("#checkoutResult")).toContainText("acesso liberado");
  expect(reads).toBeGreaterThanOrEqual(3);
});

test("falha de consulta permite repetição sem iniciar outra cobrança", async ({ page }) => {
  let fail = true;
  await page.route("**/api/billing-config", (route) =>
    route.fulfill({
      json: { enabled: true, saasUrl: "https://saas.example.test", plans: PLAN_CATALOG }
    })
  );
  await page.route("**/api/payment-status?*", (route) =>
    fail
      ? route.fulfill({ status: 503, json: { error: "Consulta indisponível" } })
      : route.fulfill({
          json: { status: "approved", provisioningStatus: "activated", accessStatus: "active" }
        })
  );
  await page.goto("/?checkout=return&order=" + ACQUISITION_FIXTURE.orderId);
  await expect(page.locator("#checkoutResult")).toContainText("Consulta indisponível");
  fail = false;
  await page.getByRole("button", { name: "Consultar novamente" }).click();
  await expect(page.locator("#checkoutResult")).toContainText("acesso liberado");
});

test("retorno de pagamento aprovado respeita o bloqueio atual do escritório", async ({ page }) => {
  await page.route("**/api/billing-config", (route) =>
    route.fulfill({
      json: { enabled: true, saasUrl: "https://saas.example.test", plans: PLAN_CATALOG }
    })
  );
  await page.route("**/api/payment-status?*", (route) =>
    route.fulfill({
      json: { status: "approved", provisioningStatus: "activated", accessStatus: "blocked" }
    })
  );
  await page.goto("/?checkout=return&order=" + ACQUISITION_FIXTURE.orderId);
  await expect(page.locator("#checkoutResult")).toContainText("Acesso bloqueado");
  await expect(page.locator("#checkoutResult a")).toHaveCount(0);
});

test("modelos de e-mail exibem a marca e preservam leitura no celular", async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(readFileSync("docs/email-templates/preview.html", "utf8"));
  await expect(page.locator("iframe")).toHaveCount(4);
  for (const frame of page.frames().slice(1)) {
    await expect(frame.locator("img")).toHaveAttribute("alt", "Fluxo Jurídico");
    expect(
      await frame.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
      )
    ).toBe(true);
    expect(
      await frame.locator("img").evaluate((image) => image.complete && image.naturalWidth > 0)
    ).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("email-models-390.png"), fullPage: true });
});
