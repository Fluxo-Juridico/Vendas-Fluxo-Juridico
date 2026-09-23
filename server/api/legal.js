import { allowMethods } from "../lib/http.js";
import { PRIVACY_HTML, TERMS_HTML } from "../lib/legal-pages.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;

  const rawDocument = String(req.query?.document || "");
  const document = rawDocument.trim().toLowerCase();
  let html = "";

  if (document === "terms") html = TERMS_HTML;
  if (document === "privacy") html = PRIVACY_HTML;

  if (!html) {
    return res.status(404).json({ error: "Documento legal não encontrado." });
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return res.status(200).send(html);
}
