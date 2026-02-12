/**
 * @module tools/notifications
 *
 * SDI notification tools.
 *
 * Provides 3 tools:
 * - `list_notifications` -- List SDI notifications with filtering by type and download status.
 * - `get_notification` -- Retrieve a single notification by UUID (JSON or XML).
 * - `mark_notifications_downloaded` -- Mark notifications as downloaded by UUID.
 *
 * SDI notification types:
 * - `NS` (Notifica di Scarto) -- Invoice rejected by SDI.
 * - `RC` (Ricevuta di Consegna) -- Invoice delivered to recipient.
 * - `MC` (Mancata Consegna) -- Delivery failed.
 * - `EC` (Esito Committente) -- Recipient accepted/refused.
 * - `DT` (Decorrenza Termini) -- Deadline passed, invoice auto-accepted.
 * - `MT`, `SE`, `NE`, `AT` -- Metadata, outcome rejection, outcome notification, attestation.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube notification endpoints
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerNotificationTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ---------- list_notifications ----------
  server.tool(
    "list_notifications",
    "List SDI notifications for sent invoices. Types: NS=Rejection, MT=Metadata, RC=Delivery, MC=Non-delivery, EC=Outcome, DT=Deadline.",
    {
      page: z.number().optional().default(1).describe("Page number"),
      items_per_page: z.number().optional().default(30).describe("Items per page"),
      type: z
        .enum(["NS", "MT", "RC", "MC", "EC", "SE", "NE", "DT", "AT"])
        .optional()
        .describe("Notification type filter"),
      downloaded: z.boolean().optional().describe("Filter by downloaded flag"),
    },
    async (params) => {
      try {
        const query = new URLSearchParams();
        query.set("page", String(params.page));
        query.set("items_per_page", String(params.items_per_page));
        if (params.type !== undefined) query.set("type", params.type);
        if (params.downloaded !== undefined) query.set("downloaded", String(params.downloaded));

        const result = await client.get(`/notifications?${query.toString()}`);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ---------- get_notification ----------
  server.tool(
    "get_notification",
    "Get a specific SDI notification by UUID (JSON or XML).",
    {
      uuid: z.string().describe("Notification UUID"),
      format: z.enum(["json", "xml"]).optional().default("json").describe("Response format"),
    },
    async (params) => {
      try {
        const accept = params.format === "xml" ? "application/xml" : "application/json";
        const result = await client.get(
          `/notifications/${encodeURIComponent(params.uuid)}`,
          { accept },
        );

        if (typeof result.data === "string") {
          return { content: [{ type: "text" as const, text: result.data }] };
        }
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ---------- mark_notifications_downloaded ----------
  server.tool(
    "mark_notifications_downloaded",
    "Mark SDI notifications as downloaded by UUIDs.",
    {
      uuids: z.array(z.string()).describe("Notification UUIDs to mark"),
    },
    async (params) => {
      try {
        const result = await client.put("/notifications", params.uuids);
        return formatResponse(result.data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
