import { db, config, webhooks } from "@fluxo-juridico/runtime";
import {
  PLAN_CATALOG,
  BILLING_CONTRACT_VERSION,
  BILLING_CONTRACT_FINGERPRINT
} from "../../../contracts/billing-v1.js";
import {
  SUBSCRIPTION_MANAGEMENT_VERSION,
  SUBSCRIPTION_MANAGEMENT_ACTIONS,
  canonicalSubscriptionManagementSignature
} from "../../../contracts/subscription-management-v1.js";
import {
  clean,
  mpFetch,
  normalizePaymentStatus,
  settings,
  signedBridgeRequest,
  tryProvision
} from "../../lib/billing.js";
import { allowMethods } from "../../lib/http.js";

export const access = "public";
export const methods = ["POST"];

const GB = 1024 * 1024 * 1024;

function fail(res, status, error, code = "subscription_management_error", extra = {}) {
  return res.status(status).json({ error, code, ...extra });
}

function safeProviderView(provider = {}) {
  return {
    status: clean(provider.status, 40),
    nextPaymentDate: clean(provider.next_payment_date, 80),
    lastModified: clean(provider.last_modified, 80),
    paymentMethod: clean(provider.payment_method_id, 60),
    amount: Number(provider?.auto_recurring?.transaction_amount) || 0,
    currency: clean(provider?.auto_recurring?.currency_id || "BRL", 10),
    version: Number(provider.version) || 0
  };
}

async function verifyRequest(req, body) {
  const timestamp = String(req.headers?.["x-subscription-timestamp"] || "");
  const signature = String(req.headers?.["x-subscription-signature"] || "");
  const ts = Number(timestamp);
  const secret = String((await config.get("BILLING_BRIDGE_SECRET")) || "").trim();
  if (!secret)
    throw Object.assign(new Error("Ponte de cobrança não configurada."), {
      status: 503,
      code: "billing_bridge_not_configured"
    });
  if (!timestamp || !signature || !Number.isFinite(ts))
    throw Object.assign(new Error("Autenticação da gestão de assinatura ausente."), {
      status: 401,
      code: "subscription_signature_missing"
    });
  const raw = canonicalSubscriptionManagementSignature({
    timestamp,
    version: body.version,
    requestId: body.requestId,
    organizationId: body.organizationId,
    email: body.email,
    action: body.action,
    targetPlan: body.targetPlan
  });
  const ok = await webhooks.verifyHmac({
    raw,
    signature,
    secret,
    algorithm: "sha256",
    encoding: "hex",
    timestamp: ts,
    tolerance: 300
  });
  if (!ok)
    throw Object.assign(new Error("Autenticação da gestão de assinatura inválida."), {
      status: 401,
      code: "subscription_signature_invalid"
    });
}

async function billingContext({ organizationId, email }) {
  const account = (
    await db.query(
      "SELECT email,status,organization_id,subscription_plan,seat_limit,storage_limit_bytes,source_order_id FROM platform_accounts WHERE organization_id=$1::uuid AND lower(email)=lower($2) LIMIT 1",
      [organizationId, email]
    )
  ).rows[0];
  if (!account)
    throw Object.assign(new Error("Assinatura não vinculada a este escritório."), {
      status: 404,
      code: "subscription_not_found"
    });

  let order = null;
  if (account.source_order_id) {
    order =
      (
        await db.query(
          "SELECT * FROM sales_orders WHERE id::text=$1 AND lower(buyer_email)=lower($2) LIMIT 1",
          [String(account.source_order_id), account.email]
        )
      ).rows[0] || null;
  }
  if (!order) {
    const fallback = (
      await db.query(
        "SELECT * FROM sales_orders WHERE lower(buyer_email)=lower($1) AND ($2='' OR plan=$2) ORDER BY (COALESCE(provider_subscription_id,'')<>'') DESC,paid_at DESC NULLS LAST,created_at DESC LIMIT 2",
        [account.email, clean(account.subscription_plan, 60)]
      )
    ).rows;
    order = fallback.length === 1 ? fallback[0] : null;
  }
  return { account, order };
}

async function currentUsage(organizationId) {
  const [seats, storage] = await Promise.all([
    db.query(
      "SELECT count(*)::int AS used FROM office_memberships WHERE organization_id=$1::uuid AND active=true",
      [organizationId]
    ),
    db.query(
      "SELECT COALESCE(sum(size_bytes),0)::bigint AS used FROM office_files WHERE organization_id=$1::uuid",
      [organizationId]
    )
  ]);
  return {
    seats: Number(seats.rows[0]?.used) || 0,
    storageBytes: Number(storage.rows[0]?.used) || 0
  };
}

async function providerFor(order) {
  const id = clean(order?.provider_subscription_id, 160);
  if (!id) return null;
  return mpFetch("/preapproval/" + encodeURIComponent(id));
}

async function syncMain({ order, account, action, plan, provider, requestId }) {
  const cfg = await settings();
  if (!cfg.saasBaseUrl)
    throw Object.assign(new Error("Destino do SaaS não configurado."), {
      code: "saas_base_url_missing"
    });
  const catalog = PLAN_CATALOG[plan] || null;
  const seats = catalog?.seats ?? (Number(account.seat_limit) || 0);
  const storageGb =
    catalog?.storageGb ?? Math.round((Number(account.storage_limit_bytes) || 0) / GB);
  const providerId = clean(order?.provider_subscription_id, 160);
  const providerVersion = Number(provider?.version) || 0;
  const eventId = [
    String(order?.id || account.source_order_id || "subscription"),
    "management",
    action,
    plan || account.subscription_plan || "",
    providerId,
    providerVersion
  ].join(":");

  const response = await signedBridgeRequest(cfg.saasBaseUrl + "/api/billing-provision", {
    eventId,
    orderId: order?.id || account.source_order_id || "",
    action,
    paymentStatus: action === "block" ? "cancelled" : "approved",
    paymentStatusDetail: "subscription_management",
    email: account.email,
    plan: plan || account.subscription_plan || "",
    contractVersion: BILLING_CONTRACT_VERSION,
    contractFingerprint: BILLING_CONTRACT_FINGERPRINT,
    seats,
    storageGb,
    provider: "mercado_pago",
    providerPaymentId: order?.provider_payment_id || "",
    providerSubscriptionId: providerId,
    managementRequestId: requestId
  });
  if (!response.ok)
    throw Object.assign(new Error("O SaaS respondeu " + response.status), {
      code: "saas_sync_failed"
    });
  return true;
}

async function recordManagementEvent({
  requestId,
  order,
  action,
  status,
  targetPlan,
  organizationId,
  syncPending
}) {
  await db.query(
    `INSERT INTO sales_payment_events (
       provider_event_id,order_id,event_type,resource_id,status,status_detail,payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (provider_event_id) DO NOTHING`,
    [
      "management:" + requestId,
      order?.id || null,
      "subscription_management_" + action,
      clean(order?.provider_subscription_id, 160),
      clean(status, 60),
      clean(targetPlan, 60),
      JSON.stringify({
        version: SUBSCRIPTION_MANAGEMENT_VERSION,
        organizationId,
        targetPlan: targetPlan || "",
        syncPending: Boolean(syncPending)
      })
    ]
  );
}

export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  const body = req.body || {};
  const version = clean(body.version, 80);
  const requestId = clean(body.requestId, 128);
  const organizationId = clean(body.organizationId, 80);
  const email = clean(body.email, 180).toLowerCase();
  const action = clean(body.action, 40);
  const targetPlan = clean(body.targetPlan, 60);

  try {
    if (version !== SUBSCRIPTION_MANAGEMENT_VERSION) {
      return fail(
        res,
        409,
        "Contrato de gestão de assinatura incompatível.",
        "subscription_contract_mismatch",
        { expectedVersion: SUBSCRIPTION_MANAGEMENT_VERSION }
      );
    }
    if (!requestId || !organizationId || !email || !SUBSCRIPTION_MANAGEMENT_ACTIONS.has(action)) {
      return fail(
        res,
        400,
        "Solicitação de gestão de assinatura inválida.",
        "subscription_request_invalid"
      );
    }
    if (action === "change_plan" && !PLAN_CATALOG[targetPlan]) {
      return fail(res, 400, "Plano de destino inválido.", "subscription_plan_invalid");
    }

    await verifyRequest(req, { version, requestId, organizationId, email, action, targetPlan });
    const { account, order } = await billingContext({ organizationId, email });

    if (action === "inspect") {
      let syncPending = clean(order?.provisioning_status, 40) === "retry";
      let syncRecovered = false;
      const updatedAt = order?.updated_at ? new Date(order.updated_at).getTime() : 0;
      const retryOldEnough = !Number.isFinite(updatedAt) || Date.now() - updatedAt >= 15000;
      if (syncPending && order && retryOldEnough) {
        try {
          syncRecovered = await tryProvision(order);
          if (syncRecovered) syncPending = false;
        } catch (error) {
          console.warn("subscription_sync_recovery_failed", {
            requestId,
            organizationId,
            message: clean(error?.message || error, 240)
          });
        }
      }

      let provider = null;
      let providerUnavailable = false;
      try {
        provider = await providerFor(order);
      } catch (error) {
        providerUnavailable = true;
        console.warn("subscription_provider_inspect_failed", {
          requestId,
          organizationId,
          message: clean(error?.message || error, 240)
        });
      }
      return res.json({
        ok: true,
        version: SUBSCRIPTION_MANAGEMENT_VERSION,
        provider: provider ? safeProviderView(provider) : null,
        providerUnavailable,
        managementReady: Boolean(order?.provider_subscription_id) && !providerUnavailable,
        checkoutUrl: clean(order?.checkout_url, 1000),
        syncPending,
        syncRecovered
      });
    }

    if (account.status !== "active") {
      return fail(
        res,
        409,
        "A assinatura não está ativa para alterações.",
        "subscription_not_active"
      );
    }
    if (!order?.provider_subscription_id) {
      return fail(
        res,
        409,
        "A cobrança recorrente ainda não está vinculada a uma assinatura do Mercado Pago.",
        "provider_subscription_missing"
      );
    }

    if (action === "change_plan") {
      const target = PLAN_CATALOG[targetPlan];
      const usage = await currentUsage(organizationId);
      if (usage.seats > target.seats) {
        return fail(
          res,
          409,
          "O plano escolhido possui menos acessos do que os atualmente utilizados.",
          "seat_limit_conflict",
          { used: usage.seats, limit: target.seats }
        );
      }
      if (usage.storageBytes > target.storageGb * GB) {
        return fail(
          res,
          409,
          "O plano escolhido possui menos armazenamento do que o atualmente utilizado.",
          "storage_limit_conflict",
          { usedBytes: usage.storageBytes, limitBytes: target.storageGb * GB }
        );
      }
      if (String(account.subscription_plan || "") === targetPlan) {
        const provider = await providerFor(order).catch(() => null);
        return res.json({
          ok: true,
          idempotent: true,
          plan: targetPlan,
          provider: provider ? safeProviderView(provider) : null
        });
      }

      const before = await providerFor(order);
      const beforeStatus = clean(before?.status, 40).toLowerCase();
      if (["canceled", "cancelled"].includes(beforeStatus)) {
        return fail(
          res,
          409,
          "A assinatura já está cancelada no provedor.",
          "provider_subscription_cancelled"
        );
      }

      const provider = await mpFetch(
        "/preapproval/" + encodeURIComponent(order.provider_subscription_id),
        {
          method: "PUT",
          idempotencyKey: requestId,
          body: {
            auto_recurring: {
              transaction_amount: target.price,
              currency_id: "BRL"
            }
          }
        }
      );

      const fresh = (
        await db.query(
          `UPDATE sales_orders
            SET plan=$2,
                amount_cents=$3,
                billing_contract_version=$4,
                seat_limit=$5,
                storage_limit_gb=$6,
                subscription_status=$7,
                updated_at=now()
          WHERE id=$1
          RETURNING *`,
          [
            order.id,
            targetPlan,
            Math.round(target.price * 100),
            BILLING_CONTRACT_VERSION,
            target.seats,
            target.storageGb,
            clean(provider.status, 60)
          ]
        )
      ).rows[0];

      let syncPending = false;
      try {
        await syncMain({
          order: fresh,
          account,
          action: "activate",
          plan: targetPlan,
          provider,
          requestId
        });
        await db.query(
          "UPDATE sales_orders SET provisioning_status='activated',automation_action='activate',failure_reason='',updated_at=now() WHERE id=$1",
          [order.id]
        );
      } catch (error) {
        syncPending = true;
        await db.query(
          "UPDATE sales_orders SET provisioning_status='retry',automation_action='activate',failure_reason=$2,updated_at=now() WHERE id=$1",
          [order.id, clean(error?.message || error, 500)]
        );
      }

      await recordManagementEvent({
        requestId,
        order: fresh,
        action,
        status: provider.status,
        targetPlan,
        organizationId,
        syncPending
      });
      return res.status(syncPending ? 202 : 200).json({
        ok: true,
        plan: targetPlan,
        syncPending,
        provider: safeProviderView(provider)
      });
    }

    const before = await providerFor(order);
    const alreadyCancelled = ["canceled", "cancelled"].includes(
      clean(before?.status, 40).toLowerCase()
    );
    const provider = alreadyCancelled
      ? before
      : await mpFetch("/preapproval/" + encodeURIComponent(order.provider_subscription_id), {
          method: "PUT",
          idempotencyKey: requestId,
          body: { status: "canceled" }
        });
    const internalStatus = normalizePaymentStatus(provider?.status || "canceled");

    const fresh = (
      await db.query(
        `UPDATE sales_orders
          SET payment_status='cancelled',
              payment_status_detail='subscription_cancelled_by_owner',
              subscription_status=$2,
              cancelled_at=COALESCE(cancelled_at,now()),
              updated_at=now()
        WHERE id=$1
        RETURNING *`,
        [order.id, clean(provider.status || "canceled", 60)]
      )
    ).rows[0];

    let syncPending = false;
    try {
      await syncMain({
        order: fresh,
        account,
        action: "block",
        plan: account.subscription_plan,
        provider,
        requestId
      });
      await db.query(
        "UPDATE sales_orders SET provisioning_status='blocked',automation_action='block',failure_reason='',updated_at=now() WHERE id=$1",
        [order.id]
      );
    } catch (error) {
      syncPending = true;
      await db.query(
        "UPDATE sales_orders SET provisioning_status='retry',automation_action='block',failure_reason=$2,updated_at=now() WHERE id=$1",
        [order.id, clean(error?.message || error, 500)]
      );
    }

    await recordManagementEvent({
      requestId,
      order: fresh,
      action,
      status: internalStatus,
      targetPlan: "",
      organizationId,
      syncPending
    });
    return res.status(syncPending ? 202 : 200).json({
      ok: true,
      cancelled: true,
      syncPending,
      provider: safeProviderView(provider)
    });
  } catch (error) {
    console.error("subscription_management_failed", {
      requestId,
      organizationId,
      action,
      message: clean(error?.message || error, 300)
    });
    return fail(
      res,
      Number(error?.status) || 500,
      Number(error?.status) >= 400 && Number(error?.status) < 500
        ? clean(error?.message, 240)
        : "Não foi possível concluir a gestão da assinatura.",
      clean(error?.code, 80) || "subscription_management_failed"
    );
  }
}
