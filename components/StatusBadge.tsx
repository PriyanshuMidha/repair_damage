import { statusClass } from "@/lib/workflow";
import type { RepairStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: RepairStatus }) {
  return <span className={`status ${statusClass(status)}`}>{status}</span>;
}
