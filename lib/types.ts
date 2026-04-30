export const REPAIR_STATUSES = [
  "Received",
  "Repair In Progress",
  "Received After Repair",
  "Ready To Return",
  "Rework Required",
  "Repair Failed",
  "Returned To Customer",
  "Cancelled",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const DAMAGE_CATEGORIES = [
  "Screen/Glass Damage",
  "Body Damage",
  "Water Damage",
  "Electrical Fault",
  "Missing Part",
  "Packaging Damage",
  "Other",
] as const;

export type DamageCategory = (typeof DAMAGE_CATEGORIES)[number];

export const DELIVERY_MODES = ["By Hand", "Courier", "Transport", "Other"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

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

export type RepairHistory = {
  id: string;
  repairId: string;
  action: string;
  fromStatus?: RepairStatus;
  toStatus: RepairStatus;
  userId: string;
  userName: string;
  remarks?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type Repair = {
  id: string;
  repairNumber: string;
  partyId: string;
  productId: string;
  quantity: number;
  isBilled: boolean;
  billOrGrReference?: string;
  damageCategory: DamageCategory;
  damageRemarks: string;
  productCondition: string;
  currentStatus: RepairStatus;
  receivedByUserId: string;
  receiverStaffName: string;
  createdAt: string;
  updatedAt: string;
  receivedAt: string;
  sentToRepairAt?: string;
  receivedAfterRepairAt?: string;
  readyToReturnAt?: string;
  reworkRequiredAt?: string;
  repairFailedAt?: string;
  returnedAt?: string;
  cancelledAt?: string;
  repairCenter?: string;
  sentToRepairByStaffName?: string;
  receivedAfterRepairByStaffName?: string;
  checkedByStaffName?: string;
  returnedByStaffName?: string;
  returnReceivedBy?: string;
  deliveryMode?: DeliveryMode;
  courierName?: string;
  trackingNumber?: string;
  transportName?: string;
  returnRemarks?: string;
  cancellationReason?: string;
  correctionReason?: string;
};

export type RepairDetail = Repair & {
  party: Party;
  product: Product;
  receivedBy: User;
  photos: RepairPhoto[];
  history: RepairHistory[];
  receipts: RepairReceipt[];
};

export type CreateRepairInput = {
  partyId: string;
  productId: string;
  quantity: number;
  isBilled: boolean;
  billOrGrReference?: string;
  damageCategory: DamageCategory;
  damageRemarks: string;
  productCondition: string;
  receiverStaffName: string;
};

export type RepairListFilters = {
  status?: string;
  party?: string;
  productCode?: string;
  staff?: string;
  repairNumber?: string;
  from?: string;
  to?: string;
};

export type ActionPayload = {
  action:
    | "send-to-repair"
    | "receive-from-repair"
    | "mark-ready"
    | "mark-rework"
    | "mark-failed"
    | "return-to-customer"
    | "cancel"
    | "admin-correct";
  remarks?: string;
  repairCenter?: string;
  sentToRepairByStaffName?: string;
  receivedAfterRepairByStaffName?: string;
  checkedByStaffName?: string;
  returnedByStaffName?: string;
  returnReceivedBy?: string;
  deliveryMode?: DeliveryMode;
  courierName?: string;
  trackingNumber?: string;
  transportName?: string;
  patch?: Partial<CreateRepairInput>;
};
