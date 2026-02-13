const XLSX = require("xlsx");
const { cleanMerchantName, parseKoreanDate, pickAmount } = require("../common/convertUtils");

const KOR = Object.freeze({
  INPUT_DATE: "\uC774\uC6A9\uC77C",
  INPUT_CARD: "\uC774\uC6A9\uCE74\uB4DC",
  INPUT_MERCHANT: "\uC774\uC6A9\uAC00\uB9F9\uC810",
  INPUT_PRINCIPAL: "\uACB0\uC81C\uC6D0\uAE08",
  OUT_TYPE: "\uC2E0\uC6A9\uCE74\uB4DC",
  OUT_MONTH_SUFFIX: "\uC6D4",
  OUT_NOTE_PREFIX: "\uC2E4\uC81C \uAC70\uB798\uC77C(",
  CARD_OWNER_PREFIX: "\uBCF8\uC778 ",
});

function normalizeCardName(rawCard) {
  const card = String(rawCard || "").trim();
  if (card.startsWith(KOR.CARD_OWNER_PREFIX)) {
    return card.slice(KOR.CARD_OWNER_PREFIX.length).trim();
  }
  return card;
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

module.exports = {
  convertHyundaiRows,
};
