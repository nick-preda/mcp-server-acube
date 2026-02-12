import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerInvoiceExtractTools } from "../../src/tools/invoice-extract.js";
import type { AcubeClient } from "../../src/client.js";

let mockClient: AcubeClient;
let mcpClient: Client;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  mockClient = createMockClient();
  const ctx = await createTestServer(registerInvoiceExtractTools, mockClient);
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

// ─── extract_invoice_from_pdf ──────────────────────────────────────────────────

describe("extract_invoice_from_pdf", () => {
  const pdfBase64 = "JVBERi0xLjQKMSAwIG9iago=";

  it("should send base64 PDF and return UUID", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce({
      status: 202,
      data: { uuid: "extract-uuid-001" },
    });

    const result = await callTool(mcpClient, "extract_invoice_from_pdf", {
      pdf_base64: pdfBase64,
    });

    expect(mockClient.post).toHaveBeenCalledWith("/invoice-extract", {
      pdf_base64: pdfBase64,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual({ uuid: "extract-uuid-001" });
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.post).mockRejectedValueOnce(
      new Error("Invalid PDF"),
    );

    const result = await callTool(mcpClient, "extract_invoice_from_pdf", {
      pdf_base64: pdfBase64,
    });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Invalid PDF");
  });
});

// ─── get_extraction_status ─────────────────────────────────────────────────────

describe("get_extraction_status", () => {
  const uuid = "extract-uuid-001";

  it("should return status object", async () => {
    const statusData = { uuid, status: "completed", progress: 100 };
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: statusData,
    });

    const result = await callTool(mcpClient, "get_extraction_status", { uuid });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoice-extract/${uuid}`,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual(statusData);
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("Job not found"),
    );

    const result = await callTool(mcpClient, "get_extraction_status", { uuid });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Job not found");
  });
});

// ─── get_extraction_result ─────────────────────────────────────────────────────

describe("get_extraction_result", () => {
  const uuid = "extract-uuid-001";

  it("should return parsed JSON data in JSON format", async () => {
    const extractedData = {
      fattura_elettronica_header: { transmitter: { id: "IT01234567890" } },
      fattura_elettronica_body: { general_data: { document_type: "TD01" } },
    };
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: extractedData,
    });

    const result = await callTool(mcpClient, "get_extraction_result", {
      uuid,
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoice-extract/${uuid}/result`,
      { accept: "application/json" },
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual(extractedData);
  });

  it("should return XML string in XML format", async () => {
    const xmlData = "<FatturaPA><Header/><Body/></FatturaPA>";
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: xmlData,
    });

    const result = await callTool(mcpClient, "get_extraction_result", {
      uuid,
      format: "xml",
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/invoice-extract/${uuid}/result`,
      { accept: "application/xml" },
    );
    expect((result.content as any)[0].text).toBe(xmlData);
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("Extraction not complete"),
    );

    const result = await callTool(mcpClient, "get_extraction_result", {
      uuid,
    });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain(
      "Extraction not complete",
    );
  });
});
