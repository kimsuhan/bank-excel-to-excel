const express = require("express");
const multer = require("multer");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const swaggerUi = require("swagger-ui-express");
const { SUPPORTED_BANKS } = require("./constants/banks");
const { processUpload } = require("./services/uploadService");
const { openApiSpec } = require("./docs/openapi");

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.status(200).json({ message: "backend is running" });
});

app.get("/openapi.json", (_req, res) => {
  res.status(200).json(openApiSpec);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.get("/redoc", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bank Excel API - ReDoc</title>
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
});

app.post("/api/uploads", upload.single("file"), async (req, res, next) => {
  try {
    const bank = String(req.body?.bank || "").trim().toLowerCase();

    if (!bank) {
      res.status(400).json({
        error: "bank is required",
        supportedBanks: SUPPORTED_BANKS,
      });
      return;
    }

    if (!SUPPORTED_BANKS.includes(bank)) {
      res.status(400).json({
        error: "unsupported bank",
        supportedBanks: SUPPORTED_BANKS,
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    const result = await processUpload({
      bank,
      file: req.file,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/exports/:fileName", (req, res) => {
  const fileName = path.basename(String(req.params.fileName || ""));
  const filePath = path.join(process.cwd(), "export", fileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "export file not found" });
    return;
  }

  res.download(filePath);
});

app.get("/api/exports/:fileName/preview", (req, res) => {
  const fileName = path.basename(String(req.params.fileName || ""));
  const filePath = path.join(process.cwd(), "export", fileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "export file not found" });
    return;
  }

  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

  res.status(200).json({
    fileName,
    sheetName,
    rowCount: rows.length,
    previewRows: rows.slice(0, 10),
  });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  if (err && err.message) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  res.status(500).json({
    error: "internal server error",
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
