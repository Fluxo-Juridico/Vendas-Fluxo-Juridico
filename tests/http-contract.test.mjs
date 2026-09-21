import test from "node:test";
import assert from "node:assert/strict";
import {allowMethods,apiError,ensureRequestId,wrapHandler} from "../server/lib/http.js";

function response(){
  return {
    headers:{},
    statusCode:200,
    body:null,
    headersSent:false,
    setHeader(name,value){this.headers[name]=value;},
    getHeader(name){return this.headers[name];},
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

test("ensureRequestId creates and returns a correlation id",()=>{
  const req={headers:{}};
  const res=response();
  const id=ensureRequestId(req,res);
  assert.match(id,/^[A-Za-z0-9-]{8,128}$/);
  assert.equal(req.requestId,id);
  assert.equal(res.headers["X-Request-Id"],id);
});

test("safe incoming request id is preserved",()=>{
  const req={headers:{"x-request-id":"req-12345678"}};
  const res=response();
  assert.equal(ensureRequestId(req,res),"req-12345678");
});

test("apiError follows the canonical envelope",()=>{
  const req={headers:{}};
  const res=response();
  apiError(req,res,403,"Acesso negado.","access_denied");
  assert.equal(res.statusCode,403);
  assert.equal(res.body.error,"Acesso negado.");
  assert.equal(res.body.code,"access_denied");
  assert.equal(res.body.requestId,req.requestId);
});

test("allowMethods returns canonical 405 error",()=>{
  const req={method:"POST",headers:{}};
  const res=response();
  assert.equal(allowMethods(req,res,["GET"]),false);
  assert.equal(res.statusCode,405);
  assert.equal(res.body.code,"method_not_allowed");
  assert.equal(res.body.requestId,req.requestId);
  assert.equal(res.headers.Allow,"GET");
});

test("wrapHandler normalizes route errors that omit code and requestId",async()=>{
  const handler=wrapHandler(async(_req,res)=>{
    return res.status(400).json({error:"Entrada inválida."});
  },{service:"test"});
  const req={method:"POST",url:"/api/test",headers:{}};
  const res=response();
  await handler(req,res);
  assert.equal(res.statusCode,400);
  assert.equal(res.body.code,"validation_error");
  assert.equal(res.body.requestId,req.requestId);
  assert.equal(res.headers["Cache-Control"],"no-store");
});

test("wrapHandler converts unhandled exceptions into a safe canonical 500",async()=>{
  const previous=console.error;
  console.error=()=>{};
  try{
    const handler=wrapHandler(async()=>{throw new Error("internal detail");},{service:"test"});
    const req={method:"GET",url:"/api/test",headers:{}};
    const res=response();
    await handler(req,res);
    assert.equal(res.statusCode,500);
    assert.equal(res.body.code,"internal_error");
    assert.equal(res.body.error,"Não foi possível concluir a operação.");
    assert.equal(res.body.requestId,req.requestId);
    assert.equal(JSON.stringify(res.body).includes("internal detail"),false);
  }finally{
    console.error=previous;
  }
});
