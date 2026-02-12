/**
 * @module tools/invoice-extract
 *
 * AI-powered PDF-to-FatturaPA extraction tools.
 *
 * Provides 3 tools:
 * - `extract_invoice_from_pdf` -- Upload a base64-encoded PDF for extraction.
 *   Returns a job UUID to track progress.
 * - `get_extraction_status` -- Poll the extraction job status (pending, completed, failed).
 * - `get_extraction_result` -- Download the converted FatturaPA invoice (JSON or XML)
 *   from a completed extraction job.
 *
 * Typical workflow:
 * 1. Upload PDF with `extract_invoice_from_pdf` -> get job UUID.
 * 2. Poll `get_extraction_status` until status is `completed`.
 * 3. Retrieve the FatturaPA with `get_extraction_result`.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube extraction endpoints
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerInvoiceExtractTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ── extract_invoice_from_pdf ──────────────────────────────────────────
  server.tool(
    "extract_invoice_from_pdf",
    "Upload a PDF (base64) for AI extraction to FatturaPA. Returns job UUID.",
    {
      pdf_base64: z.string().describe("Base64-encoded PDF content"),
    },
    async (params) => {
      try {
        const response = await client.post<{ uuid: string }>(
          "/invoice-extract",
          { pdf_base64: params.pdf_base64 },
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── get_extraction_status ─────────────────────────────────────────────
  server.tool(
    "get_extraction_status",
    "Check PDF extraction job status by UUID.",
    {
      uuid: z.string().describe("Extraction job UUID"),
    },
    async (params) => {
      try {
        const response = await client.get<unknown>(
          `/invoice-extract/${encodeURIComponent(params.uuid)}`,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── get_extraction_result ─────────────────────────────────────────────
  server.tool(
    "get_extraction_result",
    "Get completed extraction result as FatturaPA (JSON or XML).",
    {
      uuid: z.string().describe("Completed extraction job UUID"),
      format: z.enum(["json", "xml"]).optional().default("json").describe("Output format"),
    },
    async (params) => {
      try {
        const acceptMap: Record<string, string> = {
          json: "application/json",
          xml: "application/xml",
        };

        const response = await client.get<unknown>(
          `/invoice-extract/${encodeURIComponent(params.uuid)}/result`,
          { accept: acceptMap[params.format] },
        );

        if (typeof response.data === "string") {
          return { content: [{ type: "text" as const, text: response.data }] };
        }
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );
}
