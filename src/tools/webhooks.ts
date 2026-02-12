/**
 * @module tools/webhooks
 *
 * Webhook configuration tools.
 *
 * Provides 5 tools:
 * - `list_webhook_configs` -- List all webhook subscriptions.
 * - `create_webhook_config` -- Subscribe to one of 13 event types.
 * - `get_webhook_config` -- Get a subscription by ID.
 * - `update_webhook_config` -- Update event type, URL, or authentication.
 * - `delete_webhook_config` -- Remove a subscription.
 *
 * Supported event types: `supplier-invoice`, `customer-invoice`,
 * `customer-notification`, `invoice-status-quarantena`, `invoice-status-invoice-error`,
 * `legal-storage-missing-vat`, `legal-storage-receipt`, `receipt`, `receipt-retry`,
 * `receipt-error`, `appointee`, `sistemats-receipt-ready`, `job`.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube webhook endpoints
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AcubeClient } from "../client.js";
import { formatResponse, errorResponse } from "../response.js";

export function registerWebhookTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ── list_webhook_configs ────────────────────────────────────────────
  server.tool(
    "list_webhook_configs",
    "List all webhook configurations.",
    {},
    async () => {
      try {
        const response = await client.get<unknown>("/api-configurations");
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── create_webhook_config ───────────────────────────────────────────
  server.tool(
    "create_webhook_config",
    "Create a webhook for A-Cube events.",
    {
      event: z
        .enum([
          "supplier-invoice", "customer-invoice", "customer-notification",
          "invoice-status-quarantena", "invoice-status-invoice-error",
          "legal-storage-missing-vat", "legal-storage-receipt",
          "receipt", "receipt-retry", "receipt-error",
          "appointee", "sistemats-receipt-ready", "job",
        ])
        .describe("Event type"),
      target_url: z.string().url().describe("Callback URL"),
      authentication_type: z.enum(["header", "query"]).optional().describe("Auth method"),
      authentication_key: z.string().optional().describe("Auth header/param name"),
      authentication_token: z.string().optional().describe("Auth token"),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          event: params.event,
          target_url: params.target_url,
        };
        if (params.authentication_type !== undefined) body.authentication_type = params.authentication_type;
        if (params.authentication_key !== undefined) body.authentication_key = params.authentication_key;
        if (params.authentication_token !== undefined) body.authentication_token = params.authentication_token;

        const response = await client.post<unknown>("/api-configurations", body);
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── get_webhook_config ──────────────────────────────────────────────
  server.tool(
    "get_webhook_config",
    "Get a webhook configuration by ID.",
    {
      id: z.string().describe("Webhook config ID"),
    },
    async (params) => {
      try {
        const response = await client.get<unknown>(
          `/api-configurations/${encodeURIComponent(params.id)}`,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── update_webhook_config ───────────────────────────────────────────
  server.tool(
    "update_webhook_config",
    "Update a webhook configuration.",
    {
      id: z.string().describe("Webhook config ID"),
      config: z.record(z.unknown()).describe("Fields to update"),
    },
    async (params) => {
      try {
        const response = await client.put<unknown>(
          `/api-configurations/${encodeURIComponent(params.id)}`,
          params.config,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── delete_webhook_config ───────────────────────────────────────────
  server.tool(
    "delete_webhook_config",
    "Delete a webhook configuration.",
    {
      id: z.string().describe("Webhook config ID to delete"),
    },
    async (params) => {
      try {
        const response = await client.delete<unknown>(
          `/api-configurations/${encodeURIComponent(params.id)}`,
        );
        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );
}
