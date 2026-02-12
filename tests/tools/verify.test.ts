import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerVerifyTools } from "../../src/tools/verify.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("verify tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mcpClient: Client;
  let server: McpServer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    mockClient = createMockClient();
    const env = await createTestServer(registerVerifyTools, mockClient);
    mcpClient = env.mcpClient;
    server = env.server;
    cleanup = env.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(() => {
    vi.mocked(mockClient.get).mockReset().mockResolvedValue({ status: 200, data: {} });
    vi.mocked(mockClient.post).mockReset().mockResolvedValue({ status: 202, data: {} });
    vi.mocked(mockClient.put).mockReset().mockResolvedValue({ status: 200, data: {} });
    vi.mocked(mockClient.delete).mockReset().mockResolvedValue({ status: 200, data: {} });
  });

  // ---------- verify_fiscal_id ----------

  describe("verify_fiscal_id", () => {
    it("should return verification data for a valid fiscal ID", async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: { valid: true, fiscal_id: "RSSMRA80A01H501U", type: "codice_fiscale" },
      });

      const result = await callTool(mcpClient, "verify_fiscal_id", { id: "RSSMRA80A01H501U" });

      expect(mockClient.get).toHaveBeenCalledWith("/verify/fiscal/RSSMRA80A01H501U");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      const parsed = JSON.parse(text);
      expect(parsed).toEqual({ valid: true, fiscal_id: "RSSMRA80A01H501U", type: "codice_fiscale" });
    });

    it("should encode special characters in the fiscal ID", async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: { valid: false },
      });

      await callTool(mcpClient, "verify_fiscal_id", { id: "ABC/123" });

      expect(mockClient.get).toHaveBeenCalledWith("/verify/fiscal/ABC%2F123");
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Not found"));

      const result = await callTool(mcpClient, "verify_fiscal_id", { id: "INVALID" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Not found");
    });
  });

  // ---------- verify_company ----------

  describe("verify_company", () => {
    it("should return full company data", async () => {
      const companyData = {
        company_name: "Test Srl",
        pec: "test@pec.it",
        recipient_code: "ABC1234",
      };
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: companyData,
      });

      const result = await callTool(mcpClient, "verify_company", { id: "01234567890" });

      expect(mockClient.get).toHaveBeenCalledWith("/verify/company/01234567890");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      const parsed = JSON.parse(text);
      expect(parsed).toEqual(companyData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("API error (500): Internal Server Error"));

      const result = await callTool(mcpClient, "verify_company", { id: "BAD" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("API error");
    });
  });

  // ---------- verify_simple_company ----------

  describe("verify_simple_company", () => {
    it("should return basic company info", async () => {
      const simpleData = { company_name: "Simple Srl", vat_number: "01234567890" };
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: simpleData,
      });

      const result = await callTool(mcpClient, "verify_simple_company", { id: "01234567890" });

      expect(mockClient.get).toHaveBeenCalledWith("/verify/simple-company/01234567890");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(simpleData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Timeout"));

      const result = await callTool(mcpClient, "verify_simple_company", { id: "BAD" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Timeout");
    });
  });

  // ---------- verify_split_payment ----------

  describe("verify_split_payment", () => {
    it("should return split payment status", async () => {
      const splitData = { split_payment: true, vat_number: "01234567890" };
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: splitData,
      });

      const result = await callTool(mcpClient, "verify_split_payment", { id: "01234567890" });

      expect(mockClient.get).toHaveBeenCalledWith("/verify/split-payment/01234567890");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(splitData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Service unavailable"));

      const result = await callTool(mcpClient, "verify_split_payment", { id: "BAD" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Service unavailable");
    });
  });
});
