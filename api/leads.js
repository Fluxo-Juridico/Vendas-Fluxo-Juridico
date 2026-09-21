import handler from "../server/api/leads.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/leads.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
