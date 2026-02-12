/**
 * @module tools/verify
 *
 * Italian company and fiscal ID verification tools.
 *
 * Provides 4 tools:
 * - `verify_fiscal_id` -- Validate a codice fiscale or P.IVA against the
 *   Agenzia delle Entrate registry.
 * - `verify_company` -- Full company lookup: denominazione, PEC, codice
 *   destinatario, address, ATECO, shareholders, and more.
 * - `verify_simple_company` -- Lightweight company info (subset of `verify_company`).
 * - `verify_split_payment` -- Check if a P.IVA is subject to split payment
 *   (scissione dei pagamenti) for public administration invoicing.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube verification endpoints
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerVerifyTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ---------- verify_fiscal_id ----------
  server.tool(
    "verify_fiscal_id",
    "Verify an Italian codice fiscale or P.IVA with Agenzia delle Entrate.",
    {
      id: z.string().describe("Codice fiscale or P.IVA"),
    },
    async (params) => {
      try {
        const result = await client.get(`/verify/fiscal/${encodeURIComponent(params.id)}`);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ---------- verify_company ----------
  server.tool(
    "verify_company",
    "Full company data by P.IVA/CF: denominazione, PEC, codice destinatario, indirizzo, ATECO, soci.",
    {
      id: z.string().describe("P.IVA or codice fiscale"),
    },
    async (params) => {
      try {
        const result = await client.get(`/verify/company/${encodeURIComponent(params.id)}`);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ---------- verify_simple_company ----------
  server.tool(
    "verify_simple_company",
    "Basic company info by P.IVA/CF (simplified view).",
    {
      id: z.string().describe("P.IVA or codice fiscale"),
    },
    async (params) => {
      try {
        const result = await client.get(`/verify/simple-company/${encodeURIComponent(params.id)}`);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ---------- verify_split_payment ----------
  server.tool(
    "verify_split_payment",
    "Check split payment (scissione pagamenti) status for a P.IVA.",
    {
      id: z.string().describe("P.IVA to check"),
    },
    async (params) => {
      try {
        const result = await client.get(`/verify/split-payment/${encodeURIComponent(params.id)}`);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
