export const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const TITLE = /^(Dr\.|Prof\.)\s+/;
export const firstName = (n) => { const m = n.match(/^(Dr\.|Prof\.)\s+(\S+)/); return m ? `${m[1]} ${m[2]}` : n.split(" ")[0]; };
export const initials = (n) => n.replace(TITLE, "").split(" ").map((w) => w[0]).slice(0, 2).join("");
export const longDate = () =>
  new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());