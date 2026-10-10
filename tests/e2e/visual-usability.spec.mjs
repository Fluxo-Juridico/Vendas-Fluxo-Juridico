import { test, expect } from "@playwright/test";
import { PLAN_CATALOG } from "../../contracts/billing-v1.js";
for (const width of [1536, 768, 390])
  test(`identidade, navegação e retry de formulários ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/billing-config", (route) =>
      route.fulfill({
        json: { enabled: true, saasUrl: "https://saas.example.test", plans: PLAN_CATALOG }
      })
    );
    await page.route("**/api/leads", (route) =>
      route.fulfill({ status: 503, json: { error: "Falha temporária. Tente novamente." } })
    );
    await page.route("**/api/checkout", (route) =>
      route.fulfill({ status: 503, json: { error: "Pagamento indisponível. Tente novamente." } })
    );
    await page.goto("/");
    await expect(page.locator(".nav .logo img")).toBeVisible();
    expect(
      await page.locator(".nav .logo img").evaluate((e) => e.complete && e.naturalWidth > 0)
    ).toBe(true);
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`sales-${width}.png`),
      fullPage: true
    });
    await page.locator("#leadForm [name=name]").fill("Cliente Teste");
    await page.locator("#leadForm [name=email]").fill("teste@example.test");
    await page.locator("#leadForm [name=message]").fill("Quero conhecer os planos.");
    const leadButton = page.locator("#leadForm button[type=submit]");
    const label = await leadButton.textContent();
    await leadButton.click();
    await expect(page.locator("#formStatus")).toContainText("Falha temporária");
    await expect(leadButton).toBeEnabled();
    await expect(leadButton).toHaveText(label);
    await page.locator("[data-checkout-plan]").first().click();
    await expect(page.locator("#checkoutDialog")).toBeVisible();
    expect(
      await page
        .locator("#checkoutDialog")
        .evaluate((e) => e.getBoundingClientRect().width <= globalThis.innerWidth)
    ).toBe(true);
    for (const [field, value] of Object.entries({
      name: "Cliente Teste",
      cpf: "12345678909",
      email: "teste@example.test",
      phone: "11999999999",
      firmName: "Escritório"
    }))
      await page.locator(`#checkoutForm [name=${field}]`).fill(value);
    await page.locator("#checkoutForm [name=acceptTerms]").check();
    const checkoutButton = page.locator("#checkoutForm button[type=submit]");
    const checkoutLabel = await checkoutButton.textContent();
    await checkoutButton.click();
    await expect(page.locator("#checkoutStatus")).toContainText("Pagamento indisponível");
    await expect(checkoutButton).toBeEnabled();
    await expect(checkoutButton).toHaveText(checkoutLabel);
    expect(errors).toEqual([]);
  });
