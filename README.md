# mcp-server-acube

[![npm version](https://img.shields.io/npm/v/mcp-server-acube.svg)](https://www.npmjs.com/package/mcp-server-acube)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides **38 tools** for interacting with the [A-Cube API](https://www.acubeapi.com/) -- the Italian electronic invoicing platform for SDI (Sistema di Interscambio), FatturaPA, smart receipts, company verification, and more.

Connect this server to Claude Desktop, Claude Code, or any MCP-compatible client to manage Italian electronic invoicing through natural language.

## Features

- **Electronic Invoicing** -- Send, list, and retrieve FatturaPA invoices via SDI, with support for JSON, XML, PDF, and HTML formats
- **AI-Powered PDF Extraction** -- Convert PDF invoices to FatturaPA format using A-Cube's AI extraction pipeline
- **Smart Receipts** -- Issue, void, and manage electronic receipts (scontrini elettronici)
- **Company Verification** -- Look up Italian companies by P.IVA or codice fiscale, verify fiscal IDs, and check split payment status
- **SDI Notifications** -- Monitor delivery receipts, rejections, and all other SDI notification types
- **Cassetto Fiscale** -- Schedule recurring or one-time bulk downloads from the Agenzia delle Entrate tax drawer
- **Webhooks** -- Configure real-time event callbacks for 13 different event types
- **Business Registry & ADE Appointees** -- Manage company profiles and fiscal intermediary configurations
- **Token-Optimized Responses** -- Compact JSON output with null stripping and field selection to minimize LLM token consumption
- **Automatic Authentication** -- JWT token management with automatic refresh (24h token lifetime)
- **Sandbox & Production** -- Seamlessly switch between A-Cube sandbox and production environments

## Quick Start

### Prerequisites

You need an [A-Cube API](https://www.acubeapi.com/) account. Sign up at [acubeapi.com](https://www.acubeapi.com/) to get your credentials.

### Claude Desktop

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "acube": {
      "command": "npx",
      "args": ["-y", "mcp-server-acube"],
      "env": {
        "ACUBE_EMAIL": "your-email@example.com",
        "ACUBE_PASSWORD": "your-password",
        "ACUBE_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add acube -- npx -y mcp-server-acube \
  -e ACUBE_EMAIL=your-email@example.com \
  -e ACUBE_PASSWORD=your-password \
  -e ACUBE_ENVIRONMENT=sandbox
```

Or add it manually to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "acube": {
      "command": "npx",
      "args": ["-y", "mcp-server-acube"],
      "env": {
        "ACUBE_EMAIL": "your-email@example.com",
        "ACUBE_PASSWORD": "your-password",
        "ACUBE_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

## Configuration

The server is configured through environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ACUBE_EMAIL` | Yes | -- | Your A-Cube account email |
| `ACUBE_PASSWORD` | Yes | -- | Your A-Cube account password |
| `ACUBE_ENVIRONMENT` | No | `sandbox` | API environment: `sandbox` or `production` |

## Available Tools

### Invoices (4 tools)

| Tool | Description |
|---|---|
| `send_invoice` | Send a FatturaPA electronic invoice to SDI. Accepts the complete FatturaPA JSON object. Returns the UUID assigned by SDI (HTTP 202). Supports optional digital signing. |
| `send_simplified_invoice` | Send a simplified FatturaPA invoice (fattura semplificata) for amounts up to 400 EUR. |
| `list_invoices` | List and filter invoices with 20+ filters (sender/recipient name, VAT, status, date ranges, etc.). Returns a **compact default view** -- see [Response Optimization](#response-optimization). |
| `get_invoice` | Retrieve a specific invoice by UUID. Output formats: JSON, XML (FatturaPA), PDF (base64), or HTML. Supports field selection. |

### Invoice Extraction (3 tools)

| Tool | Description |
|---|---|
| `extract_invoice_from_pdf` | Upload a PDF invoice (base64-encoded) for AI-powered conversion to FatturaPA format. Returns a job UUID. |
| `get_extraction_status` | Poll the status of a PDF extraction job by UUID. |
| `get_extraction_result` | Retrieve the converted FatturaPA invoice from a completed extraction job. Available in JSON or XML format. |

### Notifications (3 tools)

| Tool | Description |
|---|---|
| `list_notifications` | List SDI notifications with filtering by type (NS, MT, RC, MC, EC, SE, NE, DT, AT) and download status. |
| `get_notification` | Get a specific SDI notification by UUID in JSON or original XML format. |
| `mark_notifications_downloaded` | Mark one or more notifications as downloaded by providing their UUIDs. |

### Verification (4 tools)

| Tool | Description |
|---|---|
| `verify_fiscal_id` | Validate an Italian codice fiscale or P.IVA against the Agenzia delle Entrate. |
| `verify_company` | Full company lookup by P.IVA or codice fiscale. Returns name, PEC, SDI code, address, ATECO code, shareholders, and more. |
| `verify_simple_company` | Basic company info lookup -- a lightweight alternative to `verify_company`. |
| `verify_split_payment` | Check if a company has split payment (scissione dei pagamenti) status for public administration invoicing. |

### Smart Receipts (4 tools)

| Tool | Description |
|---|---|
| `send_receipt` | Issue an electronic receipt (scontrino elettronico) with items, payment amounts, and fiscal ID. |
| `get_receipt_details` | Get receipt transaction details including document number. |
| `void_receipt` | Void/cancel an electronic receipt (annullamento). |
| `return_receipt_items` | Process item returns against an existing receipt. |

### Webhooks (5 tools)

| Tool | Description |
|---|---|
| `list_webhook_configs` | List all webhook configurations. |
| `create_webhook_config` | Subscribe to events by specifying an event type and target URL. Supports 13 event types including supplier-invoice, customer-invoice, receipt, and more. |
| `get_webhook_config` | Get a specific webhook configuration by ID. |
| `update_webhook_config` | Update webhook settings (event type, URL, authentication). |
| `delete_webhook_config` | Remove a webhook configuration. |

### Business Registry & ADE Appointees (8 tools)

| Tool | Description |
|---|---|
| `list_business_registries` | List all business registry configurations (anagrafiche aziendali). |
| `create_business_registry` | Create a new company profile for electronic invoicing, including fiscal ID, signature, and legal storage settings. |
| `get_business_registry` | Get a specific business registry configuration by ID. |
| `update_business_registry` | Update an existing company profile. |
| `list_appointees` | List all ADE tax appointees (intermediari fiscali). |
| `create_appointee` | Register a new fiscal intermediary authorized to operate with the Agenzia delle Entrate. |
| `get_appointee` | Get a specific ADE appointee by ID. |
| `update_appointee` | Update an existing fiscal intermediary. |

### Cassetto Fiscale & Rejected Invoices (7 tools)

| Tool | Description |
|---|---|
| `schedule_invoice_download` | Set up recurring daily invoice downloads from the Cassetto Fiscale (tax drawer) at 03:00 UTC. |
| `get_download_schedule` | Check the status of an invoice download schedule (active, auto-renewal, last execution). |
| `update_download_schedule` | Modify download schedule options. |
| `delete_download_schedule` | Stop recurring invoice downloads. |
| `download_invoices_once` | Trigger a one-time bulk invoice download by date range from the Agenzia delle Entrate. |
| `count_rejected_invoices` | Count invoices that were rejected during Cassetto Fiscale processing. |
| `recover_rejected_invoices` | Reprocess previously rejected invoices for a given fiscal ID and date range. |

## Response Optimization

This server is designed to minimize LLM token consumption. Every response goes through three optimizations:

### 1. Payload parsing

The A-Cube API returns the FatturaPA invoice data as a raw JSON string in the `payload` field. The server automatically parses this string into a structured object, which enables null stripping to work on the ~60 null fields inside it. This eliminates double-encoding overhead (`\"` escapes) and typically cuts payload token usage by ~50%.

### 2. Null stripping

All `null` and `undefined` values are recursively removed from responses -- including inside the parsed payload. A typical invoice `sender` object has ~40 fields, of which ~30 are null. After stripping, only the 5--8 populated fields remain.

### 3. Compact JSON

Responses are serialized without indentation (`JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`). This eliminates whitespace tokens that provide no information to the LLM.

### 4. Default field selection on `list_invoices`

The `list_invoices` tool returns a **compact default view** (10 items per page) instead of the full A-Cube response. The raw API response includes the entire FatturaPA payload (~2000 tokens per invoice) and full sender/recipient objects. The compact view extracts only the essential fields:

| Default field | Description |
|---|---|
| `uuid` | Invoice UUID |
| `created_at` | Creation timestamp on A-Cube |
| `document_type` | FatturaPA type code (TD01, TD04, etc.) |
| `marking` | SDI status (delivered, rejected, sent, etc.) |
| `notice` | Error message from SDI (if rejected) |
| `invoice_number` | Invoice number (extracted from payload) |
| `invoice_date` | Invoice date (extracted from payload) |
| `total_amount` | Total document amount (extracted from payload) |
| `currency` | Currency code (extracted from payload) |
| `sender.business_name` | Sender company name |
| `sender.business_vat_number_code` | Sender P.IVA |
| `recipient.business_name` | Recipient company name |
| `recipient.business_vat_number_code` | Recipient P.IVA |
| `notifications` | Array of SDI notifications (type + date) |

The `invoice_number`, `invoice_date`, `total_amount`, and `currency` fields are **computed** by parsing the FatturaPA payload JSON on the server side, so they're available without transferring the entire payload.

### Using the `fields` parameter

Both `list_invoices` and `get_invoice` accept an optional `fields` parameter to control which fields are returned:

```
# Default compact view (no fields parameter needed)
list_invoices(marking: "rejected")

# Request specific fields
list_invoices(marking: "rejected", fields: ["uuid", "notice", "recipient.business_name"])

# Request all fields (payload parsed + nulls stripped)
list_invoices(marking: "rejected", fields: ["*"])

# Get specific fields from a single invoice
get_invoice(uuid: "...", fields: ["payload", "sender", "recipient"])
```

The `fields` parameter supports **dot-notation** for nested objects (e.g., `sender.business_name`).

> **Tip:** Prefer the default compact view or specific fields over `["*"]`. Even with `["*"]`, the server parses payloads and strips nulls, but the full FatturaPA structure is still large. Use `["*"]` only when you truly need the complete invoice data.

### Pagination

`list_invoices` defaults to **10 items per page** (`items_per_page`, max 30). Use the `page` parameter to navigate through results.

### Estimated token savings

For a typical `list_invoices` call returning 10 invoices:

| Scenario | Without optimization | With optimization |
|---|---|---|
| **Default view** (compact fields) | ~25,000 tokens | **~1,500 tokens** |
| **`fields: ["*"]`** (full data) | ~25,000 tokens | **~10,000 tokens** |

Key reductions with `fields: ["*"]`:

| Metric | Before | After |
|---|---|---|
| Null fields per invoice | ~60 | 0 (stripped) |
| Payload encoding | Double-encoded string (`\"`) | Parsed object (no escaping) |
| Payload null fields | ~60 (hidden in string) | 0 (stripped) |

## Usage Examples

Once the server is connected, you can ask Claude things like:

### Invoicing
> "Send this invoice to SDI for customer ACME Srl with P.IVA 01234567890"
>
> "List all my invoices from January 2025 that were rejected"
>
> "Show me invoice abc-123-def in XML format"

### PDF Extraction
> "Convert this PDF invoice to FatturaPA format"
>
> "Check if my PDF extraction job is done yet"

### Company Verification
> "Look up the company with P.IVA 01234567890 -- I need their PEC and SDI code"
>
> "Is this codice fiscale valid: RSSMRA85M01H501Z?"
>
> "Does this company use split payment?"

### Smart Receipts
> "Issue an electronic receipt for 3 items totaling 45.50 EUR paid by card"
>
> "Void receipt number 12345"

### Notifications
> "Show me all undownloaded SDI notifications"
>
> "Are there any rejected notifications (NS type) from last week?"

### Cassetto Fiscale
> "Set up daily invoice downloads for fiscal ID 01234567890"
>
> "Download all invoices from Q1 2025 for my company"
>
> "How many rejected invoices do I have?"

### Configuration
> "List all my webhook configurations"
>
> "Set up a webhook for new supplier invoices pointing to https://my-app.com/webhooks/acube"
>
> "Show me all my business registry profiles"

## Development

### Setup

```bash
git clone https://github.com/nick-preda/mcp-server-acube.git
cd mcp-server-acube
npm install
```

### Build

```bash
npm run build
```

### Run in development mode

```bash
ACUBE_EMAIL=you@example.com ACUBE_PASSWORD=secret npm run dev
```

### Test

```bash
npm test
npm run test:watch   # watch mode
```

### Project Structure

```
src/
  index.ts                  # MCP server entry point, env validation, tool registration
  client.ts                 # A-Cube HTTP client with JWT authentication
  response.ts               # Response utilities: field picking, null stripping, formatting
  tools/
    invoices.ts             # send_invoice, send_simplified_invoice, list_invoices, get_invoice
    invoice-extract.ts      # extract_invoice_from_pdf, get_extraction_status, get_extraction_result
    notifications.ts        # list_notifications, get_notification, mark_notifications_downloaded
    verify.ts               # verify_fiscal_id, verify_company, verify_simple_company, verify_split_payment
    receipts.ts             # send_receipt, get_receipt_details, void_receipt, return_receipt_items
    webhooks.ts             # list/create/get/update/delete_webhook_config
    configurations.ts       # business registries + ADE appointees (list/create/get/update)
    cassetto-fiscale.ts     # download schedules, one-time downloads, rejected invoices
tests/
  client.test.ts            # API client tests
  tools/                    # Tool-specific tests
```

## Reference

### A-Cube API Environments

| Environment | Base URL (Gov.it) | Base URL (Common) | Purpose |
|---|---|---|---|
| `sandbox` | `https://api-sandbox.acubeapi.com` | `https://common-sandbox.api.acubeapi.com` | Testing and development |
| `production` | `https://api.acubeapi.com` | `https://common.api.acubeapi.com` | Live invoicing via SDI |

The sandbox environment is used by default. Set `ACUBE_ENVIRONMENT=production` only when you are ready to send real invoices through SDI.

### FatturaPA Document Types

| Code | Description |
|---|---|
| `TD01` | Fattura (invoice) |
| `TD04` | Nota di credito (credit note) |
| `TD05` | Nota di debito (debit note) |
| `TD06` | Parcella (professional fee) |
| `TD07` | Fattura semplificata (simplified invoice) |
| `TD08` | Nota di credito semplificata |
| `TD09` | Nota di debito semplificata |
| `TD16` | Integrazione fattura reverse charge interno |
| `TD17` | Integrazione/autofattura acquisto servizi estero |
| `TD18` | Integrazione acquisto beni intracomunitari |
| `TD19` | Integrazione/autofattura acquisto beni art. 17 c.2 |
| `TD20` | Autofattura/regolarizzazione |
| `TD24` | Fattura differita (art. 21 c.4 lett. a) |
| `TD25` | Fattura differita (art. 21 c.4 terzo periodo lett. b) |
| `TD26` | Cessione beni ammortizzabili / passaggi interni |
| `TD27` | Fattura autoconsumo / cessioni gratuite senza rivalsa |

### SDI Notification Types

| Code | Name | Description |
|---|---|---|
| `NS` | Notifica di Scarto | Invoice rejected by SDI due to validation errors |
| `MT` | Metadati | Metadata file from SDI |
| `RC` | Ricevuta di Consegna | Delivery receipt -- invoice successfully delivered to the recipient |
| `MC` | Mancata Consegna | Non-delivery notification -- recipient's SDI channel unreachable |
| `EC` | Esito Committente | Recipient outcome (accepted/refused by the recipient) |
| `SE` | Scarto Esito | Outcome rejection by SDI |
| `NE` | Notifica Esito | Outcome notification |
| `DT` | Decorrenza Termini | Deadline passed -- 15 days without response, invoice considered accepted |
| `AT` | Attestazione di Trasmissione | Transmission attestation |

### SDI Invoice Statuses (marking)

| Status | Description |
|---|---|
| `waiting` | Invoice queued for submission to SDI |
| `quarantena` | Invoice held in quarantine for review |
| `sent` | Invoice submitted to SDI, awaiting notification |
| `invoice-error` | Invoice processing error |
| `received` | Incoming invoice received from SDI |
| `rejected` | Invoice rejected by SDI (NS notification) |
| `delivered` | Invoice delivered to recipient (RC notification) |
| `not-delivered` | Invoice could not be delivered (MC notification) |

### Webhook Event Types

The following events can be subscribed to via `create_webhook_config`:

| Event | Description |
|---|---|
| `supplier-invoice` | New supplier invoice received via SDI |
| `customer-invoice` | Customer invoice sent via SDI |
| `customer-notification` | SDI notification received for a customer invoice |
| `invoice-status-quarantena` | Invoice entered quarantine status |
| `invoice-status-invoice-error` | Invoice processing error |
| `legal-storage-missing-vat` | Legal storage: missing VAT number |
| `legal-storage-receipt` | Legal storage receipt generated |
| `receipt` | Electronic receipt processed |
| `receipt-retry` | Electronic receipt retry |
| `receipt-error` | Electronic receipt error |
| `appointee` | ADE appointee event |
| `sistemats-receipt-ready` | SistemaTS receipt ready |
| `job` | Asynchronous job completed |

## Links

- [npm package](https://www.npmjs.com/package/mcp-server-acube)
- [A-Cube API Documentation](https://docs.acubeapi.com/)
- [A-Cube Website](https://www.acubeapi.com/)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Report Issues](https://github.com/nick-preda/mcp-server-acube/issues)

## License

MIT -- see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 [Cipay Srl](https://www.cipay.it)
