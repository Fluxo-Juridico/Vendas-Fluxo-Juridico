import { allowMethods } from "../lib/http.js";
import { db } from "@fluxo-juridico/runtime";
import { BILLING_CONTRACT_VERSION } from "../../contracts/billing-v1.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  await db.query("select 1 as ok");
  return res.json({
    status: "ok",
    service: "fluxo-juridico-vendas",
    checkedAt: new Date().toISOString(),
    release: {
      commitSha: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local"),
      billingContract: BILLING_CONTRACT_VERSION,
      database: "ok"
    }
  });
}
