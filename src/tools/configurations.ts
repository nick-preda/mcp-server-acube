/**
 * @module tools/configurations
 *
 * Business registry and ADE appointee tools.
 *
 * Provides 8 tools:
 * - `list_business_registries` / `create_business_registry` /
 *   `get_business_registry` / `update_business_registry`
 *   -- Manage company profiles (anagrafiche aziendali) used for SDI invoicing.
 * - `list_appointees` / `create_appointee` / `get_appointee` / `update_appointee`
 *   -- Manage ADE tax appointees (intermediari fiscali) authorized to operate
 *     with the Agenzia delle Entrate on behalf of a company.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube configuration endpoints
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerConfigurationTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ── list_business_registries ──────────────────────────────────────────
  server.tool(
    "list_business_registries",
    "List all business registry configurations (anagrafiche aziendali).",
    {},
    async () => {
      try {
        const result = await client.get("/business-registry-configurations");
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── create_business_registry ──────────────────────────────────────────
  server.tool(
    "create_business_registry",
    "Create a business registry (anagrafica aziendale) for SDI invoicing.",
    {
      config: z
        .record(z.unknown())
        .describe("Business registry data: fiscal_id, company_name, supplier_invoice_enabled, etc."),
    },
    async (params) => {
      try {
        const result = await client.post("/business-registry-configurations", params.config);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── get_business_registry ─────────────────────────────────────────────
  server.tool(
    "get_business_registry",
    "Get a business registry configuration by ID.",
    {
      id: z.string().describe("Business registry ID"),
    },
    async (params) => {
      try {
        const result = await client.get(
          `/business-registry-configurations/${encodeURIComponent(params.id)}`,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── update_business_registry ──────────────────────────────────────────
  server.tool(
    "update_business_registry",
    "Update a business registry configuration.",
    {
      id: z.string().describe("Business registry ID"),
      config: z.record(z.unknown()).describe("Fields to update"),
    },
    async (params) => {
      try {
        const result = await client.put(
          `/business-registry-configurations/${encodeURIComponent(params.id)}`,
          params.config,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── list_appointees ───────────────────────────────────────────────────
  server.tool(
    "list_appointees",
    "List all ADE tax appointees (intermediari fiscali).",
    {},
    async () => {
      try {
        const result = await client.get("/ade-appointees");
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── create_appointee ──────────────────────────────────────────────────
  server.tool(
    "create_appointee",
    "Create an ADE appointee (intermediario fiscale).",
    {
      appointee: z.record(z.unknown()).describe("Appointee data"),
    },
    async (params) => {
      try {
        const result = await client.post("/ade-appointees", params.appointee);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── get_appointee ─────────────────────────────────────────────────────
  server.tool(
    "get_appointee",
    "Get an ADE appointee by ID.",
    {
      id: z.string().describe("Appointee ID"),
    },
    async (params) => {
      try {
        const result = await client.get(
          `/ade-appointees/${encodeURIComponent(params.id)}`,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── update_appointee ──────────────────────────────────────────────────
  server.tool(
    "update_appointee",
    "Update an ADE appointee.",
    {
      id: z.string().describe("Appointee ID"),
      appointee: z.record(z.unknown()).describe("Fields to update"),
    },
    async (params) => {
      try {
        const result = await client.put(
          `/ade-appointees/${encodeURIComponent(params.id)}`,
          params.appointee,
        );
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
