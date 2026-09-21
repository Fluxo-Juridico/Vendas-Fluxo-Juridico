import handler from "../../server/api/internal/crm-update.js";
import {wrapHandler} from "../../server/lib/http.js";
export * from "../../server/api/internal/crm-update.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
