import handler from "../server/api/health.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/health.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
