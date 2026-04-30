import { DELIVERY_MODES, REPAIR_STATUSES, type ActionPayload, type Repair, type RepairStatus, type Role } from "./types";

export function isRepairStatus(value: string): value is RepairStatus {
  return REPAIR_STATUSES.includes(value as RepairStatus);
}

export function statusClass(status: RepairStatus) {
  return status.toLowerCase().replaceAll(" ", "-").replace("to-return", "ready").replace("to-customer", "returned");
}

export function allowedActions(repair: Repair, role: Role) {
  const actions: ActionPayload["action"][] = [];

  if (repair.currentStatus === "Received") {
    actions.push("send-to-repair", "cancel");
  }

  if (repair.currentStatus === "Repair In Progress") {
    actions.push("receive-from-repair");
    if (role === "admin") actions.push("cancel");
  }

  if (repair.currentStatus === "Received After Repair") {
    actions.push("mark-ready", "mark-rework", "mark-failed");
  }

  if (repair.currentStatus === "Ready To Return" || repair.currentStatus === "Repair Failed") {
    actions.push("return-to-customer");
  }

  if (repair.currentStatus === "Rework Required") {
    actions.push("send-to-repair");
  }

  if (role === "admin" && repair.currentStatus !== "Cancelled") {
    actions.push("admin-correct");
  }

  return actions;
}

export function assertValidAction(repair: Repair, payload: ActionPayload, role: Role) {
  if (!allowedActions(repair, role).includes(payload.action)) {
    throw new Error(`Action ${payload.action} is not allowed from ${repair.currentStatus}.`);
  }

  if (payload.action === "send-to-repair" && !payload.repairCenter?.trim()) {
    throw new Error("Repair center is required before sending to repair.");
  }

  if (payload.action === "send-to-repair" && !payload.sentToRepairByStaffName?.trim()) {
    throw new Error("Sender staff name is required before sending to repair.");
  }

  if (payload.action === "receive-from-repair" && !payload.receivedAfterRepairByStaffName?.trim()) {
    throw new Error("Received-after-repair staff name is required.");
  }

  if (["mark-ready", "mark-rework", "mark-failed"].includes(payload.action) && !payload.checkedByStaffName?.trim()) {
    throw new Error("Checker staff name is required after repair.");
  }

  if (["mark-rework", "mark-failed", "cancel", "admin-correct"].includes(payload.action) && !payload.remarks?.trim()) {
    throw new Error("Remarks are required for this action.");
  }

  if (payload.action === "return-to-customer") {
    if (!payload.returnedByStaffName?.trim()) throw new Error("Returned-by staff name is required.");
    if (!payload.returnReceivedBy?.trim()) throw new Error("Received-by party/customer name is required.");
    if (!payload.deliveryMode || !DELIVERY_MODES.includes(payload.deliveryMode)) throw new Error("Valid delivery mode is required.");
    if (payload.deliveryMode === "Courier" && (!payload.courierName?.trim() || !payload.trackingNumber?.trim())) {
      throw new Error("Courier name and tracking number are required for courier delivery.");
    }
    if (payload.deliveryMode === "Transport" && (!payload.transportName?.trim() || !payload.trackingNumber?.trim())) {
      throw new Error("Transport name and tracking number are required for transport delivery.");
    }
  }
}

export function nextStatusForAction(action: ActionPayload["action"]): RepairStatus {
  switch (action) {
    case "send-to-repair":
      return "Repair In Progress";
    case "receive-from-repair":
      return "Received After Repair";
    case "mark-ready":
      return "Ready To Return";
    case "mark-rework":
      return "Rework Required";
    case "mark-failed":
      return "Repair Failed";
    case "return-to-customer":
      return "Returned To Customer";
    case "cancel":
      return "Cancelled";
    case "admin-correct":
      throw new Error("Admin correction does not change status.");
  }
}
