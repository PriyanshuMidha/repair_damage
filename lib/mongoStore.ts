import { dataCollection, isMongoConfigured, partyCollection } from "./mongodb";
import * as memoryStore from "./store";
import { buildPdfBytes, renderReceiptHtml } from "./receipt";
import { assertValidAction, isRepairStatus, nextStatusForAction } from "./workflow";
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

type DataDoc = { _id?: string; [key: string]: unknown };
type PartyDoc = { _id: string } & Party;

const seeded = { done: false };

export async function currentUser(role: "staff" | "admin" = "admin") {
  if (!isMongoConfigured()) return memoryStore.currentUser(role);
  await ensureSeeded();
  const data = await dataCollection<DataDoc>();
  const user = await data.findOne({ kind: "user", role });
  return user ? stripKind<User>(user) : memoryStore.currentUser(role);
}

export async function listMasters() {
  if (!isMongoConfigured()) return memoryStore.listMasters();
  await ensureSeeded();
  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();

  return {
    parties: (await parties.find().toArray()).map(stripId),
    products: (await data.find({ kind: "product" }).toArray()).map((item) => stripKind<Product>(item)),
    users: (await data.find({ kind: "user" }).toArray()).map((item) => stripKind<User>(item)),
  };
}

export async function listRepairs(filters: RepairListFilters = {}) {
  if (!isMongoConfigured()) return memoryStore.listRepairs(filters);
  await ensureSeeded();
  const data = await dataCollection<DataDoc>();
  const repairs = (await data.find({ kind: "repair" }).toArray()).map((item) => stripKind<Repair>(item));
  const hydrated = await Promise.all(repairs.map(hydrateRepair));

  return hydrated
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

export async function getRepair(id: string) {
  if (!isMongoConfigured()) return memoryStore.getRepair(id);
  await ensureSeeded();
  const repair = await findRepair(id);
  return repair ? hydrateRepair(repair) : undefined;
}

export async function createRepair(input: CreateRepairInput) {
  if (!isMongoConfigured()) return memoryStore.createRepair(input);
  await ensureSeeded();
  await validateCreateInput(input);

  const now = new Date().toISOString();
  const user = await currentUser("staff");
  const repair: Repair = {
    id: crypto.randomUUID(),
    repairNumber: await nextRepairNumber(),
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

  const data = await dataCollection<DataDoc>();
  await data.insertOne({ _id: `repair:${repair.id}`, kind: "repair", ...repair });
  await addHistory(repair, "create", undefined, "Received", user.id, "Repair received", {});
  await generateReceipt(repair.id, user.id);
  return hydrateRepair(repair);
}

export async function updateRepairWhileReceived(id: string, input: Partial<CreateRepairInput>) {
  if (!isMongoConfigured()) return memoryStore.updateRepairWhileReceived(id, input);
  const repair = await requireRepair(id);
  if (repair.currentStatus !== "Received") throw new Error("Only Received repairs can be edited by staff.");
  await applyCorePatch(repair, input);
  await saveRepair(repair);
  const user = await currentUser("staff");
  await addHistory(repair, "update", repair.currentStatus, repair.currentStatus, user.id, "Staff updated received repair", {});
  return hydrateRepair(repair);
}

export async function uploadPhoto(id: string, fileName: string, url?: string) {
  if (!isMongoConfigured()) return memoryStore.uploadPhoto(id, fileName, url);
  const repair = await requireRepair(id);
  if (repair.currentStatus === "Returned To Customer" || repair.currentStatus === "Cancelled") {
    throw new Error("Photos cannot be added after final closure.");
  }
  const user = await currentUser("staff");
  const photo: RepairPhoto = {
    id: crypto.randomUUID(),
    repairId: id,
    fileName: fileName.trim() || "repair-photo.jpg",
    url: url?.trim() || `/uploads/${encodeURIComponent(fileName.trim() || "repair-photo.jpg")}`,
    uploadedByUserId: user.id,
    uploadedAt: new Date().toISOString(),
  };
  const data = await dataCollection<DataDoc>();
  await data.insertOne({ _id: `photo:${photo.id}`, kind: "photo", ...photo });
  return photo;
}

export async function performAction(id: string, payload: ActionPayload, role: "staff" | "admin" = "staff") {
  if (!isMongoConfigured()) return memoryStore.performAction(id, payload, role);
  const repair = await requireRepair(id);
  const user = await currentUser(role);
  assertValidAction(repair, payload, user.role);

  if (payload.action === "admin-correct") {
    await applyCorePatch(repair, payload.patch ?? {});
    repair.correctionReason = payload.remarks;
    repair.updatedAt = new Date().toISOString();
    await saveRepair(repair);
    await addHistory(repair, "admin-correct", repair.currentStatus, repair.currentStatus, user.id, payload.remarks, { patch: payload.patch });
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

  await saveRepair(repair);
  await addHistory(repair, payload.action, fromStatus, toStatus, user.id, payload.remarks, { ...payload });
  return hydrateRepair(repair);
}

export async function generateReceipt(id: string, userId?: string) {
  if (!isMongoConfigured()) return memoryStore.generateReceipt(id, userId);
  const repair = await getRepair(id);
  if (!repair) throw new Error("Repair not found.");
  const user = userId ?? (await currentUser("staff")).id;

  const receipt: RepairReceipt = {
    id: crypto.randomUUID(),
    repairId: id,
    htmlPath: `/repairs/${id}/receipt`,
    pdfPath: `/api/repairs/${id}/receipt/pdf`,
    generatedAt: new Date().toISOString(),
    generatedByUserId: user,
  };

  try {
    renderReceiptHtml(repair);
    buildPdfBytes(repair);
  } catch (error) {
    receipt.lastError = error instanceof Error ? error.message : "Receipt generation failed.";
  }

  const data = await dataCollection<DataDoc>();
  await data.insertOne({ _id: `receipt:${receipt.id}`, kind: "receipt", ...receipt });
  return receipt;
}

export async function repairsToCsv(filters: RepairListFilters = {}) {
  if (!isMongoConfigured()) return memoryStore.repairsToCsv(filters);
  const rows = await listRepairs(filters);
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

async function ensureSeeded() {
  if (seeded.done || !isMongoConfigured()) return;
  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();

  if ((await parties.countDocuments()) === 0) {
    await parties.insertMany(memoryStore.store.parties.map((party) => ({ _id: party.id, ...party })));
  }

  if ((await data.countDocuments({ kind: "product" })) === 0) {
    await data.insertMany(memoryStore.store.products.map((product) => ({ _id: `product:${product.id}`, kind: "product" as const, ...product })));
  }

  if ((await data.countDocuments({ kind: "user" })) === 0) {
    await data.insertMany(memoryStore.store.users.map((user) => ({ _id: `user:${user.id}`, kind: "user" as const, ...user })));
  }

  await data.createIndex({ kind: 1, id: 1 });
  await data.createIndex({ kind: 1, repairId: 1 });
  await data.createIndex({ kind: 1, currentStatus: 1 });
  await data.createIndex({ kind: 1, receivedAt: 1 });
  await parties.createIndex({ name: 1 });
  seeded.done = true;
}

async function hydrateRepair(repair: Repair): Promise<RepairDetail> {
  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();
  const [party, product, receivedBy, photos, history, receipts] = await Promise.all([
    parties.findOne({ id: repair.partyId }),
    data.findOne({ kind: "product", id: repair.productId }),
    data.findOne({ kind: "user", id: repair.receivedByUserId }),
    data.find({ kind: "photo", repairId: repair.id }).toArray(),
    data.find({ kind: "history", repairId: repair.id }).sort({ createdAt: -1 }).toArray(),
    data.find({ kind: "receipt", repairId: repair.id }).sort({ generatedAt: -1 }).toArray(),
  ]);

  if (!party || !product || !receivedBy) throw new Error("Repair master data is missing.");

  const receivedByUser = stripKind<User>(receivedBy);
  const safeRepair = normalizeRepair(repair, receivedByUser.name);

  return {
    ...safeRepair,
    party: stripId(party),
    product: stripKind<Product>(product),
    receivedBy: receivedByUser,
    photos: photos.map((item) => stripKind<RepairPhoto>(item)),
    history: history.map((item) => stripKind<RepairHistory>(item)),
    receipts: receipts.map((item) => stripKind<RepairReceipt>(item)),
  };
}

function normalizeRepair(repair: Repair, fallbackStaffName: string): Repair {
  return {
    ...repair,
    receiverStaffName: repair.receiverStaffName ?? fallbackStaffName,
    productCondition: repair.productCondition ?? repair.damageRemarks ?? "Not specified",
  };
}

async function validateCreateInput(input: CreateRepairInput) {
  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();
  if (!(await parties.findOne({ id: input.partyId }))) throw new Error("Valid party is required.");
  if (!(await data.findOne({ kind: "product", id: input.productId }))) throw new Error("Valid product is required.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Quantity must be at least 1.");
  if (input.isBilled && !input.billOrGrReference?.trim()) throw new Error("Bill/GR reference is required when billed.");
  if (!input.damageCategory) throw new Error("Damage category is required.");
  if (!input.damageRemarks?.trim()) throw new Error("Damage remarks are required.");
  if (!input.productCondition?.trim()) throw new Error("Product condition is required.");
  if (!input.receiverStaffName?.trim()) throw new Error("Receiver staff name is required.");
}

async function applyCorePatch(repair: Repair, input: Partial<CreateRepairInput>) {
  if (input.partyId) repair.partyId = input.partyId;
  if (input.productId) repair.productId = input.productId;
  if (input.quantity !== undefined) repair.quantity = input.quantity;
  if (input.isBilled !== undefined) repair.isBilled = input.isBilled;
  if (input.billOrGrReference !== undefined) repair.billOrGrReference = input.billOrGrReference;
  if (input.damageCategory) repair.damageCategory = input.damageCategory;
  if (input.damageRemarks) repair.damageRemarks = input.damageRemarks;
  if (input.productCondition) repair.productCondition = input.productCondition;
  if (input.receiverStaffName) repair.receiverStaffName = input.receiverStaffName;
  await validateCreateInput({
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

async function findRepair(id: string) {
  const data = await dataCollection<DataDoc>();
  const repair = await data.findOne({ kind: "repair", id });
  return repair ? stripKind<Repair>(repair) : undefined;
}

async function requireRepair(id: string) {
  const repair = await findRepair(id);
  if (!repair) throw new Error("Repair not found.");
  return repair;
}

async function saveRepair(repair: Repair) {
  const data = await dataCollection<DataDoc>();
  await data.replaceOne({ kind: "repair", id: repair.id }, { _id: `repair:${repair.id}`, kind: "repair", ...repair }, { upsert: true });
}

async function addHistory(
  repair: Repair,
  action: string,
  fromStatus: RepairStatus | undefined,
  toStatus: RepairStatus,
  userId: string,
  remarks?: string,
  metadata?: Record<string, unknown>,
) {
  const data = await dataCollection<DataDoc>();
  const foundUser = await data.findOne({ kind: "user", id: userId });
  const user = foundUser ? stripKind<User>(foundUser) : await currentUser();
  const history: RepairHistory = {
    id: crypto.randomUUID(),
    repairId: repair.id,
    action,
    fromStatus,
    toStatus,
    userId,
    userName: user.id === userId ? user.name : userId,
    remarks,
    metadata,
    createdAt: new Date().toISOString(),
  };
  await data.insertOne({ _id: `history:${history.id}`, kind: "history", ...history });
}

async function nextRepairNumber() {
  const key = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const data = await dataCollection<DataDoc>();
  const result = await data.findOneAndUpdate(
    { _id: `sequence:${key}`, kind: "sequence" },
    { $inc: { value: 1 }, $setOnInsert: { kind: "sequence" } } as never,
    { upsert: true, returnDocument: "after" },
  );
  return `REP-${key}-${String(Number(result?.value ?? 1)).padStart(4, "0")}`;
}

function stripKind<T>(doc: Record<string, unknown>): T {
  const { _id, kind, ...rest } = doc;
  void _id;
  void kind;
  return rest as T;
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  void _id;
  return rest;
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
