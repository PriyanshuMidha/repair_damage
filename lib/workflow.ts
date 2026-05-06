import type { ActionPayload, Repair, RepairStatus, Role } from "./types";
import { REPAIR_STATUSES } from "./types";

export function isRepairStatus(value: string): value is RepairStatus {
  return REPAIR_STATUSES.includes(value as RepairStatus);
}

const STATUS_CSS_SLUG: Record<RepairStatus, string> = {
  Received: "status-received",
  "Repair In Progress": "status-repair-in-progress",
  "Repair Received": "status-repair-received",
  GR: "status-gr",
  "Sent to Customer": "status-sent-to-customer",
};

export function statusClass(status: RepairStatus): string {
  return STATUS_CSS_SLUG[status];
}

export const ACTION_UI_ORDER: readonly ActionPayload["action"][] = [
  "send-to-customer",
  "mark-as-gr",
  "send-to-repair",
  "receive-from-repair",
];

export function sortedActionsForUi(actions: ActionPayload["action"][]) {
  return [...actions].sort((a, b) => ACTION_UI_ORDER.indexOf(a) - ACTION_UI_ORDER.indexOf(b));
}

export function allowedActions(repair: Repair, role: Role) {
  void role;
  if (repair.status === "Received") return ["send-to-repair"] as ActionPayload["action"][];
  if (repair.status === "Repair In Progress") return ["receive-from-repair"] as ActionPayload["action"][];
  if (repair.status === "Repair Received") return ["send-to-customer", "mark-as-gr"] as ActionPayload["action"][];
  return [] as ActionPayload["action"][];
}

export function assertValidAction(repair: Repair, payload: ActionPayload, role: Role) {
  if (!allowedActions(repair, role).includes(payload.action)) {
    throw new Error(`Action ${payload.action} is not allowed from ${repair.status}.`);
  }

  if (payload.action === "send-to-repair" && !payload.sentToRepairBy?.trim()) {
    throw new Error("Sent to repair by is required.");
  }
  if (payload.action === "receive-from-repair" && !payload.receivedFromRepairBy?.trim()) {
    throw new Error("Received from repair by is required.");
  }
  if (payload.action === "send-to-customer" && !payload.sentToCustomerBy?.trim()) {
    throw new Error("Sent to customer by is required.");
  }
  if (payload.action === "mark-as-gr" && !payload.grBy?.trim()) {
    throw new Error("Marked as GR by is required.");
  }
}

export function nextStatusForAction(action: ActionPayload["action"]): RepairStatus {
  switch (action) {
    case "send-to-repair":
      return "Repair In Progress";
    case "receive-from-repair":
      return "Repair Received";
    case "send-to-customer":
      return "Sent to Customer";
    case "mark-as-gr":
      return "GR";
  }
}

export function relevantPersonLabel(repair: Repair) {
  if (repair.status === "GR" && repair.grBy) {
    return { label: "Marked as GR by", value: repair.grBy };
  }
  if (repair.status === "Sent to Customer" && repair.sentToCustomerBy) {
    return { label: "Sent to customer by", value: repair.sentToCustomerBy };
  }
  if (repair.status === "Repair Received" && repair.receivedFromRepairBy) {
    return { label: "Received from repair by", value: repair.receivedFromRepairBy };
  }
  if (repair.status === "Repair In Progress" && repair.sentToRepairBy) {
    return { label: "Sent to repair by", value: repair.sentToRepairBy };
  }
  return { label: "Received from customer by", value: repair.receivedFromCustomerBy };
}

export function actionLabel(action: ActionPayload["action"]) {
  switch (action) {
    case "send-to-repair":
      return "Send to Repair";
    case "receive-from-repair":
      return "Receive from Repair";
    case "send-to-customer":
      return "Send to Customer";
    case "mark-as-gr":
      return "Mark As GR";
  }
}
