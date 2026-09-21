import handler from "../server/api/billing-config.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/billing-config.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
