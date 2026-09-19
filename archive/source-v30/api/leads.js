import {db} from "hatchable";

export const access="public";
export const methods=["POST"];

const clean=(value,max=500)=>String(value??"").trim().slice(0,max);
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Optional contact/lead form.
 * The honeypot silently accepts bot submissions without persisting them.
 */
export default async function(req,res){
  const honeypot=clean(req.body?.website,100);
  if(honeypot)return res.json({ok:true});

  const name=clean(req.body?.name,180);
  const email=clean(req.body?.email,180).toLowerCase();

  if(name.length<2){
    return res.status(400).json({error:"Informe seu nome."});
  }
  if(!validEmail(email)){
    return res.status(400).json({error:"Informe um e-mail válido."});
  }

  const attribution={
    utm_source:clean(req.body?.utmSource,120),
    utm_medium:clean(req.body?.utmMedium,120),
    utm_campaign:clean(req.body?.utmCampaign,180),
    utm_content:clean(req.body?.utmContent,180),
    referrer:clean(req.body?.referrer,500)
  };

  const id=crypto.randomUUID();

  await db.query(
    `INSERT INTO sales_leads (
      id,name,email,phone,firm_name,team_size,message,source,attribution
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      id,
      name,
      email,
      clean(req.body?.phone,60),
      clean(req.body?.firmName,180),
      clean(req.body?.teamSize,60),
      clean(req.body?.message,1000),
      clean(req.body?.source,60)||"website",
      JSON.stringify(attribution)
    ]
  );

  res.status(201).json({
    ok:true,
    message:"Recebemos seu pedido. Entraremos em contato."
  });
}