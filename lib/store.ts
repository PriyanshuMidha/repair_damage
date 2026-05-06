import { assertValidAction, isRepairStatus, nextStatusForAction } from "./workflow";
import { buildPdfBytes, renderReceiptHtml } from "./receipt";
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

type DataStore = {
  parties: Party[];
  products: Product[];
  users: User[];
  repairs: Repair[];
  photos: RepairPhoto[];
  receipts: RepairReceipt[];
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
    receipts: [],
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
    .filter((repair) => !repair.isDeleted)
    .map(hydrateRepair)
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

export function getRepair(id: string) {
  const repair = store.repairs.find((item) => item.id === id && !item.isDeleted);
  return repair ? hydrateRepair(repair) : undefined;
}

export function createRepair(input: CreateRepairInput) {
  validateCreateInput(input);
  const now = new Date().toISOString();
  const user = currentUser("staff");
  const repair: Repair = {
    id: crypto.randomUUID(),
    repairNumber: nextRepairNumber(input.partyName, input.productName ?? input.productDetails),
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

  store.repairs.push(repair);
  generateReceipt(repair.id, user.id);
  return hydrateRepair(repair);
}

export function updateRepairWhileReceived(id: string, input: Partial<CreateRepairInput>) {
  const repair = findRepair(id);
  if (repair.status !== "Received") {
    throw new Error("Only repairs in Received status can be edited.");
  }

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
    buildAuditEntry("UPDATE", repair.status, repair.status, "Updated by", currentUser("staff").name, "Repair details updated", nextRepair.updatedAt),
  ];

  replaceRepair(nextRepair);
  return hydrateRepair(nextRepair);
}

export function uploadPhoto(
  id: string,
  fileName: string,
  url?: string,
  kind: "product" | "proof" = "product",
  options?: Pick<RepairPhoto, "previewUrl" | "driveFileId" | "linkType">,
) {
  const repair = findRepair(id);
  const user = currentUser("staff");
  const photo: RepairPhoto = {
    id: crypto.randomUUID(),
    repairId: id,
    fileName: fileName.trim() || "repair-photo.jpg",
    url: url?.trim() || `/uploads/${encodeURIComponent(fileName.trim() || "repair-photo.jpg")}`,
    kind,
    previewUrl: options?.previewUrl,
    driveFileId: options?.driveFileId,
    linkType: options?.linkType,
    uploadedByUserId: user.id,
    uploadedAt: new Date().toISOString(),
  };
  store.photos.push(photo);

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
  return photo;
}

export function performAction(id: string, payload: ActionPayload, role: "staff" | "admin" = "staff") {
  const repair = findRepair(id);
  const user = currentUser(role);
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

  return hydrateRepair(repair);
}

export function softDeleteRepair(id: string, deleteReason?: string) {
  const repair = findRepair(id);
  const user = currentUser("staff");
  const now = new Date().toISOString();

  repair.isDeleted = true;
  repair.deletedAt = now;
  repair.deletedBy = user.name;
  repair.deleteReason = deleteReason?.trim() || undefined;
  repair.updatedAt = now;
  repair.auditTimeline.push(buildAuditEntry("DELETE", repair.status, repair.status, "Deleted by", user.name, repair.deleteReason, now));

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

function hydrateRepair(repair: Repair): RepairDetail {
  const party = store.parties.find((item) => item.id === repair.partyId) ?? {
    id: repair.partyId ?? `manual:${repair.id}`,
    name: repair.partyName,
    phone: "",
    type: "Customer" as const,
  };
  const product = store.products.find((item) => item.id === repair.productName) ?? {
    id: `manual:${repair.id}`,
    code: "",
    name: repair.productName || repair.productDetails,
    color: repair.productColor ?? "",
    saleRate: repair.sellingPrice,
    purchaseRate: 0,
  };
  const receivedBy = repair.receivedByUserId ? store.users.find((item) => item.id === repair.receivedByUserId) : undefined;

  return {
    ...repair,
    party,
    product,
    receivedBy,
    photos: store.photos.filter((item) => item.repairId === repair.id).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    receipts: store.receipts.filter((item) => item.repairId === repair.id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
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

function findRepair(id: string) {
  const repair = store.repairs.find((item) => item.id === id && !item.isDeleted);
  if (!repair) throw new Error("Repair not found.");
  return repair;
}

function replaceRepair(repair: Repair) {
  const index = store.repairs.findIndex((item) => item.id === repair.id);
  if (index === -1) throw new Error("Repair not found.");
  store.repairs[index] = repair;
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

function nextRepairNumber(partyName: string, productName = "") {
  const prefix = `${prefixPart(partyName)}${prefixPart(productName)}`;
  for (let i = 0; i < 100; i += 1) {
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, "0");
    const candidate = `${prefix}${suffix}`;
    if (!store.repairs.find((item) => item.repairNumber === candidate)) return candidate;
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
