import {randomUUID} from "node:crypto";

function safeIncomingRequestId(value){
  const id=String(value||"").trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(id)?id:"";
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

export function apiError(req,res,status,error,code,extra={}){
  const requestId=ensureRequestId(req,res);
  return res.status(status).json({
    error:String(error||"Erro inesperado."),
    code:String(code||"internal_error"),
    requestId,
    ...extra
  });
}

export function allowMethods(req,res,allowed=[]){
  ensureRequestId(req,res);
  const methods=[...new Set((allowed||[]).map(value=>String(value).toUpperCase()))];
  const method=String(req?.method||"GET").toUpperCase();
  if(methods.includes(method))return true;
  res.setHeader("Allow",methods.join(", "));
  apiError(req,res,405,"Método não permitido.","method_not_allowed");
  return false;
}
