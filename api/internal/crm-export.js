import handler from "../../server/api/internal/crm-export.js";
import {wrapHandler} from "../../server/lib/http.js";
export * from "../../server/api/internal/crm-export.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
