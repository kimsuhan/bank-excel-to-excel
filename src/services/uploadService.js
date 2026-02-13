const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { BANK_TYPES } = require("../constants/banks");

const EXPORT_DIR = path.join(process.cwd(), "export");

const KOR = Object.freeze({
  INPUT_DATE: "\uC774\uC6A9\uC77C",
  INPUT_CARD: "\uC774\uC6A9\uCE74\uB4DC",
  INPUT_MERCHANT: "\uC774\uC6A9\uAC00\uB9F9\uC810",
  INPUT_PRINCIPAL: "\uACB0\uC81C\uC6D0\uAE08",
  OUT_SHEET: "\uAC00\uACC4\uBD80",
  OUT_TITLE_SUFFIX: "\uB144\uB3C4 \uAC70\uB798\uC0C1\uC138\uB0B4\uC5ED",
  OUT_TYPE: "\uC2E0\uC6A9\uCE74\uB4DC",
  OUT_MONTH_SUFFIX: "\uC6D4",
  OUT_NOTE_PREFIX: "\uC2E4\uC81C \uAC70\uB798\uC77C(",
  CARD_OWNER_PREFIX: "\uBCF8\uC778 ",
  SAMSUNG_CARD_LABEL: "\uC0BC\uC131\uCE74\uB4DC",
  SAMSUNG_HEADER_DATE: "\uC774\uC6A9\uC77C\uC790",
  SAMSUNG_HEADER_CARD: "\uCE74\uB4DC\uBC88\uD638",
  SAMSUNG_HEADER_MERCHANT: "\uC0AC\uC6A9\uCC98/\uAC00\uB9F9\uC810",
  SAMSUNG_HEADER_PAYABLE: "\uACB0\uC81C\uC608\uC815\uAE08\uC561",
});

const TARGET_HEADERS = Object.freeze([
  "\uC218\uC785/\uC9C0\uCD9C",
  "\uC785\uCD9C\uAE08\uC218\uB2E8",
  "\uAC70\uB798 \uC6D4",
  "\uAC70\uB798\uC77C\uC2DC",
  "\uAC00\uB9F9\uC810\uBA85/\uB0B4\uC6A9",
  "\uAE08\uC561",
  "\uCE74\uD14C\uACE0\uB9AC1",
  "\uCE74\uD14C\uACE0\uB9AC2",
  "\uBE44\uACE0",
]);

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

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

function pickAmount(row, idxPrincipal, idxAmount) {
  const candidates = [idxPrincipal, idxPrincipal - 1, idxAmount]
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
  name = name.replace(/[\s,]+$/, "").trim();
  return name;
}

function normalizeCardName(rawCard) {
  const card = String(rawCard || "").trim();
  if (card.startsWith(KOR.CARD_OWNER_PREFIX)) {
    return card.slice(KOR.CARD_OWNER_PREFIX.length).trim();
  }
  return card;
}

function normalizeSamsungCardName(rawCard) {
  const text = String(rawCard || "").trim();
  const digits = text.replace(/\D/g, "");
  if (!digits) return KOR.SAMSUNG_CARD_LABEL;
  return `${KOR.SAMSUNG_CARD_LABEL} ${digits}`;
}

function findHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const cells = row.map((v) => String(v || "").trim());
    return (
      cells.includes(KOR.INPUT_DATE) &&
      cells.includes(KOR.INPUT_CARD) &&
      cells.includes(KOR.INPUT_PRINCIPAL)
    );
  });
}

function convertHyundaiRows(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", raw: true, cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new Error("Failed to locate Hyundai card header row.");
  }

  const header = rows[headerIndex].map((v) => String(v || "").trim());
  const idxDate = header.indexOf(KOR.INPUT_DATE);
  const idxCard = header.indexOf(KOR.INPUT_CARD);
  const idxMerchant = header.indexOf(KOR.INPUT_MERCHANT);
  const idxPrincipal = header.indexOf(KOR.INPUT_PRINCIPAL);
  const idxAmount = header.indexOf("\uC774\uC6A9\uAE08\uC561");

  const convertedRows = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell || "").trim() === "")) continue;

    const dateInfo = parseKoreanDate(row[idxDate]);
    if (!dateInfo) continue;

    const amount = pickAmount(row, idxPrincipal, idxAmount);
    if (amount <= 0) continue;

    convertedRows.push([
      KOR.OUT_TYPE,
      normalizeCardName(row[idxCard]),
      `${dateInfo.month}${KOR.OUT_MONTH_SUFFIX}`,
      dateInfo.isoDate,
      cleanMerchantName(row[idxMerchant], amount),
      amount,
      "",
      "",
      `${KOR.OUT_NOTE_PREFIX}${dateInfo.isoDate})`,
    ]);
  }

  return convertedRows;
}

function findSamsungHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const cells = row.map((v) => String(v || "").trim());
    return (
      cells.includes(KOR.SAMSUNG_HEADER_DATE) &&
      cells.includes(KOR.SAMSUNG_HEADER_CARD) &&
      cells.includes(KOR.SAMSUNG_HEADER_PAYABLE)
    );
  });
}

function convertSamsungRows(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", raw: true, cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

  const headerIndex = findSamsungHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new Error("Failed to locate Samsung card header row.");
  }

  const header = rows[headerIndex].map((v) => String(v || "").trim());
  const idxDate = header.indexOf(KOR.SAMSUNG_HEADER_DATE);
  const idxCard = header.indexOf(KOR.SAMSUNG_HEADER_CARD);
  const idxMerchant = header.indexOf(KOR.SAMSUNG_HEADER_MERCHANT);
  const idxPayable = header.indexOf(KOR.SAMSUNG_HEADER_PAYABLE);
  const idxAmount = header.indexOf("\uC774\uC6A9\uAE08\uC561");

  const convertedRows = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell || "").trim() === "")) continue;

    const dateInfo = parseCompactDate(row[idxDate]);
    if (!dateInfo) continue;

    const amount = pickAmount(row, idxPayable, idxAmount);
    if (amount <= 0) continue;

    convertedRows.push([
      KOR.OUT_TYPE,
      normalizeSamsungCardName(row[idxCard]),
      `${dateInfo.month}${KOR.OUT_MONTH_SUFFIX}`,
      dateInfo.isoDate,
      cleanMerchantName(row[idxMerchant]),
      amount,
      "",
      "",
      `${KOR.OUT_NOTE_PREFIX}${dateInfo.isoDate})`,
    ]);
  }

  return convertedRows;
}

function buildOutputWorkbook(rows) {
  const titleYear = rows.length > 0 ? String(rows[0][3]).slice(0, 4) : String(new Date().getFullYear());
  const sheetRows = [[`${titleYear}${KOR.OUT_TITLE_SUFFIX}`], TARGET_HEADERS, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, KOR.OUT_SHEET);
  return workbook;
}

function buildExportFileName(bank) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `${bank}_converted_${stamp}.xlsx`;
}

async function processUpload({ bank, file }) {
  ensureExportDir();

  let convertedRows;
  switch (bank) {
    case BANK_TYPES.HYUNDAI:
      convertedRows = convertHyundaiRows(file.buffer);
      break;
    case BANK_TYPES.SAMSUNG:
      convertedRows = convertSamsungRows(file.buffer);
      break;
    default:
      throw new Error(`Unsupported bank type: ${bank}`);
  }

  const outputWorkbook = buildOutputWorkbook(convertedRows);
  const outputFileName = buildExportFileName(bank);
  const outputPath = path.join(EXPORT_DIR, outputFileName);
  XLSX.writeFile(outputWorkbook, outputPath);

  return {
    bank,
    inputFileName: file.originalname,
    outputFileName,
    outputPath,
    downloadPath: `/api/exports/${encodeURIComponent(outputFileName)}`,
    rowCount: convertedRows.length,
    previewRows: convertedRows.slice(0, 5),
  };
}

module.exports = {
  processUpload,
};
