export const toPaise = (rupees) => Math.round(rupees * 100);
export const inr = (paise) => `₹${new Intl.NumberFormat("en-IN").format(paise / 100)}`;
export const dueOf = ({ charge = 0, payment = 0, scholarship = 0 } = {}) => charge - payment - scholarship;

// Both dates are YYYY-MM-DD strings.
export function overdueDays(dueDate, today) {
  if (!dueDate) return 0;
  const d = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000);
  return Math.max(0, d);
}
export function statusOf(due, days) {
  if (due <= 0) return "CLEARED";
  if (days > 60) return "CRITICAL";
  if (days > 0) return "OVERDUE";
  return "PENDING";
}
// Assumption: no advance payments, so an amount may never exceed what is due.
export function checkAmount(paise, due) {
  if (!Number.isInteger(paise) || paise <= 0) return "INVALID";
  if (due <= 0) return "NO_DUE";
  if (paise > due) return "TOO_MUCH";
  return null;
}
// "2026-27" for a batch that started in 2024 means study year 3.
export const studyYear = (startYear, term) => Number(term.slice(0, 4)) - startYear + 1;
export const receiptLabel = (n, year) => `RCT-${year}-${String(n).padStart(6, "0")}`;

// The Odia text needs review by a native speaker before launch (noted in the TDD).
export const feeLinkMessage = (name, paise, url) => ({
  en: `Dear Guardian, ${inr(paise)} is due for ${name}. Pay securely here (test mode): ${url}`,
  od: `ପ୍ରିୟ ଅଭିଭାବକ, ${name} ଙ୍କ ପାଇଁ ${inr(paise)} ବାକି ଅଛି। ପେମେଣ୍ଟ ଲିଙ୍କ (ଟେଷ୍ଟ ମୋଡ୍): ${url}`,
});
export const feeReminderMessage = (name, rollNo, paise, days) => ({
  en: `Dear Guardian, the fee of ${inr(paise)} for ${name} (${rollNo}) is overdue by ${days} days. Please contact the accounts office.`,
  od: `ପ୍ରିୟ ଅଭିଭାବକ, ${name} (${rollNo}) ଙ୍କ ${inr(paise)} ଫି ${days} ଦିନ ଧରି ବାକି ଅଛି। ଦୟାକରି ଆକାଉଣ୍ଟସ୍ ଅଫିସ୍ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।`,
});