import { assertValidAction, isRepairStatus, nextStatusForAction } from "./workflow";
import { buildPdfBytes, renderReceiptHtml } from "./receipt";
import type {
  ActionPayload,
  CreateRepairInput,
  Party,
  Product,
  Repair,
  RepairDetail,
  RepairHistory,
  RepairListFilters,
  RepairPhoto,
  RepairReceipt,
  RepairStatus,
  User,
} from "./types";

type DataStore = {
  parties: Party[];
  products: Product[];
  users: User[];
  repairs: Repair[];
  photos: RepairPhoto[];
  history: RepairHistory[];
  receipts: RepairReceipt[];
  sequenceByDate: Record<string, number>;
};

const globalForStore = globalThis as unknown as { repairStore?: DataStore };

export const store: DataStore =
  globalForStore.repairStore ??
  (globalForStore.repairStore = {
    parties: [
      { id: "party-1", name: "Aarav Traders", phone: "9876543210", type: "Dealer" },
      { id: "party-2", name: "Meera Customer", phone: "9123456780", type: "Customer" },
      { id: "party-3", name: "Kiran Electronics", phone: "9988776655", type: "Vendor" },
    ],
    products: [
      { id: "product-1", code: "PRD-1001", name: "Mixer Grinder Pro", color: "Steel", saleRate: 4200, purchaseRate: 3100 },
      { id: "product-2", code: "PRD-2040", name: "Smart LED Panel", color: "White", saleRate: 2600, purchaseRate: 1850 },
      { id: "product-3", code: "PRD-3307", name: "Copper Bottle Set", color: "Copper", saleRate: 1450, purchaseRate: 880 },
    ],
    users: [
      { id: "user-staff", name: "Counter Staff", role: "staff" },
      { id: "user-admin", name: "Admin User", role: "admin" },
    ],
    repairs: [],
    photos: [],
    history: [],
    receipts: [],
    sequenceByDate: {},
  });

export function currentUser(role: "staff" | "admin" = "admin") {
  return store.users.find((user) => user.role === role) ?? store.users[0];
}

export function listMasters() {
  return {
    parties: store.parties,
    products: store.products,
    users: store.users,
  };
}

export function listRepairs(filters: RepairListFilters = {}) {
  return store.repairs
    .map(hydrateRepair)
    .filter((repair) => {
      if (filters.status && isRepairStatus(filters.status) && repair.currentStatus !== filters.status) return false;
      if (filters.party && !repair.party.name.toLowerCase().includes(filters.party.toLowerCase())) return false;
      if (filters.productCode && !repair.product.code.toLowerCase().includes(filters.productCode.toLowerCase())) return false;
      if (filters.staff && !repair.receiverStaffName.toLowerCase().includes(filters.staff.toLowerCase())) return false;
      if (filters.repairNumber && !repair.repairNumber.toLowerCase().includes(filters.repairNumber.toLowerCase())) return false;
      if (filters.from && new Date(repair.receivedAt) < new Date(filters.from)) return false;
      if (filters.to && new Date(repair.receivedAt) > endOfDay(filters.to)) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRepair(id: string) {
  const repair = store.repairs.find((item) => item.id === id);
  return repair ? hydrateRepair(repair) : undefined;
}

export function createRepair(input: CreateRepairInput) {
  validateCreateInput(input);
  const now = new Date().toISOString();
  const user = currentUser("staff");
  const repair: Repair = {
    id: crypto.randomUUID(),
    repairNumber: nextRepairNumber(),
    partyId: input.partyId,
    productId: input.productId,
    quantity: input.quantity || 1,
    isBilled: input.isBilled,
    billOrGrReference: input.billOrGrReference?.trim() || undefined,
    damageCategory: input.damageCategory,
    damageRemarks: input.damageRemarks.trim(),
    productCondition: input.productCondition.trim(),
    currentStatus: "Received",
    receivedByUserId: user.id,
    receiverStaffName: input.receiverStaffName.trim(),
    createdAt: now,
    updatedAt: now,
    receivedAt: now,
  };

  store.repairs.push(repair);
  addHistory(repair, "create", undefined, "Received", user.id, "Repair received", {});
  generateReceipt(repair.id, user.id);
  return hydrateRepair(repair);
}

export function updateRepairWhileReceived(id: string, input: Partial<CreateRepairInput>) {
  const repair = findRepair(id);
  if (repair.currentStatus !== "Received") {
    throw new Error("Only Received repairs can be edited by staff.");
  }
  applyCorePatch(repair, input);
  addHistory(repair, "update", repair.currentStatus, repair.currentStatus, currentUser("staff").id, "Staff updated received repair", {});
  return hydrateRepair(repair);
}

export function uploadPhoto(id: string, fileName: string, url?: string) {
  const repair = findRepair(id);
  if (repair.currentStatus === "Returned To Customer" || repair.currentStatus === "Cancelled") {
    throw new Error("Photos cannot be added after final closure.");
  }
  const user = currentUser("staff");
  const photo: RepairPhoto = {
    id: crypto.randomUUID(),
    repairId: id,
    fileName: fileName.trim() || "repair-photo.jpg",
    url: url?.trim() || `/uploads/${encodeURIComponent(fileName.trim() || "repair-photo.jpg")}`,
    uploadedByUserId: user.id,
    uploadedAt: new Date().toISOString(),
  };
  store.photos.push(photo);
  return photo;
}

export function performAction(id: string, payload: ActionPayload, role: "staff" | "admin" = "staff") {
  const repair = findRepair(id);
  const user = currentUser(role);
  assertValidAction(repair, payload, user.role);

  if (payload.action === "admin-correct") {
    applyCorePatch(repair, payload.patch ?? {});
    repair.correctionReason = payload.remarks;
    repair.updatedAt = new Date().toISOString();
    addHistory(repair, "admin-correct", repair.currentStatus, repair.currentStatus, user.id, payload.remarks, { patch: payload.patch });
    return hydrateRepair(repair);
  }

  const fromStatus = repair.currentStatus;
  const toStatus = nextStatusForAction(payload.action);
  const now = new Date().toISOString();

  repair.currentStatus = toStatus;
  repair.updatedAt = now;

  if (payload.action === "send-to-repair") {
    repair.repairCenter = payload.repairCenter;
    repair.sentToRepairByStaffName = payload.sentToRepairByStaffName;
    repair.sentToRepairAt = now;
  }
  if (payload.action === "receive-from-repair") {
    repair.receivedAfterRepairByStaffName = payload.receivedAfterRepairByStaffName;
    repair.receivedAfterRepairAt = now;
  }
  if (payload.action === "mark-ready") {
    repair.checkedByStaffName = payload.checkedByStaffName;
    repair.readyToReturnAt = now;
  }
  if (payload.action === "mark-rework") {
    repair.checkedByStaffName = payload.checkedByStaffName;
    repair.reworkRequiredAt = now;
  }
  if (payload.action === "mark-failed") {
    repair.checkedByStaffName = payload.checkedByStaffName;
    repair.repairFailedAt = now;
  }
  if (payload.action === "cancel") {
    repair.cancelledAt = now;
    repair.cancellationReason = payload.remarks;
  }
  if (payload.action === "return-to-customer") {
    repair.returnedAt = now;
    repair.returnedByStaffName = payload.returnedByStaffName;
    repair.returnReceivedBy = payload.returnReceivedBy;
    repair.deliveryMode = payload.deliveryMode;
    repair.courierName = payload.courierName;
    repair.trackingNumber = payload.trackingNumber;
    repair.transportName = payload.transportName;
    repair.returnRemarks = payload.remarks;
  }

  addHistory(repair, payload.action, fromStatus, toStatus, user.id, payload.remarks, { ...payload });
  return hydrateRepair(repair);
}

export function generateReceipt(id: string, userId = currentUser("staff").id) {
  const repair = getRepair(id);
  if (!repair) throw new Error("Repair not found.");

  const receipt: RepairReceipt = {
    id: crypto.randomUUID(),
    repairId: id,
    htmlPath: `/repairs/${id}/receipt`,
    pdfPath: `/api/repairs/${id}/receipt/pdf`,
    generatedAt: new Date().toISOString(),
    generatedByUserId: userId,
  };

  try {
    renderReceiptHtml(repair);
    buildPdfBytes(repair);
  } catch (error) {
    receipt.lastError = error instanceof Error ? error.message : "Receipt generation failed.";
  }

  store.receipts.push(receipt);
  return receipt;
}

export function repairsToCsv(filters: RepairListFilters = {}) {
  const rows = listRepairs(filters);
  const header = ["Repair Number", "Status", "Party", "Product Code", "Product", "Quantity", "Billed", "Reference", "Received At", "Staff"];
  const body = rows.map((repair) => [
    repair.repairNumber,
    repair.currentStatus,
    repair.party.name,
    repair.product.code,
    repair.product.name,
    String(repair.quantity),
    repair.isBilled ? "Yes" : "No",
    repair.billOrGrReference ?? "",
    repair.receivedAt,
    repair.receiverStaffName,
  ]);
  return [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
}

function hydrateRepair(repair: Repair): RepairDetail {
  const party = store.parties.find((item) => item.id === repair.partyId);
  const product = store.products.find((item) => item.id === repair.productId);
  const receivedBy = store.users.find((item) => item.id === repair.receivedByUserId);
  if (!party || !product || !receivedBy) throw new Error("Repair master data is missing.");
  const safeRepair = normalizeRepair(repair, receivedBy.name);

  return {
    ...safeRepair,
    party,
    product,
    receivedBy,
    photos: store.photos.filter((photo) => photo.repairId === repair.id),
    history: store.history.filter((item) => item.repairId === repair.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    receipts: store.receipts.filter((item) => item.repairId === repair.id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
  };
}

function normalizeRepair(repair: Repair, fallbackStaffName: string): Repair {
  return {
    ...repair,
    receiverStaffName: repair.receiverStaffName ?? fallbackStaffName,
    productCondition: repair.productCondition ?? repair.damageRemarks ?? "Not specified",
  };
}

function validateCreateInput(input: CreateRepairInput) {
  if (!store.parties.some((party) => party.id === input.partyId)) throw new Error("Valid party is required.");
  if (!store.products.some((product) => product.id === input.productId)) throw new Error("Valid product is required.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Quantity must be at least 1.");
  if (input.isBilled && !input.billOrGrReference?.trim()) throw new Error("Bill/GR reference is required when billed.");
  if (!input.damageCategory) throw new Error("Damage category is required.");
  if (!input.damageRemarks?.trim()) throw new Error("Damage remarks are required.");
  if (!input.productCondition?.trim()) throw new Error("Product condition is required.");
  if (!input.receiverStaffName?.trim()) throw new Error("Receiver staff name is required.");
}

function applyCorePatch(repair: Repair, input: Partial<CreateRepairInput>) {
  if (input.partyId) repair.partyId = input.partyId;
  if (input.productId) repair.productId = input.productId;
  if (input.quantity !== undefined) repair.quantity = input.quantity;
  if (input.isBilled !== undefined) repair.isBilled = input.isBilled;
  if (input.billOrGrReference !== undefined) repair.billOrGrReference = input.billOrGrReference;
  if (input.damageCategory) repair.damageCategory = input.damageCategory;
  if (input.damageRemarks) repair.damageRemarks = input.damageRemarks;
  if (input.productCondition) repair.productCondition = input.productCondition;
  if (input.receiverStaffName) repair.receiverStaffName = input.receiverStaffName;
  validateCreateInput({
    partyId: repair.partyId,
    productId: repair.productId,
    quantity: repair.quantity,
    isBilled: repair.isBilled,
    billOrGrReference: repair.billOrGrReference,
    damageCategory: repair.damageCategory,
    damageRemarks: repair.damageRemarks,
    productCondition: repair.productCondition,
    receiverStaffName: repair.receiverStaffName,
  });
  repair.updatedAt = new Date().toISOString();
}

function findRepair(id: string) {
  const repair = store.repairs.find((item) => item.id === id);
  if (!repair) throw new Error("Repair not found.");
  return repair;
}

function addHistory(
  repair: Repair,
  action: string,
  fromStatus: RepairStatus | undefined,
  toStatus: RepairStatus,
  userId: string,
  remarks?: string,
  metadata?: Record<string, unknown>,
) {
  const user = store.users.find((item) => item.id === userId) ?? currentUser();
  store.history.push({
    id: crypto.randomUUID(),
    repairId: repair.id,
    action,
    fromStatus,
    toStatus,
    userId: user.id,
    userName: user.name,
    remarks,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

function nextRepairNumber() {
  const key = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  store.sequenceByDate[key] = (store.sequenceByDate[key] ?? 0) + 1;
  return `REP-${key}-${String(store.sequenceByDate[key]).padStart(4, "0")}`;
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
