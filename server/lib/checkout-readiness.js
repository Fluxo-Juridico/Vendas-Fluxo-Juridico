import { config } from "@fluxo-juridico/runtime";

// A read-only check of the subscription API. It never creates a plan or charge.
export function createCheckoutVerifier({ getToken, request = globalThis.fetch, now = Date.now }) {
  let cache;
  return async () => {
    const token = String((await getToken()) || "").trim();
    if (cache?.token === token && cache.expires > now()) return cache.promise;
    const entry = { token, expires: now() + 30000 };
    entry.promise = (async () => {
      let status = "not_configured";
      if (token) {
        try {
          const response = await request(
            "https://api.mercadopago.com/preapproval_plan/search?limit=1",
            {
              method: "GET",
              headers: { Authorization: "Bearer " + token },
              signal: AbortSignal.timeout(5000)
            }
          );
          const data = await response.json().catch(() => null);
          status =
            response.ok && Array.isArray(data?.results)
              ? "verified"
              : [401, 403].includes(response.status)
                ? "rejected"
                : "unavailable";
        } catch {
          status = "unavailable";
        }
      }
      if (status === "verified") entry.expires = now() + 300000;
      return {
        provider: "mercado_pago",
        status,
        checkedAt: new Date(now()).toISOString(),
        scope: "subscription_plan_read",
        purchaseTested: false
      };
    })();
    cache = entry;
    return entry.promise;
  };
}

export const verifyCheckoutProvider = createCheckoutVerifier({
  getToken: () => config.get("MERCADO_PAGO_ACCESS_TOKEN")
});
