export const REPAIR_STATUSES = [
  "Received",
  "Repair In Progress",
  "Repair Received",
  "Sent to Customer",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export type Role = "staff" | "admin";

export type Party = {
  id: string;
  name: string;
  phone: string;
  type: "Customer" | "Dealer" | "Vendor";
};

export type Product = {
  id: string;
  code: string;
  name: string;
  color: string;
  saleRate: number;
  purchaseRate: number;
};

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type RepairPhoto = {
  id: string;
  repairId: string;
  fileName: string;
  url: string;
  kind?: "product" | "proof";
  uploadedByUserId: string;
  uploadedAt: string;
};

export type RepairReceipt = {
  id: string;
  repairId: string;
  htmlPath: string;
  pdfPath: string;
  generatedAt: string;
  generatedByUserId: string;
  lastError?: string;
};

export type RepairAuditAction = "CREATE" | "SEND_TO_REPAIR" | "RECEIVE_FROM_REPAIR" | "SEND_TO_CUSTOMER" | "UPDATE" | "DELETE";

export type RepairAuditEntry = {
  id: string;
  action: RepairAuditAction;
  previousStatus?: RepairStatus | "New";
  newStatus: RepairStatus;
  roleLabel: string;
  personName: string;
  note?: string;
  metadata?: {
    sendingMedium?: string;
    proofPhotoUrl?: string;
    proofPhotoFileName?: string;
  };
  createdAt: string;
};

export type Repair = {
  id: string;
  repairNumber: string;
  repairDateId: string;
  partyId?: string;
  partyName: string;
  productName?: string;
  productDetails: string;
  productColor?: string;
  sellingPrice: number;
  status: RepairStatus;
  createdAt: string;
  updatedAt: string;
  receivedFromCustomerBy: string;
  sentToRepairBy?: string;
  receivedFromRepairBy?: string;
  sentToCustomerBy?: string;
  initialRemark: string;
  sentToRepairNote?: string;
  receivedFromRepairNote?: string;
  sentToCustomerNote?: string;
  productImageDriveLink?: string;
  productImageFileName?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  auditTimeline: RepairAuditEntry[];
  receivedByUserId?: string;
};

export type RepairDetail = Repair & {
  party: Party;
  product: Product;
  receivedBy?: User;
  photos: RepairPhoto[];
  receipts: RepairReceipt[];
};

export type CreateRepairInput = {
  partyId?: string;
  partyName: string;
  productName?: string;
  productDetails: string;
  productColor?: string;
  sellingPrice: number;
  initialRemark: string;
  receivedFromCustomerBy: string;
};

export type RepairListFilters = {
  status?: string;
  party?: string;
  person?: string;
  repairNumber?: string;
  from?: string;
  to?: string;
  search?: string;
};

export type ActionPayload = {
  action: "send-to-repair" | "receive-from-repair" | "send-to-customer";
  sentToRepairBy?: string;
  sentToRepairNote?: string;
  receivedFromRepairBy?: string;
  receivedFromRepairNote?: string;
  sentToCustomerBy?: string;
  sentToCustomerNote?: string;
  sentToCustomerSendingMedium?: string;
  sentToCustomerProofPhotoUrl?: string;
  sentToCustomerProofPhotoFileName?: string;
};
