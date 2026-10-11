import { allowMethods } from "../lib/http.js";
import { db } from "@fluxo-juridico/runtime";
import { enforcePublicRateLimit } from "../lib/rate-limit.js";

export const access = "public";
export const methods = ["GET"];

/**
 * Read-only order status used by the return page after Mercado Pago.
 * It exposes only the minimum state required by the buyer-facing UI.
 */
export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  if (
    !(await enforcePublicRateLimit(req, res, {
      scope: "sales-payment-status-ip",
      limit: 300,
      windowSeconds: 300
    }))
  )
    return;

  const orderId = String(req.query?.order || "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return res.status(400).json({ error: "Pedido inválido." });
  }
  if (
    !(await enforcePublicRateLimit(req, res, {
      scope: "sales-payment-status-order",
      limit: 60,
      windowSeconds: 300,
      subject: orderId
    }))
  )
    return;

  const { rows } = await db.query(
    `SELECT
       so.id,so.plan,so.amount_cents,so.currency,
       so.payment_status,so.payment_status_detail,
       so.subscription_status,so.provisioning_status,
       so.paid_at,so.updated_at,pa.status AS access_status
     FROM sales_orders so
     LEFT JOIN platform_accounts pa ON lower(pa.email)=lower(so.buyer_email)
     WHERE so.id=$1
     LIMIT 1`,
    [orderId]
  );

  const order = rows[0];
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({
    orderId: order.id,
    plan: order.plan,
    amountCents: Number(order.amount_cents) || 0,
    currency: order.currency,
    status: order.payment_status,
    statusDetail: order.payment_status_detail,
    subscriptionStatus: order.subscription_status,
    provisioningStatus: order.provisioning_status,
    accessStatus: ["active", "blocked", "pending"].includes(order.access_status)
      ? order.access_status
      : "unknown",
    paidAt: order.paid_at,
    updatedAt: order.updated_at
  });
}
