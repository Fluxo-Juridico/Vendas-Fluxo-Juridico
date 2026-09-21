import {timingSafeEqual} from "node:crypto";
import {db} from "@fluxo-juridico/runtime";
import {tryProvision} from "../../lib/billing.js";

export const access="scheduler";
export const methods=["GET"];

function same(a,b){
  const left=Buffer.from(String(a??""));
  const right=Buffer.from(String(b??""));
  return left.length===right.length&&timingSafeEqual(left,right);
}

function requireCron(req,res){
  const secret=String(process.env.CRON_SECRET||"");
  const auth=String(req.headers?.authorization||"");
  if(!secret){
    res.status(503).json({error:"CRON_SECRET não configurada."});
    return false;
  }
  if(!auth.startsWith("Bearer ")||!same(auth.slice(7),secret)){
    res.status(401).json({error:"Não autorizado."});
    return false;
  }
  return true;
}

/**
 * Recovery job for payment states whose SaaS-side action did not complete.
 * Vercel Cron invokes this endpoint with GET and CRON_SECRET as a Bearer token.
 */
export default async function(req,res){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({error:"Método não permitido."});
  }
  if(!requireCron(req,res))return;

  const {rows}=await db.query(
    `SELECT *
     FROM sales_orders
     WHERE payment_status IN (
       'approved','refunded','charged_back','cancelled','in_mediation'
     )
       AND provisioning_status IN ('not_ready','retry')
     ORDER BY updated_at ASC
     LIMIT 50`
  );

  let synchronized=0;
  let errors=0;

  for(const order of rows){
    try{
      if(await tryProvision(order))synchronized++;
    }catch(error){
      errors++;
      console.error("billing_retry_item_failed",{
        orderId:String(order?.id||"").slice(0,120),
        message:String(error?.message||error).slice(0,300)
      });
    }
  }

  const remaining=Number((await db.query(
    `SELECT count(*)::int AS total
       FROM sales_orders
       WHERE payment_status IN (
         'approved','refunded','charged_back','cancelled','in_mediation'
       )
         AND provisioning_status IN ('not_ready','retry')`
  )).rows[0]?.total)||0;

  console.info("billing_retry_summary",{
    checked:rows.length,
    synchronized,
    errors,
    remaining
  });

  res.setHeader("Cache-Control","no-store");
  res.json({
    checked:rows.length,
    synchronized,
    errors,
    remaining
  });
}
