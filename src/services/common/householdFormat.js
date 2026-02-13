const XLSX = require("xlsx");

const KOR = Object.freeze({
  OUT_SHEET: "\uAC00\uACC4\uBD80",
  OUT_TITLE_SUFFIX: "\uB144\uB3C4 \uAC70\uB798\uC0C1\uC138\uB0B4\uC5ED",
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

function buildOutputWorkbook(rows) {
  const titleYear = rows.length > 0 ? String(rows[0][3]).slice(0, 4) : String(new Date().getFullYear());
  const sheetRows = [[`${titleYear}${KOR.OUT_TITLE_SUFFIX}`], TARGET_HEADERS, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, KOR.OUT_SHEET);
  return workbook;
}

module.exports = {
  buildOutputWorkbook,
};
