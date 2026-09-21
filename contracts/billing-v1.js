export const BILLING_CONTRACT_VERSION="billing-v1";
export const BILLING_CONTRACT_FINGERPRINT="1f0e72cd882c2fc5d4ae3b622340a8a2d06dddaf53592768b383768c16f8e158";

export const PLAN_CATALOG=Object.freeze({
  Solo:Object.freeze({price:99,seats:2,storageGb:5}),
  Essencial:Object.freeze({price:197,seats:3,storageGb:15}),
  Profissional:Object.freeze({price:297,seats:10,storageGb:25}),
  Premium:Object.freeze({price:497,seats:20,storageGb:100})
});

export const PLAN_NAMES=new Set(Object.keys(PLAN_CATALOG));
export const BILLING_ACTIONS=new Set(["activate","block","review"]);
export const PAYMENT_STATUSES=new Set([
  "created","pending","approved","rejected","refunded",
  "charged_back","cancelled","in_mediation","checkout_error","unknown"
]);
export const PROVISIONING_STATUSES=new Set([
  "not_ready","retry","activated","blocked","review"
]);
export const BILLING_EVENT_REQUIRED_FIELDS=Object.freeze([
  "eventId","orderId","action","email","contractVersion",
  "contractFingerprint","plan","seats","storageGb"
]);

export const BILLING_EVENT_SCHEMA=Object.freeze({
  version:BILLING_CONTRACT_VERSION,
  required:BILLING_EVENT_REQUIRED_FIELDS,
  fields:Object.freeze({
    eventId:"string",
    orderId:"string",
    action:"activate|block|review",
    paymentStatus:"string",
    paymentStatusDetail:"string",
    email:"email",
    name:"string",
    firmName:"string",
    plan:"Solo|Essencial|Profissional|Premium",
    contractVersion:BILLING_CONTRACT_VERSION,
    contractFingerprint:BILLING_CONTRACT_FINGERPRINT,
    seats:"positive_integer",
    storageGb:"positive_integer",
    provider:"string",
    providerPaymentId:"string",
    providerSubscriptionId:"string"
  })
});

export function planDefaults(plan){
  return PLAN_CATALOG[plan]||null;
}

export function canonicalBillingSignature({
  timestamp,eventId,orderId,action,email,contractVersion,
  contractFingerprint,plan,seats,storageGb
}){
  return [
    String(timestamp||""),
    String(eventId||""),
    String(orderId||""),
    String(action||""),
    String(email||"").trim().toLowerCase(),
    String(contractVersion||""),
    String(contractFingerprint||""),
    String(plan||""),
    seats??"",
    storageGb??""
  ].join(".");
}

export function automationForPaymentStatus(status){
  const value=String(status||"").toLowerCase();
  if(value==="approved")return "activate";
  if(["refunded","charged_back","cancelled"].includes(value))return "block";
  if(value==="in_mediation")return "review";
  return "none";
}

export function contractDescriptor(){
  return "billing-v1|Solo:99:2:5|Essencial:197:3:15|Profissional:297:10:25|Premium:497:20:100|actions:activate,block,review|payment:created,pending,approved,rejected,refunded,charged_back,cancelled,in_mediation,checkout_error,unknown|provisioning:not_ready,retry,activated,blocked,review";
}
