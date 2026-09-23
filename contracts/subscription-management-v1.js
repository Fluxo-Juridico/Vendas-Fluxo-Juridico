export const SUBSCRIPTION_MANAGEMENT_VERSION = "subscription-management-v1";

export const SUBSCRIPTION_MANAGEMENT_ACTIONS = new Set(["inspect", "change_plan", "cancel"]);

export function canonicalSubscriptionManagementSignature({
  timestamp,
  version = SUBSCRIPTION_MANAGEMENT_VERSION,
  requestId,
  organizationId,
  email,
  action,
  targetPlan = ""
}) {
  return [
    String(timestamp || ""),
    String(version || ""),
    String(requestId || ""),
    String(organizationId || ""),
    String(email || "")
      .trim()
      .toLowerCase(),
    String(action || ""),
    String(targetPlan || "")
  ].join(".");
}
