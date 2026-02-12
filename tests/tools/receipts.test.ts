import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerReceiptTools } from "../../src/tools/receipts.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("receipt tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mcpClient: Client;
  let server: McpServer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    mockClient = createMockClient();
    const env = await createTestServer(registerReceiptTools, mockClient);
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

  // ---------- send_receipt ----------

  describe("send_receipt", () => {
    it("should send receipt data and return receipt info", async () => {
      const receiptData = {
        fiscal_id: "01234567890",
        items: [{ quantity: 1, description: "Item A", unit_price: 10.0, vat_rate_code: "22" }],
        cash_payment_amount: 0,
        electronic_payment_amount: 12.2,
      };
      const responseData = { id: "rec-001", status: "submitted" };

      vi.mocked(mockClient.post).mockResolvedValueOnce({
        status: 202,
        data: responseData,
      });

      const result = await callTool(mcpClient, "send_receipt", { receipt: receiptData });

      expect(mockClient.post).toHaveBeenCalledWith("/receipts", receiptData);
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(responseData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValueOnce(new Error("Submission rejected"));

      const result = await callTool(mcpClient, "send_receipt", {
        receipt: { fiscal_id: "BAD" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Submission rejected");
    });
  });

  // ---------- get_receipt_details ----------

  describe("get_receipt_details", () => {
    it("should return receipt details with transaction_id", async () => {
      const detailsData = {
        id: "rec-001",
        transaction_id: "txn-abc-123",
        document_number: "0001",
        status: "completed",
      };
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: detailsData,
      });

      const result = await callTool(mcpClient, "get_receipt_details", { id: "rec-001" });

      expect(mockClient.get).toHaveBeenCalledWith("/receipts/rec-001/details");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.transaction_id).toBe("txn-abc-123");
      expect(parsed).toEqual(detailsData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Receipt not found"));

      const result = await callTool(mcpClient, "get_receipt_details", { id: "nonexistent" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Receipt not found");
    });
  });

  // ---------- void_receipt ----------

  describe("void_receipt", () => {
    it("should void a receipt successfully", async () => {
      const voidData = { id: "rec-001", status: "voided" };
      vi.mocked(mockClient.delete).mockResolvedValueOnce({
        status: 200,
        data: voidData,
      });

      const result = await callTool(mcpClient, "void_receipt", { id: "rec-001" });

      expect(mockClient.delete).toHaveBeenCalledWith("/receipts/rec-001");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(voidData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.delete).mockRejectedValueOnce(new Error("Cannot void receipt"));

      const result = await callTool(mcpClient, "void_receipt", { id: "rec-locked" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Cannot void receipt");
    });
  });

  // ---------- return_receipt_items ----------

  describe("return_receipt_items", () => {
    it("should send items to return", async () => {
      const items = [
        { description: "Item A", quantity: 1, unit_price: 10.0 },
        { description: "Item B", quantity: 2, unit_price: 5.0 },
      ];
      const returnData = { id: "ret-001", status: "submitted" };

      vi.mocked(mockClient.post).mockResolvedValueOnce({
        status: 202,
        data: returnData,
      });

      const result = await callTool(mcpClient, "return_receipt_items", {
        id: "rec-001",
        items,
      });

      expect(mockClient.post).toHaveBeenCalledWith("/receipts/rec-001/return", items);
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(returnData);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValueOnce(new Error("Return failed"));

      const result = await callTool(mcpClient, "return_receipt_items", {
        id: "rec-001",
        items: [{ description: "Bad item" }],
      });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Return failed");
    });
  });
});
