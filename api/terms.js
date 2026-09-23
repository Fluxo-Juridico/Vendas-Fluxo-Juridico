import handler from "../server/api/terms.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/terms.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
