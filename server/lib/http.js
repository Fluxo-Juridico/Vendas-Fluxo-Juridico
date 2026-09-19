export function allowMethods(req,res,allowed=[]){
  const methods=[...new Set((allowed||[]).map(value=>String(value).toUpperCase()))];
  const method=String(req?.method||"GET").toUpperCase();
  if(methods.includes(method))return true;
  res.setHeader("Allow",methods.join(", "));
  res.status(405).json({error:"Método não permitido."});
  return false;
}
