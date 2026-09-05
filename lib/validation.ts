import { z } from "zod";

export const createRepairSchema = z.object({
  partyId: z.string().trim().min(1).optional(),
  partyName: z.string().trim().min(1, "Party name is required."),
  productName: z.string().trim().min(1).optional(),
  productDetails: z.string().trim().min(1, "Product details are required."),
  productColor: z.string().trim().min(1).optional(),
  sellingPrice: z.coerce.number().nonnegative("Selling price must be a positive number."),
  initialRemark: z.string().trim().min(1, "Initial remark is required."),
  receivedFromCustomerBy: z.string().trim().min(1, "Received from customer by is required."),
});

export const updateRepairSchema = createRepairSchema.partial();

export function formatZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}
