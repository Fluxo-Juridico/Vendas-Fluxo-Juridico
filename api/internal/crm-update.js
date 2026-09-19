import {allowMethods} from "../../lib/http.js";
import {db,config,webhooks} from "@fluxo-juridico/runtime";

export const access="public";
export const methods=["POST"];

const STATUSES=new Set(["new","contacted","qualified","won","lost"]);
const clean=(value,max=1200)=>String(value??"").trim().slice(0,max);

function optionalIso(value){
  if(value===null||value===undefined||value==="")return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime())?undefined:date.toISOString();
}

function canonical(timestamp,body){
  return [
    timestamp,
    "crm-update",
    clean(body.id,80),
    clean(body.status,40),
    clean(body.nextFollowup,80),
    clean(body.demoAt,80),
    clean(body.notes,1200),
    clean(body.lostReason,500)
  ].join("\u001f");
}

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
 * Signed CRM mutation endpoint used by the private admin console.
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

  const body=req.body||{};
  const valid=await webhooks.verifyHmac({
    raw:canonical(timestamp,body),
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

  const id=clean(body.id,80);
  const status=clean(body.status,40);
  if(!id||!STATUSES.has(status)){
    return res.status(400).json({error:"Dados do lead inválidos."});
  }

  const nextFollowup=optionalIso(body.nextFollowup);
  const demoAt=optionalIso(body.demoAt);

  if(nextFollowup===undefined||demoAt===undefined){
    return res.status(400).json({error:"Data comercial inválida."});
  }

  const convertedAt=status==="won"?new Date().toISOString():null;

  const {rows}=await db.query(
    "UPDATE sales_leads SET status=$2,notes=$3,next_followup=$4,demo_at=$5,converted_at=CASE WHEN $2='won' THEN COALESCE(converted_at,$6::timestamptz) ELSE converted_at END,lost_reason=$7,updated_at=now() WHERE id=$1 RETURNING *",
    [
      id,
      status,
      clean(body.notes,1200),
      nextFollowup,
      demoAt,
      convertedAt,
      clean(body.lostReason,500)
    ]
  );

  if(!rows[0]){
    return res.status(404).json({error:"Lead não encontrado."});
  }

  return res.json({ok:true,item:mapLead(rows[0])});
}