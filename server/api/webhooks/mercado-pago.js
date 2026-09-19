import {allowMethods} from "../../lib/http.js";
import {db,config,webhooks} from "@fluxo-juridico/runtime";
import {
  mpFetch,
  normalizePaymentStatus,
  tryProvision
} from "../../lib/billing.js";

export const access="public";
export const methods=["POST"];

/**
 * Mercado Pago webhook.
 *
 * Security:
 * - validates x-signature with MERCADO_PAGO_WEBHOOK_SECRET;
 * - accepts only notifications inside a 10-minute tolerance;
 * - fetches authoritative resource data from Mercado Pago before mutating state.
 *
 * Correlation order:
 * 1) internal external_reference when present;
 * 2) Mercado Pago subscription id;
 * 3) preapproval plan id for subscription creation events.
 */

/* --------------------------- Signature helpers -------------------------- */
function signatureParts(value){
  const parts={};

  for(const item of String(value||"").split(",")){
    const pieces=item.split("=");
    const key=pieces.shift();
    if(key&&pieces.length){
      parts[key.trim()]=pieces.join("=").trim();
    }
  }

  return parts;
}

/* ----------------------------- Order lookup ----------------------------- */
async function orderByReference(reference){
  if(!reference)return null;

  const {rows}=await db.query(
    "SELECT * FROM sales_orders WHERE id::text=$1 LIMIT 1",
    [String(reference)]
  );

  return rows[0]||null;
}

async function orderBySubscriptionId(subscriptionId){
  if(!subscriptionId)return null;

  const {rows}=await db.query(
    "SELECT * FROM sales_orders WHERE provider_subscription_id=$1 ORDER BY created_at DESC LIMIT 1",
    [String(subscriptionId)]
  );

  return rows[0]||null;
}

async function orderByPlanId(planId){
  if(!planId)return null;

  const {rows}=await db.query(
    "SELECT * FROM sales_orders WHERE provider_plan_id=$1 ORDER BY created_at DESC LIMIT 1",
    [String(planId)]
  );

  return rows[0]||null;
}

/* ------------------------------ Event log ------------------------------- */
async function recordEvent(data){
  try{
    await db.query(
      `INSERT INTO sales_payment_events (
        provider_event_id,order_id,event_type,resource_id,
        status,status_detail,payload
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        String(data.providerEventId||""),
        data.orderId||null,
        String(data.eventType||""),
        String(data.resourceId||""),
        String(data.status||""),
        String(data.statusDetail||""),
        JSON.stringify(data.payload||{})
      ]
    );
  }catch(error){
    // Mercado Pago may redeliver the same event. The unique index makes this idempotent.
    if(!String(error?.message||"").includes("sales_payment_events_provider_unique")){
      throw error;
    }
  }
}

/* ------------------------- Payment state mutation ----------------------- */
async function applyPayment(order,payment){
  const status=normalizePaymentStatus(payment.status);
  const detail=String(payment.status_detail||payment.status||"");
  const paymentId=String(payment.id||"");
  const subscriptionId=String(
    payment.preapproval_id||
    payment.subscription_id||
    order.provider_subscription_id||
    ""
  );

  await db.query(
    `UPDATE sales_orders
     SET provider_payment_id=CASE
           WHEN $2<>'' THEN $2 ELSE provider_payment_id
         END,
         provider_subscription_id=CASE
           WHEN $3<>'' THEN $3 ELSE provider_subscription_id
         END,
         payment_status=$4,
         payment_status_detail=$5,
         paid_at=CASE
           WHEN $4='approved' THEN COALESCE(paid_at,now())
           ELSE paid_at
         END,
         refunded_at=CASE
           WHEN $4 IN ('refunded','charged_back') THEN COALESCE(refunded_at,now())
           ELSE refunded_at
         END,
         cancelled_at=CASE
           WHEN $4='cancelled' THEN COALESCE(cancelled_at,now())
           ELSE cancelled_at
         END,
         updated_at=now()
     WHERE id=$1`,
    [order.id,paymentId,subscriptionId,status,detail]
  );

  if(status==="approved"&&order.lead_id){
    await db.query(
      `UPDATE sales_leads
       SET status='won',
           converted_at=COALESCE(converted_at,now()),
           updated_at=now()
       WHERE id=$1`,
      [order.lead_id]
    );
  }

  const fresh=(
    await db.query("SELECT * FROM sales_orders WHERE id=$1",[order.id])
  ).rows[0];

  await tryProvision(fresh);
  return fresh;
}

/* ------------------------------- Handler -------------------------------- */
export default async function(req,res){
  if(!allowMethods(req,res,methods))return;
  const secret=await config.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if(!secret){
    return res.status(503).json({error:"Webhook ainda não configurado."});
  }

  const parts=signatureParts(req.headers?.["x-signature"]);
  const requestId=String(req.headers?.["x-request-id"]||"");
  const dataId=String(
    req.query?.["data.id"]||
    req.query?.data_id||
    req.body?.data?.id||
    ""
  ).toLowerCase();

  if(!parts.ts||!parts.v1||!requestId||!dataId){
    return res.status(401).json({error:"Assinatura ausente."});
  }

  const manifest=
    "id:"+dataId+
    ";request-id:"+requestId+
    ";ts:"+parts.ts+
    ";";

  const rawTimestamp=Number(parts.ts);
  const timestamp=Number.isFinite(rawTimestamp)
    ?(rawTimestamp>1e11?Math.floor(rawTimestamp/1000):Math.floor(rawTimestamp))
    :undefined;

  const signatureValid=await webhooks.verifyHmac({
    raw:manifest,
    signature:parts.v1,
    secret,
    algorithm:"sha256",
    encoding:"hex",
    timestamp,
    tolerance:600
  });

  if(!signatureValid){
    return res.status(401).json({error:"Assinatura inválida."});
  }

  const eventType=String(req.body?.type||req.query?.type||"");
  const providerEventId=String(req.body?.id||"");
  const resourceId=dataId;

  try{
    /* Standard payment notification. */
    if(eventType==="payment"){
      const payment=await mpFetch(
        "/v1/payments/"+encodeURIComponent(resourceId)
      );

      const order=
        (await orderByReference(payment.external_reference))||
        (await orderBySubscriptionId(
          payment.preapproval_id||payment.subscription_id
        ));

      await recordEvent({
        providerEventId,
        orderId:order?.id||null,
        eventType,
        resourceId,
        status:payment.status,
        statusDetail:payment.status_detail,
        payload:payment
      });

      if(order)await applyPayment(order,payment);
    }

    /* Subscription created/updated from a preapproval plan checkout. */
    else if(eventType==="subscription_preapproval"){
      const subscription=await mpFetch(
        "/preapproval/"+encodeURIComponent(resourceId)
      );

      const order=
        (await orderByReference(subscription.external_reference))||
        (await orderByPlanId(subscription.preapproval_plan_id));

      await recordEvent({
        providerEventId,
        orderId:order?.id||null,
        eventType,
        resourceId,
        status:subscription.status,
        statusDetail:subscription.status,
        payload:subscription
      });

      if(order){
        await db.query(
          `UPDATE sales_orders
           SET provider_subscription_id=$2,
               subscription_status=$3,
               updated_at=now()
           WHERE id=$1`,
          [
            order.id,
            String(subscription.id||""),
            String(subscription.status||"")
          ]
        );

        const subscriptionState=String(subscription.status||"").toLowerCase();

        if(["cancelled","paused"].includes(subscriptionState)){
          await db.query(
            `UPDATE sales_orders
             SET payment_status='cancelled',
                 payment_status_detail=$2,
                 cancelled_at=COALESCE(cancelled_at,now()),
                 updated_at=now()
             WHERE id=$1`,
            [order.id,"subscription_"+subscriptionState]
          );

          const fresh=(
            await db.query("SELECT * FROM sales_orders WHERE id=$1",[order.id])
          ).rows[0];

          await tryProvision(fresh);
        }
      }
    }

    /* Recurring charge authorized by an existing subscription. */
    else if(eventType==="subscription_authorized_payment"){
      const invoice=await mpFetch(
        "/authorized_payments/"+encodeURIComponent(resourceId)
      );

      const order=
        (await orderByReference(invoice.external_reference))||
        (await orderBySubscriptionId(invoice.preapproval_id));

      const payment=invoice.payment||{};

      await recordEvent({
        providerEventId,
        orderId:order?.id||null,
        eventType,
        resourceId,
        status:payment.status||invoice.summarized||invoice.status,
        statusDetail:
          payment.status_detail||invoice.summarized||invoice.status,
        payload:invoice
      });

      if(order&&payment.status){
        await applyPayment(order,{
          id:payment.id||"",
          status:payment.status,
          status_detail:payment.status_detail||"",
          preapproval_id:
            invoice.preapproval_id||order.provider_subscription_id
        });
      }
    }

    /* Unknown provider events are still retained for audit/debugging. */
    else{
      await recordEvent({
        providerEventId,
        eventType,
        resourceId,
        payload:req.body||{}
      });
    }

    return res.json({received:true});
  }catch(error){
    console.error("mercado_pago_webhook_error",{
      eventType,
      resourceId,
      message:String(error?.message||error)
    });

    return res.status(500).json({
      error:"Falha ao processar a notificação."
    });
  }
}