import handler from "../server/api/payment-status.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/payment-status.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
