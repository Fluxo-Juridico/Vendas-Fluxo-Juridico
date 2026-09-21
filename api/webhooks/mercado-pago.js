import handler from "../../server/api/webhooks/mercado-pago.js";
import {wrapHandler} from "../../server/lib/http.js";
export * from "../../server/api/webhooks/mercado-pago.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
