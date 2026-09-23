import { allowMethods } from "../lib/http.js";
import { PRIVACY_HTML } from "../lib/legal-pages.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  if (!allowMethods(req, res, methods)) return;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return res.status(200).send(PRIVACY_HTML);
}
