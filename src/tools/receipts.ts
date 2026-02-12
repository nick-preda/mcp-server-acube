/**
 * @module tools/receipts
 *
 * Electronic receipt (scontrino elettronico) tools.
 *
 * Provides 4 tools:
 * - `send_receipt` -- Issue an electronic receipt to the Agenzia delle Entrate.
 * - `get_receipt_details` -- Get receipt transaction details.
 * - `void_receipt` -- Void/cancel a receipt (annullamento).
 * - `return_receipt_items` -- Process item returns against a receipt (reso).
 *
 * Note: The receipt service is unavailable daily from 23:55 to 00:00 Italian
 * time due to Agenzia delle Entrate maintenance.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube receipt endpoints
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerReceiptTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ── send_receipt ──────────────────────────────────────────────────────
  server.tool(
    "send_receipt",
    "Send an electronic receipt (scontrino). Not available 23:55-00:00 Italian time.",
    {
      receipt: z
        .record(z.unknown())
        .describe("Receipt data: fiscal_id, items[], cash_payment_amount, electronic_payment_amount"),
    },
    async (params) => {
      try {
        const response = await client.post<unknown>("/receipts", params.receipt);
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── get_receipt_details ─────────────────────────────────────────────
  server.tool(
    "get_receipt_details",
    "Get receipt details by ID.",
    {
      id: z.string().describe("Receipt ID"),
    },
    async (params) => {
      try {
        const response = await client.get<unknown>(
          `/receipts/${encodeURIComponent(params.id)}/details`,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── void_receipt ────────────────────────────────────────────────────
  server.tool(
    "void_receipt",
    "Void/cancel a receipt (annullamento scontrino).",
    {
      id: z.string().describe("Receipt ID to void"),
    },
    async (params) => {
      try {
        const response = await client.delete<unknown>(
          `/receipts/${encodeURIComponent(params.id)}`,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── return_receipt_items ────────────────────────────────────────────
  server.tool(
    "return_receipt_items",
    "Process item returns on a receipt (reso).",
    {
      id: z.string().describe("Original receipt ID"),
      items: z.array(z.record(z.unknown())).describe("Items to return"),
    },
    async (params) => {
      try {
        const response = await client.post<unknown>(
          `/receipts/${encodeURIComponent(params.id)}/return`,
          params.items,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );
}
