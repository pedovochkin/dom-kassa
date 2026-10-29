export const FEE_CENTS = 130000;
export function feeFor(config: Config, apartment: string) { return config.fees?.[apartment] ?? (apartment === "91" ? 100000 : apartment === "87" ? 110000 : config.defaultFeeCents ?? FEE_CENTS); }
export type Config = { name: string; apartments: string[]; startMonth: string; openingCents: number; salaryCents: number; defaultFeeCents?: number; fees?: Record<string, number>; version?: string };
export type Payment = { id: string; apartment: string; month: string; amountCents: number; createdAt: string; version?: string };
export type Expense = { id: string; month: string; category: string; title: string; amountCents: number; createdAt: string; version?: string };
export type Reminder = { apartment: string; month: string; createdAt: string; version?: string };
export type Data = { config: Config | null; revision?: number; payments: Payment[]; expenses: Expense[]; reminders: Reminder[]; sheets: { connected: boolean; url?: string; syncError?: string } };
export type ApartmentRow = { apartment: string; fee: number; paid: number; due: number; over: number; status: "paid" | "partial" | "unpaid" | "over"; reminded?: string };
export function currentMonth() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit" }).format(new Date()); }
export const DEFAULT_CONFIG: Config = { name: "Наш дом", apartments: Array.from({ length: 32 }, (_, i) => String(i + 65)), startMonth: "2026-10", openingCents: 0, salaryCents: 4000000, defaultFeeCents: 130000, fees: Object.fromEntries(Array.from({length:32},(_,i)=>[String(i+65),i+65===91?100000:i+65===87?110000:130000])) };
export function monthLabel(month: string) { return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month + "-01T12:00:00Z")).replace(" г.", ""); }
export function money(cents: number, symbol = true) { return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100) + (symbol ? " ₽" : ""); }
export function parseMoney(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const n = Math.round(Number(value.trim().replace(",", ".")) * 100);
  return Number.isSafeInteger(n) && n > 0 && n <= 100000000 ? n : null;
}
export function isMonth(value: unknown): value is string { return typeof value === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value); }
export function parseApartments(value: string) {
  const found = new Set<string>();
  for (const chunk of value.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)) {
    const range = chunk.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const a = +range[1], b = +range[2];
      if (a < 1 || b < a || b - a > 999) throw new Error("Проверьте диапазон квартир, например 1–72.");
      for (let i = a; i <= b; i++) found.add(String(i));
    } else {
      if (!/^[\p{L}\p{N} /-]{1,16}$/u.test(chunk)) throw new Error("Номер квартиры: до 16 букв или цифр.");
      found.add(chunk);
    }
  }
  if (!found.size || found.size > 1000) throw new Error("Укажите от 1 до 1000 квартир.");
  return [...found].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
}
export function summarize(data: Data, month: string) {
  const active = !!data.config && month >= data.config.startMonth;
  const periodPayments = data.payments.filter(p => p.month === month);
  const periodExpenses = data.expenses.filter(p => p.month === month);
  const rows: ApartmentRow[] = (active ? data.config!.apartments : []).map(apartment => {
    const paid = periodPayments.filter(p => p.apartment === apartment).reduce((a, p) => a + p.amountCents, 0);
    const fee = feeFor(data.config!, apartment);
    return { apartment, fee, paid, due: Math.max(0, fee - paid), over: Math.max(0, paid - fee), status: paid === 0 ? "unpaid" : paid < fee ? "partial" : paid === fee ? "paid" : "over", reminded: data.reminders.filter(r => r.month === month && r.apartment === apartment).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt };
  });
  const income = periodPayments.reduce((a, p) => a + p.amountCents, 0);
  const spent = periodExpenses.reduce((a, p) => a + p.amountCents, 0);
  const bank = active ? data.config!.openingCents + data.payments.filter(p => p.month <= month).reduce((a, p) => a + p.amountCents, 0) - data.expenses.filter(p => p.month <= month).reduce((a, p) => a + p.amountCents, 0) : 0;
  const credited = rows.reduce((a, r) => a + Math.min(r.fee, r.paid), 0);
  return { rows, income, spent, bank, credited, expected: rows.reduce((a,r)=>a+r.fee,0), debt: rows.reduce((a, r) => a + r.due, 0), over: rows.reduce((a, r) => a + r.over, 0), closed: rows.filter(r => r.paid >= r.fee).length, salaries: periodExpenses.filter(p => p.category === "salary").reduce((a, p) => a + p.amountCents, 0), periodPayments, periodExpenses };
}
export function demoData(month: string): Data {
  const apartments = Array.from({ length: 72 }, (_, i) => String(i + 1));
  const payments = apartments.filter((_, i) => i % 6 !== 0 && i % 11 !== 0).map((apartment, i) => ({ id: `demo-${i}`, apartment, month, amountCents: i % 13 === 0 ? 50000 : i % 17 === 0 ? 190000 : FEE_CENTS, createdAt: `${month}-21T${String(9 + i % 8).padStart(2, "0")}:20:00Z` }));
  return { config: { name: "Дом на Лесной", apartments, startMonth: month, openingCents: 1800000, salaryCents: 4000000 }, payments, expenses: [{ id: "demo-expense", month, category: "salary", title: "Зарплата консьержа · первая половина месяца", amountCents: 2000000, createdAt: `${month}-15T12:00:00Z` }, { id: "demo-bank", month, category: "bank", title: "Обслуживание счёта", amountCents: 49000, createdAt: `${month}-15T12:00:00Z` }], reminders: [], sheets: { connected: false } };
}
