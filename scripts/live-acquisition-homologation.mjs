import postgres from "postgres";

const stage = String(process.env.LIVE_STAGE || "preflight").trim();
const orderId = String(process.env.LIVE_ORDER_ID || "").trim();
const base = String(process.env.SALES_BASE_URL || "https://vendas-lilac.vercel.app").replace(/\/$/, "");
const databaseUrl = String(process.env.LIVE_DATABASE_URL || "").trim();

const allowedStages = new Set(["preflight", "order", "provisioned", "first-access"]);
if (!allowedStages.has(stage)) throw new Error(`Unknown LIVE_STAGE: ${stage}`);
if (!base.startsWith("https://")) throw new Error("SALES_BASE_URL must be an https URL.");

async function getJson(path) {
  const response = await fetch(base + path, {
    redirect: "follow",
    headers: { "user-agent": "fluxo-juridico-live-homologation/1.0" }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function requirePublicPage(path) {
  const response = await fetch(base + path, {
    redirect: "follow",
    headers: { "user-agent": "fluxo-juridico-live-homologation/1.0" }
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
}

const health = await getJson("/api/health");
if (health?.status !== "ok" || health?.service !== "fluxo-juridico-vendas") {
  throw new Error("Sales health contract is not ready.");
}
if (health?.release?.billingContract !== "billing-v1") {
  throw new Error("Unexpected billing contract in production.");
}

const billing = await getJson("/api/billing-config");
if (!billing?.enabled) throw new Error("Online billing is disabled in production.");
for (const name of ["Solo", "Essencial", "Profissional", "Premium"]) {
  const plan = billing?.plans?.[name];
  if (!plan || Number(plan.price) <= 0 || Number(plan.seats) <= 0 || Number(plan.storageGb) <= 0) {
    throw new Error(`Invalid production plan configuration: ${name}`);
  }
}

await requirePublicPage("/termos.html");
await requirePublicPage("/privacidade.html");

const result = {
  ok: true,
  stage,
  release: {
    commitSha: String(health?.release?.commitSha || ""),
    migrationVersion: String(health?.release?.migrationVersion || ""),
    billingContract: String(health?.release?.billingContract || "")
  },
  billingEnabled: true,
  legalPages: true
};

if (stage === "preflight") {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
  throw new Error("LIVE_ORDER_ID must contain the UUID of a real controlled test order.");
}
if (!databaseUrl) {
  throw new Error("LIVE_DATABASE_URL is required for order/provisioning verification.");
}

const status = await getJson("/api/payment-status?order=" + encodeURIComponent(orderId));
const sql = postgres(databaseUrl, {
  ssl: "require",
  prepare: false,
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10
});

try {
  const rows = await sql.unsafe(
    `select
       o.id,
       o.payment_status,
       o.payment_status_detail,
       o.subscription_status,
       o.provisioning_status,
       o.provider_subscription_id,
       o.terms_version,
       o.privacy_version,
       o.terms_accepted_at,
       p.status as account_status,
       p.provisioning_state as account_provisioning_state,
       p.organization_id,
       p.auth_user_id,
       org.subscription_plan,
       org.seat_limit,
       org.storage_limit_bytes,
       exists(
         select 1
         from public.office_memberships m
         where m.organization_id=p.organization_id
           and m.user_id=p.auth_user_id
           and m.active=true
           and upper(m.role) in ('OWNER','OWNER_LAWYER')
       ) as owner_membership,
       u.last_sign_in_at
     from sales.sales_orders o
     left join billing.platform_accounts p on lower(p.email)=lower(o.buyer_email)
     left join public.office_organizations org on org.id=p.organization_id
     left join auth.users u on u.id=p.auth_user_id
     where o.id=$1::uuid
     limit 1`,
    [orderId]
  );

  const row = rows[0];
  if (!row) throw new Error("Controlled test order was not found in the production database.");
  if (!row.terms_version || !row.privacy_version || !row.terms_accepted_at) {
    throw new Error("Order does not contain versioned legal acceptance.");
  }

  Object.assign(result, {
    orderId,
    publicStatus: String(status?.status || ""),
    databaseStatus: String(row.payment_status || ""),
    provisioningStatus: String(row.provisioning_status || ""),
    subscriptionLinked: Boolean(row.provider_subscription_id),
    legalAcceptanceRecorded: true
  });

  if (stage === "order") {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (row.payment_status !== "approved") {
    throw new Error(`Expected approved payment, got ${row.payment_status || "empty"}.`);
  }
  if (!row.provider_subscription_id) throw new Error("Approved order has no provider subscription id.");
  if (row.provisioning_status !== "activated") {
    throw new Error(`Expected activated provisioning, got ${row.provisioning_status || "empty"}.`);
  }
  if (row.account_status !== "active" || row.account_provisioning_state !== "provisioned") {
    throw new Error("Billing platform account is not active/provisioned.");
  }
  if (!row.organization_id || !row.auth_user_id || !row.owner_membership) {
    throw new Error("Provisioning did not create/link organization, Auth identity and Owner membership.");
  }
  if (!row.subscription_plan || Number(row.seat_limit) <= 0 || Number(row.storage_limit_bytes) <= 0) {
    throw new Error("Provisioned organization does not have valid plan entitlements.");
  }

  Object.assign(result, {
    provisioned: true,
    accountActive: true,
    authIdentityLinked: true,
    ownerMembershipActive: true,
    planEntitlementsApplied: true
  });

  if (stage === "provisioned") {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (!row.last_sign_in_at) {
    throw new Error("The provisioned owner has not completed a real first sign-in yet.");
  }

  result.firstAccessConfirmed = true;
  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
