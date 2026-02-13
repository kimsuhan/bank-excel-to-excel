function parseKoreanDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{4})\uB144\s*(\d{1,2})\uC6D4\s*(\d{1,2})\uC77C/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, isoDate };
}

function parseCompactDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, isoDate };
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const clean = String(value || "").replace(/,/g, "").trim();
  if (!clean) return 0;
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function pickAmount(row, primaryIndex, fallbackIndex) {
  const candidates = [primaryIndex, primaryIndex - 1, fallbackIndex]
    .filter((idx) => Number.isInteger(idx) && idx >= 0)
    .map((idx) => toNumber(row[idx]));
  return candidates.find((value) => value > 0) || 0;
}

function cleanMerchantName(rawName, amount) {
  let name = String(rawName || "").trim();
  if (!name) return "";
  if (Number.isFinite(amount) && amount > 0) {
    const amountTextWithComma = new Intl.NumberFormat("en-US").format(Math.trunc(amount));
    name = name.replace(new RegExp(`${amountTextWithComma}$`), "").trim();
    name = name.replace(new RegExp(`${Math.trunc(amount)}$`), "").trim();
  }
  return name.replace(/[\s,]+$/, "").trim();
}

module.exports = {
  parseKoreanDate,
  parseCompactDate,
  toNumber,
  pickAmount,
  cleanMerchantName,
};
