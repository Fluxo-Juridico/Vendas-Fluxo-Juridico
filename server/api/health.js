import { allowMethods } from "../lib/http.js";
import { db } from "@fluxo-juridico/runtime";
import { BILLING_CONTRACT_VERSION } from "../../contracts/billing-v1.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  const { rows } = await db.query(
    "select version,name from supabase_migrations.schema_migrations order by version desc limit 1"
  );
  const migration = rows[0] || {};
  return res.json({
    status: "ok",
    service: "fluxo-juridico-vendas",
    checkedAt: new Date().toISOString(),
    release: {
      commitSha: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local"),
      billingContract: BILLING_CONTRACT_VERSION,
      migrationVersion: String(migration.version || ""),
      migrationName: String(migration.name || "")
    }
  });
}
