import { dataCollection, isMongoConfigured, mongoConfigError, partyCollection } from "./mongodb";
import * as memoryStore from "./store";
import { buildPdfBytes, renderReceiptHtml } from "./receipt";
import { assertValidAction, isRepairStatus, nextStatusForAction } from "./workflow";
import type {
  ActionPayload,
  CreateRepairInput,
  Party,
  Product,
  Repair,
  RepairAuditAction,
  RepairAuditEntry,
  RepairDetail,
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
  await ensureMongoReady();
  await ensureSeeded();
  const data = await dataCollection<DataDoc>();
  const user = await data.findOne({ kind: "user", role });
  return user ? stripKind<User>(user) : memoryStore.currentUser(role);
}

export async function listMasters() {
  await ensureMongoReady();
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
  await ensureMongoReady();
  await ensureSeeded();
  const data = await dataCollection<DataDoc>();
  const repairs = (await data.find({ kind: "repair" }).toArray()).map((item) => stripKind<Repair>(item));
  const hydrated = await Promise.all(repairs.map(hydrateRepair));

  return hydrated
    .filter((repair) => {
      if (filters.status && isRepairStatus(filters.status) && repair.status !== filters.status) return false;
      if (filters.party && !repair.party.name.toLowerCase().includes(filters.party.toLowerCase())) return false;
      if (filters.person) {
        const people = [
          repair.receivedFromCustomerBy,
          repair.sentToRepairBy,
          repair.receivedFromRepairBy,
          repair.sentToCustomerBy,
          ...repair.auditTimeline.map((item) => item.personName),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!people.includes(filters.person.toLowerCase())) return false;
      }
      if (filters.repairNumber && !repair.repairNumber.toLowerCase().includes(filters.repairNumber.toLowerCase())) return false;
      if (filters.from && new Date(repair.createdAt) < new Date(filters.from)) return false;
      if (filters.to && new Date(repair.createdAt) > endOfDay(filters.to)) return false;
      if (filters.search) {
        const n = filters.search.trim().toLowerCase();
        if (n) {
          const hay = [
            repair.repairNumber,
            repair.repairDateId,
            repair.status,
            repair.party.name,
            repair.productName,
            repair.productDetails,
            repair.productColor,
            repair.receivedFromCustomerBy,
            repair.sentToRepairBy,
            repair.receivedFromRepairBy,
            repair.sentToCustomerBy,
            ...repair.auditTimeline.map((item) => item.personName),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(n)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRepair(id: string) {
  await ensureMongoReady();
  await ensureSeeded();
  const repair = await findRepair(id);
  return repair ? hydrateRepair(repair) : undefined;
}

export async function createRepair(input: CreateRepairInput) {
  await ensureMongoReady();
  await ensureSeeded();
  validateCreateInput(input);

  const now = new Date().toISOString();
  const user = await currentUser("staff");
  const repair: Repair = {
    id: crypto.randomUUID(),
    repairNumber: await nextRepairNumber(input.partyName, input.productName ?? input.productDetails),
    repairDateId: buildRepairDateId(now),
    partyId: input.partyId,
    partyName: input.partyName.trim(),
    productName: input.productName?.trim() || input.productDetails.trim(),
    productDetails: input.productDetails.trim(),
    productColor: input.productColor?.trim() || undefined,
    sellingPrice: Number(input.sellingPrice),
    status: "Received",
    createdAt: now,
    updatedAt: now,
    receivedFromCustomerBy: input.receivedFromCustomerBy.trim(),
    initialRemark: input.initialRemark.trim(),
    auditTimeline: [
      buildAuditEntry("CREATE", "New", "Received", "Received from customer by", input.receivedFromCustomerBy.trim(), input.initialRemark.trim(), now),
    ],
    receivedByUserId: user.id,
  };

  try {
    const data = await dataCollection<DataDoc>();
    await data.insertOne({ _id: `repair:${repair.id}`, kind: "repair", ...repair });
    await generateReceipt(repair.id, user.id);
    return hydrateRepair(repair);
  } catch (error) {
    console.error("[repair-app] Failed to create repair.", error);
    throw new Error("Could not save repair to MongoDB.");
  }
}

export async function updateRepairWhileReceived(id: string, input: Partial<CreateRepairInput>) {
  await ensureMongoReady();
  const repair = await requireRepair(id);
  if (repair.status !== "Received") throw new Error("Only repairs in Received status can be edited.");

  const nextRepair: Repair = {
    ...repair,
    partyId: input.partyId ?? repair.partyId,
    partyName: input.partyName?.trim() ?? repair.partyName,
    productName: input.productName?.trim() || repair.productName,
    productDetails: input.productDetails?.trim() ?? repair.productDetails,
    productColor: input.productColor?.trim() || repair.productColor,
    sellingPrice: input.sellingPrice !== undefined ? Number(input.sellingPrice) : repair.sellingPrice,
    receivedFromCustomerBy: input.receivedFromCustomerBy?.trim() ?? repair.receivedFromCustomerBy,
    initialRemark: input.initialRemark?.trim() ?? repair.initialRemark,
    updatedAt: new Date().toISOString(),
  };

  validateCreateInput(nextRepair);
  nextRepair.auditTimeline = [
    ...repair.auditTimeline,
    buildAuditEntry("UPDATE", repair.status, repair.status, "Updated by", (await currentUser("staff")).name, "Repair details updated", nextRepair.updatedAt),
  ];

  try {
    await saveRepair(nextRepair);
    return hydrateRepair(nextRepair);
  } catch (error) {
    console.error("[repair-app] Failed to update repair while received.", error);
    throw new Error("Could not update repair in MongoDB.");
  }
}

export async function uploadPhoto(id: string, fileName: string, url?: string) {
  await ensureMongoReady();
  const repair = await requireRepair(id);
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

  repair.productImageDriveLink = photo.url;
  repair.productImageFileName = photo.fileName;
  repair.updatedAt = photo.uploadedAt;
  await saveRepair(repair);
  return photo;
}

export async function performAction(id: string, payload: ActionPayload, role: "staff" | "admin" = "staff") {
  await ensureMongoReady();
  const repair = await requireRepair(id);
  const user = await currentUser(role);
  assertValidAction(repair, payload, user.role);

  const now = new Date().toISOString();
  const fromStatus = repair.status;
  const toStatus = nextStatusForAction(payload.action);

  repair.status = toStatus;
  repair.updatedAt = now;

  if (payload.action === "send-to-repair") {
    repair.sentToRepairBy = payload.sentToRepairBy?.trim();
    repair.sentToRepairNote = payload.sentToRepairNote?.trim() || undefined;
    repair.auditTimeline.push(
      buildAuditEntry("SEND_TO_REPAIR", fromStatus, toStatus, "Sent to repair by", repair.sentToRepairBy ?? user.name, repair.sentToRepairNote, now),
    );
  }

  if (payload.action === "receive-from-repair") {
    repair.receivedFromRepairBy = payload.receivedFromRepairBy?.trim();
    repair.receivedFromRepairNote = payload.receivedFromRepairNote?.trim() || undefined;
    repair.auditTimeline.push(
      buildAuditEntry(
        "RECEIVE_FROM_REPAIR",
        fromStatus,
        toStatus,
        "Received from repair by",
        repair.receivedFromRepairBy ?? user.name,
        repair.receivedFromRepairNote,
        now,
      ),
    );
  }

  if (payload.action === "send-to-customer") {
    repair.sentToCustomerBy = payload.sentToCustomerBy?.trim();
    repair.sentToCustomerNote = payload.sentToCustomerNote?.trim() || undefined;
    repair.auditTimeline.push(
      buildAuditEntry("SEND_TO_CUSTOMER", fromStatus, toStatus, "Sent to customer by", repair.sentToCustomerBy ?? user.name, repair.sentToCustomerNote, now),
    );
  }

  try {
    await saveRepair(repair);
    return hydrateRepair(repair);
  } catch (error) {
    console.error(`[repair-app] Failed action ${payload.action} for repair ${id}.`, error);
    throw new Error("Could not update repair in MongoDB.");
  }
}

export async function generateReceipt(id: string, userId?: string) {
  await ensureMongoReady();
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
  const rows = await listRepairs(filters);
  const header = ["Repair Number", "Date ID", "Status", "Party", "Product Details", "Selling Price", "Person"];
  const body = rows.map((repair) => [
    repair.repairNumber,
    repair.repairDateId,
    repair.status,
    repair.party.name,
    repair.productDetails,
    String(repair.sellingPrice),
    latestPerson(repair),
  ]);
  return [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
}

async function ensureMongoReady() {
  if (!isMongoConfigured()) {
    throw new Error(`${mongoConfigError()} Repair APIs will not use the in-memory demo store anymore.`);
  }
}

async function ensureSeeded() {
  if (seeded.done) return;
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
  await data.createIndex({ kind: 1, status: 1 });
  await data.createIndex({ kind: 1, createdAt: 1 });
  await parties.createIndex({ name: 1 });
  seeded.done = true;
}

async function hydrateRepair(repair: Repair): Promise<RepairDetail> {
  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();
  const [party, photos, receipts, receivedBy] = await Promise.all([
    repair.partyId ? parties.findOne({ _id: repair.partyId }) : Promise.resolve(null),
    data.find({ kind: "photo", repairId: repair.id }).toArray(),
    data.find({ kind: "receipt", repairId: repair.id }).sort({ generatedAt: -1 }).toArray(),
    repair.receivedByUserId ? data.findOne({ kind: "user", id: repair.receivedByUserId }) : Promise.resolve(null),
  ]);

  const safeParty: Party = party
    ? stripId(party)
    : {
        id: repair.partyId ?? `manual:${repair.id}`,
        name: repair.partyName,
        phone: "",
        type: "Customer",
      };

  const safeProduct: Product = {
    id: `manual:${repair.id}`,
    code: "",
    name: repair.productName || repair.productDetails,
    color: repair.productColor ?? "",
    saleRate: repair.sellingPrice,
    purchaseRate: 0,
  };

  return {
    ...repair,
    party: safeParty,
    product: safeProduct,
    receivedBy: receivedBy ? stripKind<User>(receivedBy) : undefined,
    photos: photos.map((item) => stripKind<RepairPhoto>(item)).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    receipts: receipts.map((item) => stripKind<RepairReceipt>(item)),
    auditTimeline: [...repair.auditTimeline].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

function validateCreateInput(input: CreateRepairInput | Repair) {
  if (!input.partyName?.trim()) throw new Error("Party name is required.");
  if (!input.productDetails?.trim()) throw new Error("Product details are required.");
  if (!input.initialRemark?.trim()) throw new Error("Remark is required.");
  if (!input.receivedFromCustomerBy?.trim()) throw new Error("Received from customer by is required.");
  const sellingPrice = Number(input.sellingPrice);
  if (!Number.isFinite(sellingPrice)) throw new Error("Selling price is required.");
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

function buildAuditEntry(
  action: RepairAuditAction,
  previousStatus: RepairStatus | "New",
  newStatus: RepairStatus,
  roleLabel: string,
  personName: string,
  note: string | undefined,
  createdAt: string,
): RepairAuditEntry {
  return {
    id: crypto.randomUUID(),
    action,
    previousStatus,
    newStatus,
    roleLabel,
    personName,
    note: note?.trim() || undefined,
    createdAt,
  };
}

async function nextRepairNumber(partyName: string, productName = "") {
  const prefix = `${prefixPart(partyName)}${prefixPart(productName)}`;
  const data = await dataCollection<DataDoc>();
  for (let i = 0; i < 100; i += 1) {
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, "0");
    const candidate = `${prefix}${suffix}`;
    if (!(await data.findOne({ kind: "repair", repairNumber: candidate }))) return candidate;
  }
  throw new Error("Could not generate a unique repair ID. Try again.");
}

function prefixPart(value: string) {
  return (value.replace(/[^a-z0-9]/gi, "").toUpperCase() + "XX").slice(0, 2);
}

function buildRepairDateId(value: string) {
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
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

function latestPerson(repair: Repair) {
  return (
    repair.sentToCustomerBy ||
    repair.receivedFromRepairBy ||
    repair.sentToRepairBy ||
    repair.receivedFromCustomerBy
  );
}
