import { allowMethods } from "../lib/http.js";
import { PRIVACY_HTML, TERMS_HTML } from "../lib/legal-pages.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  const document = String(req.query?.document || "").trim().toLowerCase();
  const html =
    document === "terms" ? TERMS_HTML : document === "privacy" ? PRIVACY_HTML : "";

  if (!html) {
    return res.status(404).json({ error: "Documento legal não encontrado." });
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return res.status(200).send(html);
}
