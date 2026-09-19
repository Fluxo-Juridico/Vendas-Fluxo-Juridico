import {allowMethods} from "../lib/http.js";
import {db} from "@fluxo-juridico/runtime";

export const access="public";
export const methods=["GET"];

/**
 * Read-only order status used by the return page after Mercado Pago.
 * It exposes only the minimum state required by the buyer-facing UI.
 */
export default async function(req,res){
  if(!allowMethods(req,res,methods))return;
  const orderId=String(req.query?.order||"");

  if(!/^[0-9a-f-]{36}$/i.test(orderId)){
    return res.status(400).json({error:"Pedido inválido."});
  }

  const {rows}=await db.query(
    `SELECT
       id,plan,amount_cents,currency,
       payment_status,payment_status_detail,
       subscription_status,provisioning_status,
       paid_at,updated_at
     FROM sales_orders
     WHERE id=$1
     LIMIT 1`,
    [orderId]
  );

  const order=rows[0];
  if(!order){
    return res.status(404).json({error:"Pedido não encontrado."});
  }

  res.setHeader("Cache-Control","no-store");
  res.json({
    orderId:order.id,
    plan:order.plan,
    amountCents:Number(order.amount_cents)||0,
    currency:order.currency,
    status:order.payment_status,
    statusDetail:order.payment_status_detail,
    subscriptionStatus:order.subscription_status,
    provisioningStatus:order.provisioning_status,
    paidAt:order.paid_at,
    updatedAt:order.updated_at
  });
}