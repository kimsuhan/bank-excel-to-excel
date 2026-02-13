const { SUPPORTED_BANKS } = require("../constants/banks");

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Bank Excel API",
    version: "1.0.0",
    description: "Upload bank excel file by bank type",
  },
  servers: [
    {
      url: "http://localhost:3000",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "ok",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/uploads": {
      post: {
        summary: "Upload bank excel file",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["bank", "file"],
                properties: {
                  bank: {
                    type: "string",
                    enum: SUPPORTED_BANKS,
                    example: "hyundai",
                  },
                  file: {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Upload accepted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        bank: { type: "string", example: "hyundai" },
                        inputFileName: { type: "string", example: "hyundaicard_20260202.xls" },
                        outputFileName: {
                          type: "string",
                          example: "hyundai_converted_20260213_205900.xlsx",
                        },
                        outputPath: {
                          type: "string",
                          example: "D:/.../export/hyundai_converted_20260213_205900.xlsx",
                        },
                        downloadPath: {
                          type: "string",
                          example: "/api/exports/hyundai_converted_20260213_205900.xlsx",
                        },
                        rowCount: { type: "number", example: 24 },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid request",
          },
        },
      },
    },
    "/api/exports/{fileName}": {
      get: {
        summary: "Download exported excel file",
        parameters: [
          {
            name: "fileName",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Excel file download",
          },
          "404": {
            description: "File not found",
          },
        },
      },
    },
    "/api/exports/{fileName}/preview": {
      get: {
        summary: "Read exported excel preview",
        parameters: [
          {
            name: "fileName",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Excel preview rows",
          },
          "404": {
            description: "File not found",
          },
        },
      },
    },
  },
};

module.exports = {
  openApiSpec,
};
