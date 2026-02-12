import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerInvoiceTools } from "../../src/tools/invoices.js";
import type { AcubeClient } from "../../src/client.js";

let mockClient: AcubeClient;
let mcpClient: Client;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  mockClient = createMockClient();
  const ctx = await createTestServer(registerInvoiceTools, mockClient);
  mcpClient = ctx.mcpClient;
  cleanup = ctx.cleanup;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(() => {
  vi.mocked(mockClient.get).mockReset().mockResolvedValue({ status: 200, data: {} });
  vi.mocked(mockClient.post).mockReset().mockResolvedValue({ status: 202, data: {} });
});

// ─── send_invoice ──────────────────────────────────────────────────────────────

describe("send_invoice", () => {
  const sampleInvoice = {
    fattura_elettronica_header: { dati_trasmissione: {} },
    fattura_elettronica_body: { dati_generali: {} },
  };

  it("should send an invoice and return UUID", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      status: 202,
      data: { uuid: "inv-uuid-123" },
    });

    const result = await callTool(mcpClient, "send_invoice", {
      invoice: sampleInvoice,
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/invoices",
      sampleInvoice,
      { headers: {} },
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual({ uuid: "inv-uuid-123" });
  });

  it("should set X-SignInvoice header when sign=true", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      status: 202,
      data: { uuid: "signed-uuid" },
    });

    await callTool(mcpClient, "send_invoice", {
      invoice: sampleInvoice,
      sign: true,
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/invoices",
      sampleInvoice,
      { headers: { "X-SignInvoice": "true" } },
    );
  });

  it("should NOT set X-SignInvoice header when sign is undefined", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      status: 202,
      data: { uuid: "unsigned-uuid" },
    });

    await callTool(mcpClient, "send_invoice", {
      invoice: sampleInvoice,
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/invoices",
      sampleInvoice,
      { headers: {} },
    );
  });

  it("should return isError on API failure", async () => {
    vi.mocked(mockClient.post).mockRejectedValueOnce(new Error("API down"));

    const result = await callTool(mcpClient, "send_invoice", {
      invoice: sampleInvoice,
    });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("API down");
  });
});

// ─── send_simplified_invoice ───────────────────────────────────────────────────

describe("send_simplified_invoice", () => {
  const simplifiedInvoice = {
    fattura_elettronica_header: {},
    fattura_elettronica_body: {},
  };

  it("should send a simplified invoice and return UUID", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      status: 202,
      data: { uuid: "simplified-uuid-456" },
    });

    const result = await callTool(mcpClient, "send_simplified_invoice", {
      invoice: simplifiedInvoice,
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/invoices/simplified",
      simplifiedInvoice,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual({ uuid: "simplified-uuid-456" });
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.post).mockRejectedValueOnce(
      new Error("Validation failed"),
    );

    const result = await callTool(mcpClient, "send_simplified_invoice", {
      invoice: simplifiedInvoice,
    });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Validation failed");
  });
});

// ─── list_invoices ─────────────────────────────────────────────────────────────

describe("list_invoices", () => {
  /** Helper: extract the query string from the GET call URL */
  function getCalledUrl(): string {
    return vi.mocked(mockClient.get).mock.calls[0][0] as string;
  }

  /** Helper: parse query params from the GET call URL */
  function getCalledParams(): URLSearchParams {
    const url = getCalledUrl();
    return new URLSearchParams(url.split("?")[1]);
  }

  it("should use default pagination (page=1, itemsPerPage=30)", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [], total: 0 },
    });

    const result = await callTool(mcpClient, "list_invoices", {});

    const params = getCalledParams();
    expect(params.get("page")).toBe("1");
    expect(params.get("itemsPerPage")).toBe("30");
    expect(result.isError).toBeUndefined();
  });

  it("should include marking filter in query string", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { marking: "delivered" });

    const params = getCalledParams();
    expect(params.get("marking")).toBe("delivered");
  });

  // ── Sender (cedente) filters ──

  it("should include sender name filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { sender_name: "Ristorante Da Mario" });

    const params = getCalledParams();
    expect(params.get("sender.business_name")).toBe("Ristorante Da Mario");
  });

  it("should include sender VAT filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { sender_vat: "03090780218" });

    const params = getCalledParams();
    expect(params.get("sender.business_vat_number_code")).toBe("03090780218");
  });

  it("should include sender fiscal code filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { sender_fiscal_code: "RSSMRA80A01H501Z" });

    const params = getCalledParams();
    expect(params.get("sender.business_fiscal_code")).toBe("RSSMRA80A01H501Z");
  });

  // ── Recipient (cessionario) filters ──

  it("should include recipient name filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { recipient_name: "Cipay" });

    const params = getCalledParams();
    expect(params.get("recipient.business_name")).toBe("Cipay");
  });

  it("should include recipient VAT filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { recipient_vat: "12345678901" });

    const params = getCalledParams();
    expect(params.get("recipient.business_vat_number_code")).toBe("12345678901");
  });

  it("should include recipient fiscal code filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { recipient_fiscal_code: "BNCLRA90B41F205X" });

    const params = getCalledParams();
    expect(params.get("recipient.business_fiscal_code")).toBe("BNCLRA90B41F205X");
  });

  // ── Invoice number ──

  it("should include invoice number filter with partial match support", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { invoice_number: "2025/1" });

    const params = getCalledParams();
    expect(params.get("invoice_number")).toBe("2025/1");
  });

  // ── Document type ──

  it("should include document type filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { document_type: "TD04" });

    const params = getCalledParams();
    expect(params.get("document_type")).toBe("TD04");
  });

  // ── Direction ──

  it("should map direction 'outgoing' to type=0", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { direction: "outgoing" });

    const params = getCalledParams();
    expect(params.get("type")).toBe("0");
  });

  it("should map direction 'incoming' to type=1", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { direction: "incoming" });

    const params = getCalledParams();
    expect(params.get("type")).toBe("1");
  });

  // ── Invoice date range ──

  it("should include invoice date range filters", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", {
      invoice_date_from: "2024-01-01",
      invoice_date_to: "2024-12-31",
    });

    const params = getCalledParams();
    expect(params.get("invoice_date[after]")).toBe("2024-01-01");
    expect(params.get("invoice_date[before]")).toBe("2024-12-31");
  });

  // ── Creation date range ──

  it("should include creation date range filters", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", {
      created_at_from: "2024-06-01",
      created_at_to: "2024-06-30",
    });

    const params = getCalledParams();
    expect(params.get("created_at[after]")).toBe("2024-06-01");
    expect(params.get("created_at[before]")).toBe("2024-06-30");
  });

  // ── Sorting ──

  it("should include order by invoice date", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { order_by_date: "desc" });

    const params = getCalledParams();
    expect(params.get("order[invoice_date]")).toBe("desc");
  });

  it("should include order by invoice number", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { order_by_number: "asc" });

    const params = getCalledParams();
    expect(params.get("order[invoice_number]")).toBe("asc");
  });

  // ── Boolean flags ──

  it("should include downloaded flag when true", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { downloaded: true });

    const params = getCalledParams();
    expect(params.get("downloaded")).toBe("true");
  });

  it("should include downloaded flag when false", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { downloaded: false });

    const params = getCalledParams();
    expect(params.get("downloaded")).toBe("false");
  });

  it("should include signed flag when true", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { signed: true });

    const params = getCalledParams();
    expect(params.get("signed")).toBe("true");
  });

  it("should include signed flag when false", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { signed: false });

    const params = getCalledParams();
    expect(params.get("signed")).toBe("false");
  });

  // ── Custom pagination ──

  it("should support custom page and items_per_page", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { page: 5, items_per_page: 100 });

    const params = getCalledParams();
    expect(params.get("page")).toBe("5");
    expect(params.get("itemsPerPage")).toBe("100");
  });

  // ── Individual date range filters ──

  it("should include only invoice_date_from without invoice_date_to", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { invoice_date_from: "2024-01-01" });

    const params = getCalledParams();
    expect(params.get("invoice_date[after]")).toBe("2024-01-01");
    expect(params.has("invoice_date[before]")).toBe(false);
  });

  it("should include only invoice_date_to without invoice_date_from", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { invoice_date_to: "2024-12-31" });

    const params = getCalledParams();
    expect(params.has("invoice_date[after]")).toBe(false);
    expect(params.get("invoice_date[before]")).toBe("2024-12-31");
  });

  it("should include only created_at_from without created_at_to", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { created_at_from: "2024-06-01" });

    const params = getCalledParams();
    expect(params.get("created_at[after]")).toBe("2024-06-01");
    expect(params.has("created_at[before]")).toBe(false);
  });

  it("should include only created_at_to without created_at_from", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { created_at_to: "2024-06-30" });

    const params = getCalledParams();
    expect(params.has("created_at[after]")).toBe(false);
    expect(params.get("created_at[before]")).toBe("2024-06-30");
  });

  // ── Response content verification ──

  it("should return response data as formatted JSON", async () => {
    const responseData = {
      "hydra:member": [
        { uuid: "inv-1", marking: "delivered" },
        { uuid: "inv-2", marking: "sent" },
      ],
      "hydra:totalItems": 2,
    };
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: responseData,
    });

    // fields: ["*"] bypasses enrichInvoices + pickFields, returning full data
    const result = await callTool(mcpClient, "list_invoices", { marking: "delivered", fields: ["*"] });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual(responseData);
  });

  // ── Combined filters ──

  it("should support ALL filters combined", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", {
      page: 3,
      items_per_page: 10,
      marking: "delivered",
      sender_name: "Ristorante Da Mario",
      sender_vat: "03090780218",
      sender_fiscal_code: "RSSMRA80A01H501Z",
      recipient_name: "Cipay Srl",
      recipient_vat: "12345678901",
      recipient_fiscal_code: "BNCLRA90B41F205X",
      invoice_number: "2025/1",
      document_type: "TD01",
      direction: "outgoing",
      invoice_date_from: "2024-01-01",
      invoice_date_to: "2024-12-31",
      created_at_from: "2024-01-01",
      created_at_to: "2024-12-31",
      order_by_date: "desc",
      order_by_number: "asc",
      downloaded: true,
      signed: false,
    });

    const params = getCalledParams();
    expect(params.get("page")).toBe("3");
    expect(params.get("itemsPerPage")).toBe("10");
    expect(params.get("marking")).toBe("delivered");
    expect(params.get("sender.business_name")).toBe("Ristorante Da Mario");
    expect(params.get("sender.business_vat_number_code")).toBe("03090780218");
    expect(params.get("sender.business_fiscal_code")).toBe("RSSMRA80A01H501Z");
    expect(params.get("recipient.business_name")).toBe("Cipay Srl");
    expect(params.get("recipient.business_vat_number_code")).toBe("12345678901");
    expect(params.get("recipient.business_fiscal_code")).toBe("BNCLRA90B41F205X");
    expect(params.get("invoice_number")).toBe("2025/1");
    expect(params.get("document_type")).toBe("TD01");
    expect(params.get("type")).toBe("0");
    expect(params.get("invoice_date[after]")).toBe("2024-01-01");
    expect(params.get("invoice_date[before]")).toBe("2024-12-31");
    expect(params.get("created_at[after]")).toBe("2024-01-01");
    expect(params.get("created_at[before]")).toBe("2024-12-31");
    expect(params.get("order[invoice_date]")).toBe("desc");
    expect(params.get("order[invoice_number]")).toBe("asc");
    expect(params.get("downloaded")).toBe("true");
    expect(params.get("signed")).toBe("false");
  });

  it("should not include ANY optional params when not provided", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", {});

    const params = getCalledParams();
    // Only pagination defaults should be present
    expect(params.get("page")).toBe("1");
    expect(params.get("itemsPerPage")).toBe("30");
    // Verify ALL optional params are absent
    expect(params.has("marking")).toBe(false);
    expect(params.has("sender.business_name")).toBe(false);
    expect(params.has("sender.business_vat_number_code")).toBe(false);
    expect(params.has("sender.business_fiscal_code")).toBe(false);
    expect(params.has("recipient.business_name")).toBe(false);
    expect(params.has("recipient.business_vat_number_code")).toBe(false);
    expect(params.has("recipient.business_fiscal_code")).toBe(false);
    expect(params.has("invoice_number")).toBe(false);
    expect(params.has("document_type")).toBe(false);
    expect(params.has("type")).toBe(false);
    expect(params.has("invoice_date[after]")).toBe(false);
    expect(params.has("invoice_date[before]")).toBe(false);
    expect(params.has("created_at[after]")).toBe(false);
    expect(params.has("created_at[before]")).toBe(false);
    expect(params.has("order[invoice_date]")).toBe(false);
    expect(params.has("order[invoice_number]")).toBe(false);
    expect(params.has("downloaded")).toBe(false);
    expect(params.has("signed")).toBe(false);
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Timeout"));

    const result = await callTool(mcpClient, "list_invoices", {});

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Timeout");
  });

  it("should handle non-Error exceptions gracefully", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce("string error");

    const result = await callTool(mcpClient, "list_invoices", {});

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toBe("string error");
  });

  // ── URL path verification ──

  it("should always call GET /invoices with query string", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_invoices", { sender_name: "Test" });

    const url = getCalledUrl();
    expect(url).toMatch(/^\/invoices\?/);
  });
});

// ─── get_invoice ───────────────────────────────────────────────────────────────

describe("get_invoice", () => {
  const uuid = "abc-def-123";

  it("should retrieve invoice in JSON format by default", async () => {
    const invoiceData = { uuid, status: "delivered" };
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: invoiceData,
    });

    const result = await callTool(mcpClient, "get_invoice", { uuid });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoices/${uuid}`,
      { accept: "application/json", headers: {} },
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual(invoiceData);
  });

  it("should retrieve invoice in XML format", async () => {
    const xmlData = "<FatturaPA>...</FatturaPA>";
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: xmlData,
    });

    const result = await callTool(mcpClient, "get_invoice", {
      uuid,
      format: "xml",
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoices/${uuid}`,
      { accept: "application/xml", headers: {} },
    );
    expect((result.content as any)[0].text).toBe(xmlData);
  });

  it("should retrieve invoice in PDF format as base64 string", async () => {
    const base64Data = "JVBERi0xLjQK...";
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: base64Data,
    });

    const result = await callTool(mcpClient, "get_invoice", {
      uuid,
      format: "pdf",
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoices/${uuid}`,
      { accept: "application/pdf", headers: {} },
    );
    expect((result.content as any)[0].text).toBe(base64Data);
  });

  it("should set X-PrintTheme header when print_theme is provided", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: "pdf-data",
    });

    await callTool(mcpClient, "get_invoice", {
      uuid,
      format: "pdf",
      print_theme: "elegant",
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoices/${uuid}`,
      {
        accept: "application/pdf",
        headers: { "X-PrintTheme": "elegant" },
      },
    );
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Not found"));

    const result = await callTool(mcpClient, "get_invoice", { uuid });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Not found");
  });
});
