import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 768, 390]) {
  test(`sales content and checkout stay usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/billing-config", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ enabled: true, saasUrl: "https://saas.example.test" })
      })
    );
    await page.goto("/");
    await expect(page.locator(".continuity-points article")).toHaveCount(3);
    const cards = await page.locator(".continuity-points article").evaluateAll((nodes) =>
      nodes.map((node) => ({
        background: node.ownerDocument.defaultView.getComputedStyle(node).backgroundColor,
        opacity: node.ownerDocument.defaultView.getComputedStyle(node).opacity
      }))
    );
    expect(
      cards.every((card) => card.background === "rgb(255, 255, 255)" && card.opacity === "1")
    ).toBe(true);
    const geometry = await page.locator(".plan-card").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          row: Math.round(box.top),
          price: node.querySelector(".price-wrap").getBoundingClientRect().top - box.top,
          button: node.querySelector(".plan-cta").getBoundingClientRect().top - box.top
        };
      })
    );
    for (const card of geometry) {
      for (const peer of geometry.filter((item) => item.row === card.row)) {
        expect(Math.abs(card.price - peer.price)).toBeLessThanOrEqual(2);
        expect(Math.abs(card.button - peer.button)).toBeLessThanOrEqual(2);
      }
    }
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1
      )
    ).toBe(true);
    await page.locator('[data-checkout-plan="Solo"]').click();
    await expect(page.locator("#checkoutDialog")).toHaveAttribute("open", "");
    await expect(page.locator('#checkoutForm [name="email"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#checkoutDialog")).not.toHaveAttribute("open", "");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".flow-line i")
        .evaluate((node) => node.ownerDocument.defaultView.getComputedStyle(node).animationName)
    ).toBe("none");
  });
}
