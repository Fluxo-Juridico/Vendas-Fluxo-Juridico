import handler from "../server/api/checkout.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/checkout.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
