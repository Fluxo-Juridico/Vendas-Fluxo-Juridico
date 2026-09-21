import handler from "../../server/api/internal/billing-export.js";
import {wrapHandler} from "../../server/lib/http.js";
export * from "../../server/api/internal/billing-export.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
