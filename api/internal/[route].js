import billingExport from "../../server/api/internal/billing-export.js";
import crmExport from "../../server/api/internal/crm-export.js";
import crmUpdate from "../../server/api/internal/crm-update.js";
import subscriptionManagement from "../../server/api/internal/subscription-management.js";
import { apiError, wrapHandler } from "../../server/lib/http.js";

const service = "fluxo-juridico-vendas";
const handlers = new Map([
  ["billing-export", wrapHandler(billingExport, { service })],
  ["crm-export", wrapHandler(crmExport, { service })],
  ["crm-update", wrapHandler(crmUpdate, { service })],
  ["subscription-management", wrapHandler(subscriptionManagement, { service })]
]);

export default async function handler(req, res) {
  const rawRoute = req.query?.route;
  const route = Array.isArray(rawRoute) ? String(rawRoute[0] || "") : String(rawRoute || "");
  const selected = handlers.get(route);

  if (!selected) {
    return apiError(req, res, 404, "Rota interna não encontrada.", "internal_route_not_found");
  }

  return selected(req, res);
}
