import {db} from "hatchable";
import {tryProvision} from "../../lib/billing.js";

export const access="scheduler";
export const methods=["POST"];

/**
 * Hourly recovery job.
 * Retries only orders whose payment state requires a SaaS-side action and whose
 * previous provisioning attempt has not completed.
 */
export default async function(req,res){
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

  for(const order of rows){
    if(await tryProvision(order))synchronized++;
  }

  res.json({
    checked:rows.length,
    synchronized
  });
}