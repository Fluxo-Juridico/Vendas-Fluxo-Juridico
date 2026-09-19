import {settings} from "../lib/billing.js";

export const access="public";
export const methods=["GET"];

/**
 * Public, non-sensitive billing configuration used by the pricing UI.
 * Secrets and provider credentials are intentionally never returned.
 */
export default async function(req,res){
  const cfg=await settings();

  res.setHeader("Cache-Control","no-store");
  res.json({
    enabled:cfg.enabled,
    saasUrl:cfg.saasBaseUrl||"",
    plans:{
      Solo:{
        price:cfg.prices.Solo,
        seats:cfg.seats.Solo,
        storageGb:cfg.storageGb.Solo
      },
      Essencial:{
        price:cfg.prices.Essencial,
        seats:cfg.seats.Essencial,
        storageGb:cfg.storageGb.Essencial
      },
      Profissional:{
        price:cfg.prices.Profissional,
        seats:cfg.seats.Profissional,
        storageGb:cfg.storageGb.Profissional
      },
      Premium:{
        price:cfg.prices.Premium,
        seats:cfg.seats.Premium,
        storageGb:cfg.storageGb.Premium
      }
    }
  });
}