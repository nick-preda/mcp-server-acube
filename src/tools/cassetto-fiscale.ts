/**
 * @module tools/cassetto-fiscale
 *
 * Cassetto Fiscale (tax drawer) and rejected invoice tools.
 *
 * Provides 7 tools:
 * - `schedule_invoice_download` -- Set up recurring daily downloads at 03:00 UTC.
 * - `get_download_schedule` -- Check schedule status and last execution.
 * - `update_download_schedule` -- Modify schedule options (e.g., auto-renewal).
 * - `delete_download_schedule` -- Stop recurring downloads.
 * - `download_invoices_once` -- Trigger a one-time bulk download by date range.
 * - `count_rejected_invoices` -- Count invoices rejected during processing.
 * - `recover_rejected_invoices` -- Reprocess rejected invoices for a fiscal ID.
 *
 * The Cassetto Fiscale is the Agenzia delle Entrate's digital archive where
 * all electronic invoices (sent and received) are stored for 10 years.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube download schedule endpoints
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerCassettoFiscaleTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ── schedule_invoice_download ─────────────────────────────────────────
  server.tool(
    "schedule_invoice_download",
    "Schedule daily invoice download from Cassetto Fiscale (runs 03:00 UTC).",
    {
      fiscal_id: z.string().describe("P.IVA or codice fiscale"),
      options: z.record(z.unknown()).optional().describe("Schedule options (e.g. auto_renewal)"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/schedule/invoice-download/${encodeURIComponent(params.fiscal_id)}`,
          params.options,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── get_download_schedule ─────────────────────────────────────────────
  server.tool(
    "get_download_schedule",
    "Check invoice download schedule status for a fiscal ID.",
    {
      fiscal_id: z.string().describe("P.IVA or codice fiscale"),
    },
    async (params) => {
      try {
        const result = await client.get(
          `/schedule/invoice-download/${encodeURIComponent(params.fiscal_id)}`,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── update_download_schedule ──────────────────────────────────────────
  server.tool(
    "update_download_schedule",
    "Update a Cassetto Fiscale download schedule.",
    {
      fiscal_id: z.string().describe("P.IVA or codice fiscale"),
      options: z.record(z.unknown()).describe("Fields to update"),
    },
    async (params) => {
      try {
        const result = await client.put(
          `/schedule/invoice-download/${encodeURIComponent(params.fiscal_id)}`,
          params.options,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── delete_download_schedule ──────────────────────────────────────────
  server.tool(
    "delete_download_schedule",
    "Delete a Cassetto Fiscale download schedule.",
    {
      fiscal_id: z.string().describe("P.IVA or codice fiscale"),
    },
    async (params) => {
      try {
        const result = await client.delete(
          `/schedule/invoice-download/${encodeURIComponent(params.fiscal_id)}`,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── download_invoices_once ────────────────────────────────────────────
  server.tool(
    "download_invoices_once",
    "One-time invoice download from Cassetto Fiscale by date range.",
    {
      fiscal_id: z.string().describe("Fiscal ID"),
      from_date: z.string().describe("Start date (YYYY-MM-DD)"),
      to_date: z.string().describe("End date (YYYY-MM-DD)"),
    },
    async (params) => {
      try {
        const result = await client.post("/jobs/invoice-download", {
          fiscal_id: params.fiscal_id,
          from_date: params.from_date,
          to_date: params.to_date,
        });
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── count_rejected_invoices ───────────────────────────────────────────
  server.tool(
    "count_rejected_invoices",
    "Count rejected invoices from Cassetto Fiscale for a fiscal ID.",
    {
      fiscal_id: z.string().describe("Fiscal ID"),
      from_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      to_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
    },
    async (params) => {
      try {
        const query = new URLSearchParams();
        if (params.from_date) query.set("from_date", params.from_date);
        if (params.to_date) query.set("to_date", params.to_date);

        const queryString = query.toString();
        const path =
          `/rejected-invoices/${encodeURIComponent(params.fiscal_id)}/count` +
          (queryString ? `?${queryString}` : "");

        const result = await client.get(path);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── recover_rejected_invoices ─────────────────────────────────────────
  server.tool(
    "recover_rejected_invoices",
    "Recover and reprocess rejected Cassetto Fiscale invoices.",
    {
      fiscal_id: z.string().describe("Fiscal ID"),
      from_date: z.string().describe("Start date (YYYY-MM-DD)"),
      to_date: z.string().describe("End date (YYYY-MM-DD)"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/rejected-invoices/${encodeURIComponent(params.fiscal_id)}/recover`,
          { from_date: params.from_date, to_date: params.to_date },
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
