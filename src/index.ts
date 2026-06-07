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
import { toolDescriptionPrefix } from "./badge.js";
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

// --- Server usage instructions (shown to the MCP client/agent) ---
const SERVER_INSTRUCTIONS = `A-Cube electronic invoicing (Italian SDI/FatturaPA).

ACTIVE ENVIRONMENT: ${environment.toUpperCase()}.

Environments:
- Both "sandbox" and "production" use the SAME A-Cube credentials. The ONLY
  switch is the ACUBE_ENVIRONMENT variable, which routes to the matching
  base URLs (sandbox -> *-sandbox.acubeapi.com).
- To work in both at once, configure TWO MCP servers (one per environment).
- Every tool description is prefixed with [SANDBOX] or [PRODUCTION] so you can
  see the active environment at a glance. Write operations also echo an
  "environment" field in their response.

Safety:
- "send_invoice" / "send_simplified_invoice" in PRODUCTION submit a REAL,
  irreversible invoice to SDI (correcting it requires a credit note).
- ALWAYS test a new invoice in sandbox first, then resend in production.`;

// --- Initialize API client ---
const client = new AcubeClient({ email, password, environment });

// --- Create MCP server ---
const server = new McpServer(
  {
    name: "mcp-server-acube",
    version: "0.4.0",
  },
  { instructions: SERVER_INSTRUCTIONS },
);

// --- Environment badge on every tool description ---
// Prefix each tool's description with [PRODUCTION] / [SANDBOX] so an AI agent
// always knows which environment it is acting in. Live-write tools in
// production get a stronger, explicit warning. See ./badge.ts.
const registerTool = server.tool.bind(server) as (...args: unknown[]) => unknown;
(server as unknown as { tool: (...args: unknown[]) => unknown }).tool = (
  ...args: unknown[]
) => {
  // args[0] = tool name, args[1] = description (when passed as a string)
  const name = args[0] as string;
  if (typeof args[1] === "string") {
    args[1] = toolDescriptionPrefix(name, environment) + args[1];
  }
  return registerTool(...args);
};

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
