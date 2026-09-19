import {allowMethods} from "../../lib/http.js";
import {db,config,webhooks} from "@fluxo-juridico/runtime";

export const access="public";
export const methods=["GET"];

function mapLead(row){
  return {
    id:row.id,
    name:row.name,
    email:row.email,
    phone:row.phone,
    firmName:row.firm_name,
    teamSize:row.team_size,
    message:row.message,
    status:row.status,
    source:row.source,
    attribution:row.attribution||{},
    notes:row.notes||"",
    nextFollowup:row.next_followup,
    demoAt:row.demo_at,
    convertedAt:row.converted_at,
    lostReason:row.lost_reason||"",
    createdAt:row.created_at,
    updatedAt:row.updated_at
  };
}

/**
 * HMAC-protected CRM export consumed only by the administrative project.
 * The sales database remains the source of truth for leads.
 */
export default async function(req,res){
  if(!allowMethods(req,res,methods))return;
  const secret=await config.get("BILLING_BRIDGE_SECRET");
  if(!secret){
    return res.status(503).json({error:"Ponte entre projetos não configurada."});
  }

  const timestamp=String(req.headers?.["x-bridge-timestamp"]||"");
  const signature=String(req.headers?.["x-bridge-signature"]||"");
  const numericTimestamp=Number(timestamp);

  if(!timestamp||!signature||!Number.isFinite(numericTimestamp)){
    return res.status(401).json({error:"Assinatura ausente."});
  }

  const valid=await webhooks.verifyHmac({
    raw:timestamp+".crm-export",
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
    "SELECT * FROM sales_leads ORDER BY created_at DESC LIMIT 500"
  );

  res.setHeader("Cache-Control","private, no-store");
  return res.json({items:rows.map(mapLead)});
}