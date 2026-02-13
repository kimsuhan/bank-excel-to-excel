const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { BANK_TYPES } = require("../constants/banks");
const { buildOutputWorkbook } = require("./common/householdFormat");
const { convertHyundaiRows, convertSamsungRows } = require("./bank");

const EXPORT_DIR = path.join(process.cwd(), "export");

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
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

function convertRowsByBank(bank, fileBuffer) {
  switch (bank) {
    case BANK_TYPES.HYUNDAI:
      return convertHyundaiRows(fileBuffer);
    case BANK_TYPES.SAMSUNG:
      return convertSamsungRows(fileBuffer);
    default:
      throw new Error(`Unsupported bank type: ${bank}`);
  }
}

async function processUpload({ bank, file }) {
  ensureExportDir();

  const convertedRows = convertRowsByBank(bank, file.buffer);
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
