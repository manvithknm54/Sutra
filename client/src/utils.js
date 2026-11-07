export const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const TITLE = /^(Dr\.|Prof\.)\s+/;
export const firstName = (n) => { const m = n.match(/^(Dr\.|Prof\.)\s+(\S+)/); return m ? `${m[1]} ${m[2]}` : n.split(" ")[0]; };
export const initials = (n) => n.replace(TITLE, "").split(" ").map((w) => w[0]).slice(0, 2).join("");
export const longDate = () =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const rupees = (paise) => INR.format((paise ?? 0) / 100);
export const dateIN = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const timeIN = (iso) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
// Neutralises spreadsheet formula injection (a name like =HYPERLINK(...)) before writing a CSV cell.
export const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function downloadCsv(name, head, rows) {
  const body = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + body + "\r\n"], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}