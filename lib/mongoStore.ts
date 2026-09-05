import bcrypt from "bcryptjs";
import { dataCollection, isMongoConfigured, mongoConfigError, partyCollection } from "./mongodb";
import * as memoryStore from "./store";
import { buildPdfBytes, renderReceiptHtml } from "./receipt";
import { deleteImageFromR2 } from "./r2Server";
import { assertValidAction, isRepairStatus, nextStatusForAction } from "./workflow";
import type {
  ActionPayload,
  AuthUser,
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
let mastersCache: Awaited<ReturnType<typeof readMasters>> | undefined;

export async function currentUser(role: "staff" | "admin" = "admin") {
  if (shouldUseMemoryStore()) return memoryStore.currentUser(role);
  await ensureMongoReady();
  await ensureSeeded();
  const data = await dataCollection<DataDoc>();
  const user = await data.findOne({ kind: "user", role });
  return user ? toPublicUser(user) : toPublicUser(memoryStore.currentUser(role));
}

export async function listMasters() {
  if (shouldUseMemoryStore()) return memoryStore.listMasters();
  await ensureMongoReady();
  await ensureSeeded();
  mastersCache ??= await readMasters();
  return mastersCache;
}

async function readMasters() {
  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();

  return {
    parties: (await parties.find().toArray()).map(stripId),
    products: (await data.find({ kind: "product" }).toArray()).map((item) => stripKind<Product>(item)),
    users: (await data.find({ kind: "user" }).toArray()).map((item) => toPublicUser(item)),
  };
}

export async function listRepairs(filters: RepairListFilters = {}) {
  if (shouldUseMemoryStore()) return memoryStore.listRepairs(filters);
  await ensureMongoReady();
  await ensureSeeded();

  let hydrated: RepairDetail[];
  try {
    const data = await dataCollection<DataDoc>();
    const repairs = (await data.find({ kind: "repair", $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] }).toArray()).map((item) =>
      stripKind<Repair>(item),
    );
    hydrated = await hydrateRepairsForList(repairs);
  } catch (error) {
    console.error("[repair-app] Failed to list repairs.", error);
    throw new Error("Could not load repairs from MongoDB.");
  }

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
  if (shouldUseMemoryStore()) return memoryStore.getRepair(id);
  await ensureMongoReady();
  await ensureSeeded();
  try {
    const repair = await findRepair(id);
    return repair ? await hydrateRepair(repair) : undefined;
  } catch (error) {
    console.error(`[repair-app] Failed to load repair ${id}.`, error);
    throw new Error("Could not load repair from MongoDB.");
  }
}

export async function createRepair(input: CreateRepairInput) {
  if (shouldUseMemoryStore()) return memoryStore.createRepair(input);
  await ensureMongoReady();
  await ensureSeeded();
  validateCreateInput(input);

  const now = new Date().toISOString();
  const user = await currentUser("staff");
  const repairPrefix = repairNumberPrefix(input.partyName, input.productName ?? input.productDetails);
  const repair: Repair = {
    id: crypto.randomUUID(),
    repairNumber: randomRepairNumber(repairPrefix),
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

  const data = await dataCollection<DataDoc>();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await data.insertOne({ _id: `repair:${repair.id}`, kind: "repair", ...repair });
      const detail = await hydrateRepair(repair);
      await generateReceiptForRepair(detail, user.id);
      return detail;
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt < 9) {
        repair.repairNumber = randomRepairNumber(repairPrefix);
        continue;
      }
      console.error("[repair-app] Failed to create repair.", error);
      throw new Error("Could not save repair to MongoDB.");
    }
  }
  throw new Error("Could not generate a unique repair number. Try again.");
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
}

export async function updateRepairWhileReceived(id: string, input: Partial<CreateRepairInput>) {
  if (shouldUseMemoryStore()) return memoryStore.updateRepairWhileReceived(id, input);
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

export async function uploadPhoto(
  id: string,
  fileName: string,
  url?: string,
  kind: "product" | "proof" = "product",
  options?: Pick<RepairPhoto, "previewUrl" | "driveFileId" | "linkType" | "storageKey">,
) {
  if (shouldUseMemoryStore()) return memoryStore.uploadPhoto(id, fileName, url, kind, options);
  await ensureMongoReady();
  const repair = await requireRepair(id);
  const user = await currentUser("staff");
  const photo: RepairPhoto = {
    id: crypto.randomUUID(),
    repairId: id,
    fileName: fileName.trim() || "repair-photo.jpg",
    url: url?.trim() || `/uploads/${encodeURIComponent(fileName.trim() || "repair-photo.jpg")}`,
    kind,
    previewUrl: options?.previewUrl,
    driveFileId: options?.driveFileId,
    linkType: options?.linkType,
    storageKey: options?.storageKey,
    uploadedByUserId: user.id,
    uploadedAt: new Date().toISOString(),
  };

  const data = await dataCollection<DataDoc>();
  await data.insertOne({ _id: `photo:${photo.id}`, kind: "photo", ...photo });

  if (kind === "product") {
    repair.damagePhotoDriveId = photo.driveFileId;
    repair.damagePhotoUrl = photo.url;
    repair.damagePhotoPreviewUrl = photo.previewUrl;
    repair.damagePhotoFileName = photo.fileName;
  }
  if (kind === "proof") {
    repair.sendingPhotoDriveId = photo.driveFileId;
    repair.sendingPhotoUrl = photo.url;
    repair.sendingPhotoPreviewUrl = photo.previewUrl;
    repair.sendingPhotoFileName = photo.fileName;
  }
  repair.updatedAt = photo.uploadedAt;
  await saveRepair(repair);
  return photo;
}

export async function deletePhoto(id: string, photoId: string) {
  if (shouldUseMemoryStore()) return memoryStore.deletePhoto(id, photoId);
  await ensureMongoReady();
  const repair = await requireRepair(id);
  const data = await dataCollection<DataDoc>();
  const photoDoc = await data.findOne({ kind: "photo", id: photoId, repairId: id });
  if (!photoDoc) throw new Error("Photo not found.");

  const photo = stripKind<RepairPhoto>(photoDoc);
  if (photo.linkType === "r2-object" && photo.storageKey) {
    await deleteImageFromR2(photo.storageKey);
  }

  await data.deleteOne({ kind: "photo", id: photoId, repairId: id });
  clearRepairPhotoReference(repair, photo);
  repair.updatedAt = new Date().toISOString();
  await saveRepair(repair);
  return hydrateRepair(repair);
}

export async function performAction(id: string, payload: ActionPayload, role: "staff" | "admin" = "staff") {
  if (shouldUseMemoryStore()) return memoryStore.performAction(id, payload, role);
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
      buildAuditEntry("SEND_TO_CUSTOMER", fromStatus, toStatus, "Sent to customer by", repair.sentToCustomerBy ?? user.name, repair.sentToCustomerNote, now, {
        sendingMedium: payload.sentToCustomerSendingMedium?.trim() || undefined,
        proofPhotoDriveId: payload.sentToCustomerProofPhotoDriveId?.trim() || undefined,
        proofPhotoUrl: payload.sentToCustomerProofPhotoUrl?.trim() || undefined,
        proofPhotoPreviewUrl: payload.sentToCustomerProofPhotoPreviewUrl?.trim() || undefined,
        proofPhotoFileName: payload.sentToCustomerProofPhotoFileName?.trim() || undefined,
      }),
    );
  }

  if (payload.action === "mark-as-gr") {
    repair.grBy = payload.grBy?.trim();
    repair.grNote = payload.grNote?.trim() || undefined;
    repair.auditTimeline.push(buildAuditEntry("MARK_AS_GR", fromStatus, toStatus, "Marked as GR by", repair.grBy ?? user.name, repair.grNote, now));
  }

  try {
    await saveRepair(repair);
    return hydrateRepair(repair);
  } catch (error) {
    console.error(`[repair-app] Failed action ${payload.action} for repair ${id}.`, error);
    throw new Error("Could not update repair in MongoDB.");
  }
}

export async function softDeleteRepair(id: string, deleteReason?: string) {
  if (shouldUseMemoryStore()) return memoryStore.softDeleteRepair(id, deleteReason);
  await ensureMongoReady();
  const repair = await requireRepair(id);
  const user = await currentUser("staff");
  const now = new Date().toISOString();

  repair.isDeleted = true;
  repair.deletedAt = now;
  repair.deletedBy = user.name;
  repair.deleteReason = deleteReason?.trim() || undefined;
  repair.updatedAt = now;
  repair.auditTimeline.push(buildAuditEntry("DELETE", repair.status, repair.status, "Deleted by", user.name, repair.deleteReason, now));

  try {
    await saveRepair(repair);
    return hydrateRepair(repair);
  } catch (error) {
    console.error(`[repair-app] Failed to soft delete repair ${id}.`, error);
    throw new Error("Could not delete repair in MongoDB.");
  }
}

export async function generateReceipt(id: string, userId?: string) {
  if (shouldUseMemoryStore()) return memoryStore.generateReceipt(id, userId);
  await ensureMongoReady();
  const repair = await getRepair(id);
  if (!repair) throw new Error("Repair not found.");
  const user = userId ?? (await currentUser("staff")).id;
  return generateReceiptForRepair(repair, user);
}

async function generateReceiptForRepair(repair: RepairDetail, user: string) {
  const receipt: RepairReceipt = {
    id: crypto.randomUUID(),
    repairId: repair.id,
    htmlPath: `/repairs/${repair.id}/receipt`,
    pdfPath: `/api/repairs/${repair.id}/receipt/pdf`,
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
  if (shouldUseMemoryStore()) return memoryStore.repairsToCsv(filters);
  const rows = await listRepairs(filters);
  const header = ["Repair Number", "Date ID", "Status", "Party", "Product Code", "Selling Price", "Person"];
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
    throw new Error(`${mongoConfigError()} Add MONGODB_URI to the server environment.`);
  }
}

function shouldUseMemoryStore() {
  return !isMongoConfigured() && process.env.NODE_ENV !== "production";
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

  await data.deleteMany({ kind: "user", username: { $exists: false } });

  if ((await data.countDocuments({ kind: "user" })) === 0) {
    const users = await seedAuthUsers();
    await data.insertMany(users.map((user) => ({ _id: `user:${user.id}`, kind: "user" as const, ...user })));
  }

  await data.createIndex({ kind: 1, id: 1 });
  await data.createIndex({ kind: 1, repairId: 1 });
  await data.createIndex({ kind: 1, status: 1 });
  await data.createIndex({ kind: 1, createdAt: 1 });
  await data.createIndex(
    { repairNumber: 1 },
    { unique: true, partialFilterExpression: { kind: "repair" } },
  );
  await data.createIndex(
    { username: 1 },
    { unique: true, partialFilterExpression: { kind: "user" } },
  );
  await parties.createIndex({ name: 1 });
  seeded.done = true;
}

function seedAuthUsers() {
  const isProd = process.env.NODE_ENV === "production";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || (isProd ? undefined : "admin123");
  const staffPassword = process.env.STAFF_PASSWORD?.trim() || (isProd ? undefined : "staff123");

  if (!adminPassword || !staffPassword) {
    throw new Error("ADMIN_PASSWORD and STAFF_PASSWORD must be set in the production server environment.");
  }

  return Promise.all([
    hashSeedUser({ id: "user-admin", name: "Admin User", role: "admin", username: process.env.ADMIN_USERNAME?.trim() || "admin", password: adminPassword }),
    hashSeedUser({ id: "user-staff", name: "Counter Staff", role: "staff", username: process.env.STAFF_USERNAME?.trim() || "staff", password: staffPassword }),
  ]);
}

async function hashSeedUser(input: { id: string; name: string; role: User["role"]; username: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return { id: input.id, name: input.name, role: input.role, username: input.username, passwordHash };
}

export async function findAuthUserByUsername(username: string): Promise<AuthUser | undefined> {
  if (shouldUseMemoryStore()) return memoryStore.findAuthUserByUsername(username);
  await ensureMongoReady();
  await ensureSeeded();
  const data = await dataCollection<DataDoc>();
  const user = await data.findOne({ kind: "user", username });
  return user ? stripKind<AuthUser>(user) : undefined;
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
    receivedBy: receivedBy ? toPublicUser(receivedBy) : undefined,
    photos: photos.map((item) => stripKind<RepairPhoto>(item)).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    receipts: receipts.map((item) => stripKind<RepairReceipt>(item)),
    auditTimeline: [...repair.auditTimeline].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

async function hydrateRepairsForList(repairs: Repair[]): Promise<RepairDetail[]> {
  if (repairs.length === 0) return [];

  const parties = await partyCollection<PartyDoc>();
  const data = await dataCollection<DataDoc>();
  const partyIds = [...new Set(repairs.map((repair) => repair.partyId).filter((id): id is string => Boolean(id)))];
  const userIds = [...new Set(repairs.map((repair) => repair.receivedByUserId).filter((id): id is string => Boolean(id)))];

  const [partyDocs, userDocs] = await Promise.all([
    partyIds.length ? parties.find({ _id: { $in: partyIds } }).toArray() : Promise.resolve([]),
    userIds.length ? data.find({ kind: "user", id: { $in: userIds } }).toArray() : Promise.resolve([]),
  ]);

  const partiesById = new Map(partyDocs.map((party) => [party._id, stripId(party) as Party]));
  const usersById = new Map(userDocs.map((user) => [String(user.id), toPublicUser(user)]));

  return repairs.map((repair) => {
    const safeParty: Party = repair.partyId && partiesById.has(repair.partyId)
      ? partiesById.get(repair.partyId)!
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
      receivedBy: repair.receivedByUserId ? usersById.get(repair.receivedByUserId) : undefined,
      photos: [],
      receipts: [],
      auditTimeline: [...repair.auditTimeline].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  });
}

function validateCreateInput(input: CreateRepairInput | Repair) {
  if (!input.partyName?.trim()) throw new Error("Party name is required.");
  if (!input.productDetails?.trim()) throw new Error("Product details are required.");
  if (!input.initialRemark?.trim()) throw new Error("Remark is required.");
  if (!input.receivedFromCustomerBy?.trim()) throw new Error("Received from customer by is required.");
  const sellingPrice = Number(input.sellingPrice);
  if (!Number.isFinite(sellingPrice)) throw new Error("Selling price is required.");
}

function clearRepairPhotoReference(repair: Repair, photo: RepairPhoto) {
  if (repair.damagePhotoUrl === photo.url || repair.damagePhotoDriveId === photo.driveFileId) {
    repair.damagePhotoDriveId = undefined;
    repair.damagePhotoUrl = undefined;
    repair.damagePhotoPreviewUrl = undefined;
    repair.damagePhotoFileName = undefined;
  }
  if (repair.sendingPhotoUrl === photo.url || repair.sendingPhotoDriveId === photo.driveFileId) {
    repair.sendingPhotoDriveId = undefined;
    repair.sendingPhotoUrl = undefined;
    repair.sendingPhotoPreviewUrl = undefined;
    repair.sendingPhotoFileName = undefined;
  }
}

async function findRepair(id: string) {
  const data = await dataCollection<DataDoc>();
  const repair = await data.findOne({ kind: "repair", id, $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] });
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
  metadata?: {
    sendingMedium?: string;
    proofPhotoDriveId?: string;
    proofPhotoUrl?: string;
    proofPhotoPreviewUrl?: string;
    proofPhotoFileName?: string;
  },
): RepairAuditEntry {
  return {
    id: crypto.randomUUID(),
    action,
    previousStatus,
    newStatus,
    roleLabel,
    personName,
    note: note?.trim() || undefined,
    metadata,
    createdAt,
  };
}

function repairNumberPrefix(partyName: string, productName = "") {
  return `${prefixPart(partyName)}${prefixPart(productName)}`;
}

function randomRepairNumber(prefix: string) {
  const suffix = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${prefix}${suffix}`;
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

function toPublicUser(doc: Record<string, unknown>): User {
  return { id: doc.id as string, name: doc.name as string, role: doc.role as User["role"] };
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
