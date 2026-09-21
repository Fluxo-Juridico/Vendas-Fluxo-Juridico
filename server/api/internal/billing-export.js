import {allowMethods} from "../../lib/http.js";
import {db,config,webhooks} from "@fluxo-juridico/runtime";
import {BILLING_CONTRACT_VERSION,BILLING_CONTRACT_FINGERPRINT} from "../../../contracts/billing-v1.js";

export const access="public";
export const methods=["GET"];

/**
 * HMAC-protected export consumed by the administration project.
 * The route is technically public because the other project calls it directly,
 * but every request must pass the shared BILLING_BRIDGE_SECRET signature check.
 */
export default async function(req,res){
  if(!allowMethods(req,res,methods))return;
  const secret=await config.get("BILLING_BRIDGE_SECRET");
  if(!secret){
    return res.status(503).json({error:"Ponte de cobrança não configurada."});
  }

  const timestamp=String(req.headers?.["x-billing-timestamp"]||"");
  const signature=String(req.headers?.["x-billing-signature"]||"");
  const numericTimestamp=Number(timestamp);

  if(!timestamp||!signature||!Number.isFinite(numericTimestamp)){
    return res.status(401).json({error:"Assinatura ausente."});
  }

  const valid=await webhooks.verifyHmac({
    raw:timestamp+".billing-export",
    signature,
    secret,
    algorithm:"sha256",
    encoding:"hex",
    timestamp:numericTimestamp,
    tolerance:300
  });

  if(!valid){
    return res.status(401).json({error:"Assinatura inválida."});
  }

  const {rows}=await db.query(
    `SELECT
       id,lead_id,plan,billing_contract_version,seat_limit,storage_limit_gb,
       billing_cycle,amount_cents,currency,
       buyer_name,buyer_email,cpf_masked,firm_name,phone,
       provider,provider_plan_id,provider_subscription_id,provider_payment_id,
       payment_status,payment_status_detail,subscription_status,
       provisioning_status,automation_action,failure_reason,
       paid_at,refunded_at,cancelled_at,created_at,updated_at
     FROM sales_orders
     ORDER BY created_at DESC
     LIMIT 500`
  );

  res.setHeader("Cache-Control","private, no-store");
  res.json({
    contractVersion:BILLING_CONTRACT_VERSION,
    contractFingerprint:BILLING_CONTRACT_FINGERPRINT,
    items:rows.map(order=>({
      id:order.id,
      leadId:order.lead_id,
      plan:order.plan,
      contractVersion:order.billing_contract_version||BILLING_CONTRACT_VERSION,
      contractFingerprint:BILLING_CONTRACT_FINGERPRINT,
      seatLimit:Number(order.seat_limit)||0,
      storageLimitGb:Number(order.storage_limit_gb)||0,
      billingCycle:order.billing_cycle,
      amountCents:Number(order.amount_cents)||0,
      currency:order.currency,
      name:order.buyer_name,
      email:order.buyer_email,
      cpfMasked:order.cpf_masked,
      firmName:order.firm_name,
      phone:order.phone,
      provider:order.provider,
      providerPlanId:order.provider_plan_id,
      providerSubscriptionId:order.provider_subscription_id,
      providerPaymentId:order.provider_payment_id,
      status:order.payment_status,
      statusDetail:order.payment_status_detail,
      subscriptionStatus:order.subscription_status,
      provisioningStatus:order.provisioning_status,
      automationAction:order.automation_action,
      failureReason:order.failure_reason,
      paidAt:order.paid_at,
      refundedAt:order.refunded_at,
      cancelledAt:order.cancelled_at,
      createdAt:order.created_at,
      updatedAt:order.updated_at
    }))
  });
}