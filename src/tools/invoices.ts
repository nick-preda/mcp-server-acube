/**
 * @module tools/invoices
 *
 * SDI electronic invoicing tools.
 *
 * Provides 4 tools:
 * - `send_invoice` -- Submit a FatturaPA invoice to SDI.
 * - `send_simplified_invoice` -- Submit a simplified invoice (max 400 EUR).
 * - `list_invoices` -- Search/filter invoices with 20+ parameters and a
 *   token-optimized compact default view.
 * - `get_invoice` -- Retrieve a single invoice by UUID (JSON, XML, PDF, HTML).
 *
 * Token optimization: `list_invoices` parses the FatturaPA JSON payload on the
 * server side to extract `invoice_number`, `invoice_date`, `total_amount`, and
 * `currency` as top-level fields. This avoids transferring the full payload
 * (~2000 tokens/invoice) while still exposing the most-requested data.
 *
 * @see https://docs.acubeapi.com/ -- A-Cube invoice endpoints
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AcubeClient } from "../client.js";
import { pickFields, formatResponse, errorResponse } from "../response.js";

/**
 * Default field set for `list_invoices` compact view.
 *
 * Covers the most common use case: "who sent what to whom, for how much,
 * and what is the current SDI status?" The `invoice_number`, `invoice_date`,
 * `total_amount`, and `currency` fields are computed by {@link enrichInvoices}.
 */
const LIST_INVOICES_DEFAULT_FIELDS = [
  "uuid",
  "created_at",
  "document_type",
  "marking",
  "notice",
  "invoice_number",
  "invoice_date",
  "total_amount",
  "currency",
  "sender.business_name",
  "sender.business_vat_number_code",
  "recipient.business_name",
  "recipient.business_vat_number_code",
  "notifications",
];

/**
 * Parse the `payload` JSON string and extract commonly needed fields as
 * top-level properties. Also replaces the raw payload string with a parsed
 * object so that {@link stripEmpty} can remove the ~60 null fields inside it,
 * cutting token usage by ~50%.
 *
 * Works on both arrays (list_invoices) and single objects (get_invoice).
 */
function enrichInvoices(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => enrichSingle(item as Record<string, unknown>));
  }

  if (data && typeof data === "object") {
    return enrichSingle(data as Record<string, unknown>);
  }

  return data;
}

function enrichSingle(item: Record<string, unknown>): Record<string, unknown> {
  if (typeof item.payload !== "string") return item;

  try {
    const parsed = JSON.parse(item.payload);
    const body = parsed?.fattura_elettronica_body?.[0];
    const doc = body?.dati_generali?.dati_generali_documento;

    return {
      ...item,
      payload: parsed, // parsed object instead of raw string → enables null stripping
      invoice_number: doc?.numero ?? null,
      invoice_date: doc?.data ?? null,
      total_amount: doc?.importo_totale_documento ?? null,
      currency: doc?.divisa ?? null,
    };
  } catch {
    return item;
  }
}

export function registerInvoiceTools(
  server: McpServer,
  client: AcubeClient,
): void {
  // ── send_invoice ──────────────────────────────────────────────────────
  server.tool(
    "send_invoice",
    "Send a FatturaPA invoice to SDI. Returns the assigned UUID (HTTP 202).",
    {
      invoice: z
        .record(z.unknown())
        .describe(
          "Complete FatturaPA JSON with fattura_elettronica_header and fattura_elettronica_body",
        ),
      sign: z
        .boolean()
        .optional()
        .describe("Digitally sign before sending (X-SignInvoice header)"),
    },
    async (params) => {
      try {
        const headers: Record<string, string> = {};
        if (params.sign !== undefined) {
          headers["X-SignInvoice"] = params.sign ? "true" : "false";
        }

        const response = await client.post<{ uuid: string }>(
          "/invoices",
          params.invoice,
          { headers },
        );

        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── send_simplified_invoice ───────────────────────────────────────────
  server.tool(
    "send_simplified_invoice",
    "Send a simplified FatturaPA to SDI (max 400 EUR). Returns UUID.",
    {
      invoice: z
        .record(z.unknown())
        .describe("Simplified FatturaPA JSON"),
    },
    async (params) => {
      try {
        const response = await client.post<{ uuid: string }>(
          "/invoices/simplified",
          params.invoice,
        );

        return formatResponse(response.data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── list_invoices ─────────────────────────────────────────────────────
  server.tool(
    "list_invoices",
    "List/search SDI invoices. Filters: sender/recipient name or VAT, invoice number, " +
      "document type, direction, status, date ranges. Default compact view returns key fields only. " +
      "Add specific extra fields if needed. Use fields:['*'] only when full FatturaPA payload is required.",
    {
      page: z.number().optional().default(1).describe("Page number"),
      items_per_page: z.number().min(1).max(30).optional().default(10).describe("Items per page (default 10, max 30)"),
      marking: z
        .string()
        .optional()
        .describe("Status: waiting, quarantena, sent, invoice-error, received, rejected, delivered, not-delivered"),
      sender_name: z.string().optional().describe("Sender business name (partial match)"),
      sender_vat: z.string().optional().describe("Sender P.IVA"),
      sender_fiscal_code: z.string().optional().describe("Sender codice fiscale"),
      recipient_name: z.string().optional().describe("Recipient business name (partial match)"),
      recipient_vat: z.string().optional().describe("Recipient P.IVA"),
      recipient_fiscal_code: z.string().optional().describe("Recipient codice fiscale"),
      invoice_number: z.string().optional().describe("Invoice number (partial match)"),
      document_type: z.string().optional().describe("FatturaPA type: TD01, TD04, TD05, TD06, TD07..."),
      direction: z.enum(["outgoing", "incoming"]).optional().describe("outgoing or incoming"),
      invoice_date_from: z.string().optional().describe("Invoice date >= (ISO date)"),
      invoice_date_to: z.string().optional().describe("Invoice date <= (ISO date)"),
      created_at_from: z.string().optional().describe("Created at >= (ISO date)"),
      created_at_to: z.string().optional().describe("Created at <= (ISO date)"),
      order_by_date: z.enum(["asc", "desc"]).optional().describe("Sort by invoice date"),
      order_by_number: z.enum(["asc", "desc"]).optional().describe("Sort by invoice number"),
      downloaded: z.boolean().optional().describe("Filter by download status"),
      signed: z.boolean().optional().describe("Filter by signature status"),
      fields: z
        .array(z.string())
        .optional()
        .describe(
          "Fields to return (dot-notation supported, e.g. 'sender.business_name'). " +
          "Default compact view: uuid, created_at, document_type, marking, notice, invoice_number, " +
          "invoice_date, total_amount, currency, sender/recipient names+VAT, notifications. " +
          "Prefer adding specific fields over ['*']. Use ['*'] only when full FatturaPA payload is truly needed.",
        ),
    },
    async (params) => {
      try {
        const query = new URLSearchParams();
        query.set("page", String(params.page));
        query.set("itemsPerPage", String(params.items_per_page));

        if (params.marking) query.set("marking", params.marking);
        if (params.sender_name) query.set("sender.business_name", params.sender_name);
        if (params.sender_vat) query.set("sender.business_vat_number_code", params.sender_vat);
        if (params.sender_fiscal_code) query.set("sender.business_fiscal_code", params.sender_fiscal_code);
        if (params.recipient_name) query.set("recipient.business_name", params.recipient_name);
        if (params.recipient_vat) query.set("recipient.business_vat_number_code", params.recipient_vat);
        if (params.recipient_fiscal_code) query.set("recipient.business_fiscal_code", params.recipient_fiscal_code);
        if (params.invoice_number) query.set("invoice_number", params.invoice_number);
        if (params.document_type) query.set("document_type", params.document_type);
        if (params.direction) query.set("type", params.direction === "outgoing" ? "0" : "1");
        if (params.invoice_date_from) query.set("invoice_date[after]", params.invoice_date_from);
        if (params.invoice_date_to) query.set("invoice_date[before]", params.invoice_date_to);
        if (params.created_at_from) query.set("created_at[after]", params.created_at_from);
        if (params.created_at_to) query.set("created_at[before]", params.created_at_to);
        if (params.order_by_date) query.set("order[invoice_date]", params.order_by_date);
        if (params.order_by_number) query.set("order[invoice_number]", params.order_by_number);
        if (params.downloaded !== undefined) query.set("downloaded", String(params.downloaded));
        if (params.signed !== undefined) query.set("signed", String(params.signed));

        const response = await client.get<unknown>(
          `/invoices?${query.toString()}`,
        );

        let data = enrichInvoices(response.data);
        const wantAll = params.fields?.length === 1 && params.fields[0] === "*";
        if (!wantAll) {
          const selectedFields = params.fields ?? LIST_INVOICES_DEFAULT_FIELDS;
          data = pickFields(data, selectedFields);
        }
        return formatResponse(data);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );

  // ── get_invoice ───────────────────────────────────────────────────────
  server.tool(
    "get_invoice",
    "Get a specific invoice by UUID. Formats: json, xml, pdf (base64), html.",
    {
      uuid: z.string().describe("Invoice UUID"),
      format: z
        .enum(["json", "xml", "pdf", "html"])
        .optional()
        .default("json")
        .describe("Output format (default: json)"),
      print_theme: z.string().optional().describe("Print theme for PDF/HTML"),
      fields: z
        .array(z.string())
        .optional()
        .describe("Fields to return (JSON only, dot-notation). Omit for all fields."),
    },
    async (params) => {
      try {
        const acceptMap: Record<string, string> = {
          json: "application/json",
          xml: "application/xml",
          pdf: "application/pdf",
          html: "text/html",
        };

        const headers: Record<string, string> = {};
        if (params.print_theme) {
          headers["X-PrintTheme"] = params.print_theme;
        }

        const response = await client.get<unknown>(
          `/invoices/${encodeURIComponent(params.uuid)}`,
          {
            accept: acceptMap[params.format],
            headers,
          },
        );

        if (typeof response.data === "string") {
          return {
            content: [{ type: "text" as const, text: response.data }],
          };
        }

        const invoiceData = enrichInvoices(response.data);
        return formatResponse(invoiceData, params.fields);
      } catch (error: unknown) {
        return errorResponse(error);
      }
    },
  );
}
