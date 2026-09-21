import {randomUUID} from "node:crypto";

function safeIncomingRequestId(value){
  const id=String(value||"").trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(id)?id:"";
}

function statusCodeFor(status){
  if(status===400)return "validation_error";
  if(status===401)return "unauthorized";
  if(status===403)return "forbidden";
  if(status===404)return "not_found";
  if(status===405)return "method_not_allowed";
  if(status===409)return "conflict";
  if(status===413)return "payload_too_large";
  if(status===415)return "unsupported_media_type";
  if(status===429)return "rate_limited";
  if(status===502)return "upstream_error";
  if(status===503)return "service_unavailable";
  return "internal_error";
}

export function ensureRequestId(req,res){
  if(req?.requestId){
    if(res?.setHeader)res.setHeader("X-Request-Id",req.requestId);
    return req.requestId;
  }
  const incoming=safeIncomingRequestId(req?.headers?.["x-request-id"]);
  const requestId=incoming||randomUUID();
  if(req)req.requestId=requestId;
  if(res?.setHeader)res.setHeader("X-Request-Id",requestId);
  return requestId;
}

export function prepareHttp(req,res){
  const requestId=ensureRequestId(req,res);
  res.setHeader?.("X-Content-Type-Options","nosniff");
  if(!res.getHeader?.("Cache-Control"))res.setHeader?.("Cache-Control","no-store");

  if(!res.__fluxoJsonPrepared&&typeof res.json==="function"){
    const originalJson=res.json.bind(res);
    Object.defineProperty(res,"__fluxoJsonPrepared",{value:true,enumerable:false});
    res.json=(body)=>{
      const status=Number(res.statusCode)||200;
      if(status>=400&&body&&typeof body==="object"&&!Array.isArray(body)&&body.error){
        return originalJson({
          ...body,
          code:body.code||statusCodeFor(status),
          requestId:body.requestId||requestId
        });
      }
      return originalJson(body);
    };
  }
  return requestId;
}

export function apiError(req,res,status,error,code,extra={}){
  const requestId=prepareHttp(req,res);
  return res.status(status).json({
    error:String(error||"Erro inesperado."),
    code:String(code||statusCodeFor(status)),
    requestId,
    ...extra
  });
}

export function allowMethods(req,res,allowed=[]){
  prepareHttp(req,res);
  const methods=[...new Set((allowed||[]).map(value=>String(value).toUpperCase()))];
  const method=String(req?.method||"GET").toUpperCase();
  if(methods.includes(method))return true;
  res.setHeader("Allow",methods.join(", "));
  apiError(req,res,405,"Método não permitido.","method_not_allowed");
  return false;
}

export function wrapHandler(handler,{service="api"}={}){
  if(typeof handler!=="function")throw new TypeError("API handler inválido.");
  return async function wrappedHandler(req,res){
    prepareHttp(req,res);
    try{
      return await handler(req,res);
    }catch(error){
      console.error(JSON.stringify({
        level:"error",
        event:"api_unhandled_error",
        service:String(service||"api").slice(0,80),
        requestId:req.requestId||"",
        method:String(req.method||""),
        path:String(req.url||"").split("?")[0].slice(0,300),
        errorName:String(error?.name||"Error").slice(0,120),
        message:String(error?.message||"Unhandled API error").slice(0,500)
      }));
      if(res.headersSent)return;
      return apiError(req,res,500,"Não foi possível concluir a operação.","internal_error");
    }
  };
}
