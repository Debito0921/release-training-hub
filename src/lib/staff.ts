import type { Staff } from "./types";

/**
 * The pre-loaded staff list. People pick their name after scanning the QR code,
 * so there is no password but every score is still tied to a real person and
 * department. Replace this with the real HR list later.
 */
export const STAFF: Staff[] = [
  { id: "s01", name: "Aisyah Rahman", department: "Sales" },
  { id: "s02", name: "Brandon Lee", department: "Sales" },
  { id: "s03", name: "Chong Wei Ming", department: "Sales" },
  { id: "s04", name: "Divya Nair", department: "Sales" },
  { id: "s05", name: "Faizal Omar", department: "Sales" },
  { id: "s06", name: "Grace Tan", department: "Support" },
  { id: "s07", name: "Hafiz Ismail", department: "Support" },
  { id: "s08", name: "Irene Koh", department: "Support" },
  { id: "s09", name: "Jason Lim", department: "Support" },
  { id: "s10", name: "Kavitha Raj", department: "Support" },
  { id: "s11", name: "Lydia Wong", department: "Support" },
  { id: "s12", name: "Melissa Yap", department: "Finance" },
  { id: "s13", name: "Nazri Hassan", department: "Finance" },
  { id: "s14", name: "Olivia Cheah", department: "Finance" },
  { id: "s15", name: "Pravin Kumar", department: "Finance" },
  { id: "s16", name: "Rachel Goh", department: "HR" },
  { id: "s17", name: "Siti Nurhaliza", department: "HR" },
  { id: "s18", name: "Tan Boon Huat", department: "HR" },
  { id: "s19", name: "Usha Devi", department: "HR" },
  { id: "s20", name: "Vincent Ooi", department: "HR" },
];

export const DEPARTMENTS = ["Sales", "Support", "Finance", "HR"] as const;

export function staffById(id: string): Staff | undefined {
  return STAFF.find((s) => s.id === id);
}
