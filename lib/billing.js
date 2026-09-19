import {db,config} from "hatchable";

/**
 * Billing domain shared by checkout, webhooks and provisioning.
 *
 * Keep plan defaults here. Runtime environment configuration may override prices,
 * seat limits and storage limits without changing application code.
 */
export const BILLING_CONTRACT_VERSION="billing-v1";

export const PLAN_DEFAULTS=Object.freeze({
  Solo:Object.freeze({price:99,seats:2,storageGb:5}),
  Essencial:Object.freeze({price:197,seats:3,storageGb:15}),
  Profissional:Object.freeze({price:297,seats:10,storageGb:25}),
  Premium:Object.freeze({price:497,seats:20,storageGb:100})
});

export const ALLOWED_PLANS=new Set(Object.keys(PLAN_DEFAULTS));

/* --------------------------------------------------------------------------
   Input normalization and validation
   -------------------------------------------------------------------------- */
export const clean=(value,max=500)=>String(value??"").trim().slice(0,max);
export const emailOf=value=>clean(value,180).toLowerCase();
export const digits=value=>String(value??"").replace(/\D/g,"");
export const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function validCPF(value){
  const cpf=digits(value);
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;

  const matchesDigit=length=>{
    let sum=0;
    for(let i=0;i<length;i++)sum+=Number(cpf[i])*(length+1-i);
    const remainder=(sum*10)%11;
    return (remainder===10?0:remainder)===Number(cpf[length]);
  };

  return matchesDigit(9)&&matchesDigit(10);
}

export function maskCPF(value){
  const cpf=digits(value);
  return cpf.length===11?"***."+cpf.slice(3,6)+"."+cpf.slice(6,9)+"-**":"";
}

/* --------------------------------------------------------------------------
   Payment/provisioning state mapping
   -------------------------------------------------------------------------- */
export function normalizePaymentStatus(status){
  const normalized=String(status||"").toLowerCase();
  if(normalized==="approved")return "approved";
  if(["pending","in_process","authorized"].includes(normalized))return "pending";
  if(normalized==="rejected")return "rejected";
  if(normalized==="refunded")return "refunded";
  if(normalized==="charged_back")return "charged_back";
  if(normalized==="cancelled")return "cancelled";
  if(normalized==="in_mediation")return "in_mediation";
  return normalized||"unknown";
}

export function automationFor(status){
  if(status==="approved")return "activate";
  if(["refunded","charged_back","cancelled"].includes(status))return "block";
  if(status==="in_mediation")return "review";
  return "none";
}

export function planForOrder(order){
  return String(order?.plan||"");
}

export function seatsFor(plan,limits={}){
  const fallback=PLAN_DEFAULTS[plan]?.seats||3;
  return Math.max(1,Number(limits?.seats?.[plan])||fallback);
}

export function storageGbFor(plan,limits={}){
  const fallback=PLAN_DEFAULTS[plan]?.storageGb||5;
  return Math.max(1,Number(limits?.storageGb?.[plan])||fallback);
}

export function entitlementFor(order,limits={}){
  const plan=planForOrder(order);
  const storedSeats=Math.trunc(Number(order?.seat_limit));
  const storedStorageGb=Math.trunc(Number(order?.storage_limit_gb));
  return {
    contractVersion:clean(order?.billing_contract_version,60)||BILLING_CONTRACT_VERSION,
    seatLimit:storedSeats>0?storedSeats:seatsFor(plan,limits),
    storageLimitGb:storedStorageGb>0?storedStorageGb:storageGbFor(plan,limits)
  };
}

/* --------------------------------------------------------------------------
   Runtime billing configuration
   -------------------------------------------------------------------------- */
export async function settings(){
  const values=await Promise.all([
    config.get("checkout_enabled"),
    config.get("auto_activate_on_approved"),

    config.get("plan_solo_price"),
    config.get("plan_essencial_price"),
    config.get("plan_profissional_price"),
    config.get("plan_premium_price"),

    config.get("plan_solo_seats"),
    config.get("plan_essencial_seats"),
    config.get("plan_profissional_seats"),
    config.get("plan_premium_seats"),

    config.get("plan_solo_storage_gb"),
    config.get("plan_essencial_storage_gb"),
    config.get("plan_profissional_storage_gb"),
    config.get("plan_premium_storage_gb"),

    config.get("saas_base_url"),
    config.get("MERCADO_PAGO_ACCESS_TOKEN"),
    config.get("MERCADO_PAGO_WEBHOOK_SECRET"),
    config.get("BILLING_BRIDGE_SECRET")
  ]);

  const billingReady=Boolean(values[14])&&Boolean(values[15])&&Boolean(values[16])&&Boolean(values[17]);

  return {
    // Explicit switch wins, but a fully configured billing stack is considered ready.
    enabled:Boolean(values[0])||billingReady,
    autoActivate:values[1]!==false,
    saasBaseUrl:String(values[14]||"").replace(/\/$/,""),

    prices:{
      Solo:Number(values[2])||PLAN_DEFAULTS.Solo.price,
      Essencial:Number(values[3])||PLAN_DEFAULTS.Essencial.price,
      Profissional:Number(values[4])||PLAN_DEFAULTS.Profissional.price,
      Premium:Number(values[5])||PLAN_DEFAULTS.Premium.price
    },
    seats:{
      Solo:Number(values[6])||PLAN_DEFAULTS.Solo.seats,
      Essencial:Number(values[7])||PLAN_DEFAULTS.Essencial.seats,
      Profissional:Number(values[8])||PLAN_DEFAULTS.Profissional.seats,
      Premium:Number(values[9])||PLAN_DEFAULTS.Premium.seats
    },
    storageGb:{
      Solo:Number(values[10])||PLAN_DEFAULTS.Solo.storageGb,
      Essencial:Number(values[11])||PLAN_DEFAULTS.Essencial.storageGb,
      Profissional:Number(values[12])||PLAN_DEFAULTS.Profissional.storageGb,
      Premium:Number(values[13])||PLAN_DEFAULTS.Premium.storageGb
    }
  };
}

/* --------------------------------------------------------------------------
   Mercado Pago client
   -------------------------------------------------------------------------- */
export async function mpFetch(path,{method="GET",body}={}){
  const token=await config.get("MERCADO_PAGO_ACCESS_TOKEN");
  if(!token){
    throw Object.assign(new Error("Mercado Pago ainda não configurado."),{
      code:"billing_setup_required"
    });
  }

  const response=await fetch("https://api.mercadopago.com"+path,{
    method,
    headers:{
      Authorization:"Bearer "+token,
      "Content-Type":"application/json"
    },
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(15000)
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const providerMessage=clean(data?.message||data?.error||"erro sem descrição",240);
    const cause=Array.isArray(data?.cause)
      ?clean(data.cause.map(item=>item?.description||item?.code||"").filter(Boolean).join(" | "),240)
      :"";
    const diagnostic="Mercado Pago "+response.status+": "+providerMessage+(cause?" | "+cause:"");

    // Internal diagnostic only. Public checkout routes return a safe generic error.
    console.error("mercado_pago_error",diagnostic);
    throw Object.assign(new Error(diagnostic),{
      code:"provider_error",
      status:response.status
    });
  }

  return data;
}

/* --------------------------------------------------------------------------
   Signed bridge: sales/billing -> main SaaS
   -------------------------------------------------------------------------- */
async function hmacHex(secret,message){
  const key=await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},
    false,
    ["sign"]
  );
  const signature=await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  return [...new Uint8Array(signature)]
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

export async function signedBridgeRequest(url,payload){
  const secret=await config.get("BILLING_BRIDGE_SECRET");
  if(!secret){
    throw Object.assign(new Error("Ponte de cobrança ainda não configurada."),{
      code:"bridge_setup_required"
    });
  }

  const timestamp=String(Math.floor(Date.now()/1000));
  const canonical=[
    timestamp,
    payload.eventId||"",
    payload.orderId||"",
    payload.action||"",
    String(payload.email||"").toLowerCase(),
    payload.contractVersion||"",
    payload.plan||"",
    payload.seats||"",
    payload.storageGb||""
  ].join(".");

  const signature=await hmacHex(secret,canonical);

  return fetch(url,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Billing-Timestamp":timestamp,
      "X-Billing-Signature":signature
    },
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(12000)
  });
}

/**
 * Synchronize a terminal/review payment state with the main SaaS.
 * Failed calls are marked as retryable and picked up by the scheduled job.
 */
export async function tryProvision(order){
  const cfg=await settings();
  const status=normalizePaymentStatus(order.payment_status);
  const action=automationFor(status);

  if(action==="none"||(action==="activate"&&!cfg.autoActivate))return false;

  const plan=planForOrder(order);
  const entitlement=entitlementFor(order,cfg);

  if(!cfg.saasBaseUrl){
    await db.query(
      "UPDATE sales_orders SET provisioning_status='retry',automation_action=$2,failure_reason=$3,updated_at=now() WHERE id=$1",
      [order.id,action,"SAAS_BASE_URL não configurada."]
    );
    return false;
  }

  try{
    const payload={
      eventId:String(order.id)+":"+status+":"+(order.provider_payment_id||order.provider_subscription_id||""),
      orderId:order.id,
      action,
      paymentStatus:status,
      paymentStatusDetail:order.payment_status_detail||"",
      name:order.buyer_name,
      email:order.buyer_email,
      firmName:order.firm_name,
      plan,
      contractVersion:entitlement.contractVersion,
      seats:entitlement.seatLimit,
      storageGb:entitlement.storageLimitGb,
      provider:"mercado_pago",
      providerPaymentId:order.provider_payment_id||"",
      providerSubscriptionId:order.provider_subscription_id||""
    };

    const response=await signedBridgeRequest(
      cfg.saasBaseUrl+"/api/billing-provision",
      payload
    );

    if(!response.ok)throw new Error("SaaS respondeu "+response.status);

    const provisioningStatus=
      action==="activate"?"activated":
      action==="block"?"blocked":
      "review";

    await db.query(
      "UPDATE sales_orders SET provisioning_status=$2,automation_action=$3,failure_reason='',updated_at=now() WHERE id=$1",
      [order.id,provisioningStatus,action]
    );

    return true;
  }catch(error){
    console.warn("billing_provision_retry",{
      orderId:order.id,
      message:String(error?.message||error)
    });

    await db.query(
      "UPDATE sales_orders SET provisioning_status='retry',automation_action=$2,failure_reason=$3,updated_at=now() WHERE id=$1",
      [order.id,action,clean(error?.message,500)]
    );

    return false;
  }
}

/* --------------------------------------------------------------------------
   Lead synchronization
   -------------------------------------------------------------------------- */
export async function upsertLeadForCheckout({name,email,phone,firmName,plan}){
  const found=await db.query(
    "SELECT id FROM sales_leads WHERE lower(email)=lower($1) ORDER BY created_at DESC LIMIT 1",
    [email]
  );

  if(found.rows[0]){
    await db.query(
      "UPDATE sales_leads SET name=$2,phone=$3,firm_name=$4,status=CASE WHEN status IN ('won','lost') THEN status ELSE 'qualified' END,notes=CASE WHEN notes='' THEN $5 ELSE notes END,updated_at=now() WHERE id=$1",
      [
        found.rows[0].id,
        name,
        phone,
        firmName,
        "Checkout iniciado — plano "+plan
      ]
    );
    return found.rows[0].id;
  }

  const id=crypto.randomUUID();
  await db.query(
    "INSERT INTO sales_leads (id,name,email,phone,firm_name,status,source,message) VALUES ($1,$2,$3,$4,$5,'qualified','checkout',$6)",
    [id,name,email,phone,firmName,"Checkout iniciado — plano "+plan]
  );

  return id;
}