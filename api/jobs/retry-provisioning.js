import handler from "../../server/api/jobs/retry-provisioning.js";
import {wrapHandler} from "../../server/lib/http.js";
export * from "../../server/api/jobs/retry-provisioning.js";
export default wrapHandler(handler,{service:"fluxo-juridico-vendas"});
