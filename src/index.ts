#!/usr/bin/env node
/**
 * @module index
 *
 * Entry point for the A-Cube MCP server.
 *
 * Reads credentials from environment variables, initializes the
 * {@link AcubeClient}, creates an MCP server with stdio transport,
 * and registers all 38 tools across 8 modules.
 *
 * Environment variables:
 * - `ACUBE_EMAIL` (required) -- A-Cube account email.
 * - `ACUBE_PASSWORD` (required) -- A-Cube account password.
 * - `ACUBE_ENVIRONMENT` (optional, default `"sandbox"`) -- `"sandbox"` or `"production"`.
 *
 * @example
 * ```bash
 * ACUBE_EMAIL=me@example.com ACUBE_PASSWORD=secret node dist/index.js
 * ```
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AcubeClient } from "./client.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerInvoiceExtractTools } from "./tools/invoice-extract.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerVerifyTools } from "./tools/verify.js";
import { registerReceiptTools } from "./tools/receipts.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerConfigurationTools } from "./tools/configurations.js";
import { registerCassettoFiscaleTools } from "./tools/cassetto-fiscale.js";

// --- Validate required environment variables ---
const email = process.env.ACUBE_EMAIL;
const password = process.env.ACUBE_PASSWORD;

if (!email || !password) {
  console.error(
    "Error: ACUBE_EMAIL and ACUBE_PASSWORD environment variables are required.\n" +
    "Configure them in your MCP client settings:\n" +
    '  "env": { "ACUBE_EMAIL": "...", "ACUBE_PASSWORD": "...", "ACUBE_ENVIRONMENT": "sandbox" }'
  );
  process.exit(1);
}

const environment = (process.env.ACUBE_ENVIRONMENT === "production" ? "production" : "sandbox") as "production" | "sandbox";

// --- Initialize API client ---
const client = new AcubeClient({ email, password, environment });

// --- Create MCP server ---
const server = new McpServer({
  name: "mcp-server-acube",
  version: "0.1.0",
});

// --- Register all tools ---
registerInvoiceTools(server, client);
registerInvoiceExtractTools(server, client);
registerNotificationTools(server, client);
registerVerifyTools(server, client);
registerReceiptTools(server, client);
registerWebhookTools(server, client);
registerConfigurationTools(server, client);
registerCassettoFiscaleTools(server, client);

// --- Graceful shutdown ---
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

// --- Start server ---
const transport = new StdioServerTransport();
await server.connect(transport);
