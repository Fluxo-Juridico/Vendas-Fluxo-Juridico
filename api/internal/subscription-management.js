import * as server from "../../server/api/internal/subscription-management.js";
import { adaptServerRoute } from "../../platform/route-adapter.js";
export const maxDuration = 60;
export default adaptServerRoute(server);
