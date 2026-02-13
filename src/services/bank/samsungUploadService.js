const XLSX = require("xlsx");
const { cleanMerchantName, parseCompactDate, pickAmount } = require("../common/convertUtils");

const KOR = Object.freeze({
  OUT_TYPE: "\uC2E0\uC6A9\uCE74\uB4DC",
  OUT_MONTH_SUFFIX: "\uC6D4",
  OUT_NOTE_PREFIX: "\uC2E4\uC81C \uAC70\uB798\uC77C(",
  CARD_LABEL: "\uC0BC\uC131\uCE74\uB4DC",
  HEADER_DATE: "\uC774\uC6A9\uC77C\uC790",
  HEADER_CARD: "\uCE74\uB4DC\uBC88\uD638",
  HEADER_MERCHANT: "\uC0AC\uC6A9\uCC98/\uAC00\uB9F9\uC810",
  HEADER_PAYABLE: "\uACB0\uC81C\uC608\uC815\uAE08\uC561",
});

function normalizeSamsungCardName(rawCard) {
  const text = String(rawCard || "").trim();
  const digits = text.replace(/\D/g, "");
  if (!digits) return KOR.CARD_LABEL;
  return `${KOR.CARD_LABEL} ${digits}`;
}

function findSamsungHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const cells = row.map((v) => String(v || "").trim());
    return (
      cells.includes(KOR.HEADER_DATE) &&
      cells.includes(KOR.HEADER_CARD) &&
      cells.includes(KOR.HEADER_PAYABLE)
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
  const idxDate = header.indexOf(KOR.HEADER_DATE);
  const idxCard = header.indexOf(KOR.HEADER_CARD);
  const idxMerchant = header.indexOf(KOR.HEADER_MERCHANT);
  const idxPayable = header.indexOf(KOR.HEADER_PAYABLE);
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

module.exports = {
  convertSamsungRows,
};
