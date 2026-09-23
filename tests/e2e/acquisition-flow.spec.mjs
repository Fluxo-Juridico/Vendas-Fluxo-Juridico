import { test, expect } from "@playwright/test";
import { ACQUISITION_FIXTURE } from "../../contracts/acquisition-v1.js";
import { PLAN_CATALOG } from "../../contracts/billing-v1.js";

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
