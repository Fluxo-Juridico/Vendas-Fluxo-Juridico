import handler from "../server/api/legal.js";
import {wrapHandler} from "../server/lib/http.js";
export * from "../server/api/legal.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
