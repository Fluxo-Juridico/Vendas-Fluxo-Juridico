import { allowMethods } from "../lib/http.js";
import { db } from "@fluxo-juridico/runtime";
import {
  ALLOWED_PLANS,
  clean,
  emailOf,
  digits,
  validEmail,
  validCPF,
  maskCPF,
  BILLING_CONTRACT_VERSION,
  BILLING_CONTRACT_FINGERPRINT,
  seatsFor,
  storageGbFor,
  settings,
  mpFetch,
  upsertLeadForCheckout
} from "../lib/billing.js";
import { enforcePublicRateLimit } from "../lib/rate-limit.js";
import { TERMS_VERSION, PRIVACY_VERSION, acceptedLegalTerms } from "../lib/legal.js";

export const access = "public";
export const methods = ["POST"];

/**
 * Creates an internal sales order and a Mercado Pago subscription-plan checkout.
 *
 * Important:
 * - identity/contact data is validated here;
 * - payment credentials are never handled by this project;
 * - the browser is redirected to Mercado Pago using the returned init_point;
 * - final payment state is confirmed asynchronously by webhook.
 */
export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  if (
    !(await enforcePublicRateLimit(req, res, {
      scope: "sales-checkout-ip",
      limit: 30,
      windowSeconds: 3600
    }))
  )
    return;

  const plan = clean(req.body?.plan, 40);
  const name = clean(req.body?.name, 180);
  const email = emailOf(req.body?.email);
  const cpf = digits(req.body?.cpf);
  const firmName = clean(req.body?.firmName, 180);
  const phone = clean(req.body?.phone, 60);
  const legalAccepted = acceptedLegalTerms(req.body?.acceptTerms);

  /* Request validation before any order/provider side effect. */
  if (!ALLOWED_PLANS.has(plan)) {
    return res.status(400).json({ error: "Plano inválido." });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: "Informe seu nome." });
  }
  if (!validEmail(email)) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  if (!validCPF(cpf)) {
    return res.status(400).json({ error: "Informe um CPF válido." });
  }
  if (!legalAccepted) {
    return res.status(400).json({
      error: "Confirme a leitura e o aceite dos Termos de Uso e da Política de Privacidade."
    });
  }
  if (
    !(await enforcePublicRateLimit(req, res, {
      scope: "sales-checkout-email",
      limit: 8,
      windowSeconds: 3600,
      subject: email
    }))
  )
    return;

  const cfg = await settings();
  const amount = Number(cfg.prices[plan]) || 0;
  const seatLimit = seatsFor(plan, cfg);
  const storageLimitGb = storageGbFor(plan, cfg);

  if (!cfg.enabled) {
    return res.status(503).json({
      error: "A contratação online está temporariamente indisponível. Tente novamente em instantes."
    });
  }
  if (amount <= 0) {
    return res.status(503).json({
      error: "Este plano está temporariamente indisponível para contratação."
    });
  }

  const recent = (
    await db.query(
      `SELECT id,checkout_url,amount_cents,billing_contract_version,seat_limit,storage_limit_gb
       FROM sales_orders
      WHERE lower(buyer_email)=lower($1)
        AND plan=$2
        AND payment_status='pending'
        AND checkout_url<>''
        AND created_at>=now()-interval '15 minutes'
      ORDER BY created_at DESC
      LIMIT 1`,
      [email, plan]
    )
  ).rows[0];

  if (recent?.checkout_url) {
    await db.query(
      "UPDATE sales_orders SET terms_version=$2,privacy_version=$3,terms_accepted_at=now(),updated_at=now() WHERE id=$1",
      [recent.id, TERMS_VERSION, PRIVACY_VERSION]
    );
    return res.json({
      ok: true,
      reused: true,
      orderId: recent.id,
      checkoutUrl: recent.checkout_url,
      plan,
      amountCents: Number(recent.amount_cents) || Math.round(amount * 100),
      contractVersion: recent.billing_contract_version || BILLING_CONTRACT_VERSION,
      contractFingerprint: BILLING_CONTRACT_FINGERPRINT,
      seatLimit: Number(recent.seat_limit) || seatLimit,
      storageLimitGb: Number(recent.storage_limit_gb) || storageLimitGb
    });
  }

  const orderId = crypto.randomUUID();
  const amountCents = Math.round(amount * 100);
  const billingCycle = "monthly";

  try {
    /* Checkout-qualified leads are synchronized with the CRM before the order. */
    const leadId = await upsertLeadForCheckout({
      name,
      email,
      phone,
      firmName,
      plan
    });

    await db.query(
      `INSERT INTO sales_orders (
        id,lead_id,plan,billing_cycle,amount_cents,
        billing_contract_version,seat_limit,storage_limit_gb,
        buyer_name,buyer_email,cpf_masked,cpf_last4,firm_name,phone,payment_status,
        terms_version,privacy_version,terms_accepted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'created',$15,$16,now())`,
      [
        orderId,
        leadId,
        plan,
        billingCycle,
        amountCents,
        BILLING_CONTRACT_VERSION,
        seatLimit,
        storageLimitGb,
        name,
        email,
        maskCPF(cpf),
        cpf.slice(-4),
        firmName,
        phone,
        TERMS_VERSION,
        PRIVACY_VERSION
      ]
    );

    /*
     * A preapproval plan produces a hosted checkout URL without requiring the
     * buyer to be pre-registered as a Mercado Pago payer at creation time.
     */
    const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "")
      .replace(/^https?:\/\//, "")
      .trim();
    if (!host) throw new Error("Host público do checkout não identificado.");
    const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "https")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const protocol = forwardedProto === "http" ? "http" : "https";
    const origin = protocol + "://" + host;

    const checkoutPlan = await mpFetch("/preapproval_plan", {
      method: "POST",
      idempotencyKey: orderId,
      body: {
        reason: "Escritório Digital — Plano " + plan,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL"
        },
        back_url: origin + "/?checkout=return&order=" + encodeURIComponent(orderId)
      }
    });

    const checkoutUrl = String(checkoutPlan.init_point || "");
    const providerPlanId = String(checkoutPlan.id || "");

    if (!checkoutUrl || !providerPlanId) {
      throw new Error("O provedor não retornou um checkout de assinatura válido.");
    }

    await db.query(
      `UPDATE sales_orders
       SET provider_plan_id=$2,
           subscription_status=$3,
           checkout_url=$4,
           payment_status='pending',
           payment_status_detail='awaiting_payment',
           updated_at=now()
       WHERE id=$1`,
      [orderId, providerPlanId, String(checkoutPlan.status || "active"), checkoutUrl]
    );

    return res.status(201).json({
      ok: true,
      orderId,
      checkoutUrl,
      plan,
      amountCents,
      contractVersion: BILLING_CONTRACT_VERSION,
      contractFingerprint: BILLING_CONTRACT_FINGERPRINT,
      seatLimit,
      storageLimitGb,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION
    });
  } catch (error) {
    const internalMessage = clean(error?.message || error, 500);

    // The order may not exist yet if lead/order creation failed.
    try {
      await db.query(
        "UPDATE sales_orders SET payment_status='checkout_error',failure_reason=$2,updated_at=now() WHERE id=$1",
        [orderId, internalMessage]
      );
    } catch {
      console.warn("checkout_failure_update_skipped", { orderId });
    }

    console.error("checkout_create_failed", {
      orderId,
      plan,
      message: internalMessage
    });

    return res.status(error?.code === "billing_setup_required" ? 503 : 502).json({
      error:
        "Não foi possível abrir o pagamento agora. Nenhuma cobrança foi realizada. Tente novamente em instantes."
    });
  }
}
