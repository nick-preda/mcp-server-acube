import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerCassettoFiscaleTools } from "../../src/tools/cassetto-fiscale.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("cassetto fiscale tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mcpClient: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    mockClient = createMockClient();
    const env = await createTestServer(registerCassettoFiscaleTools, mockClient);
    mcpClient = env.mcpClient;
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

  // ── schedule_invoice_download ─────────────────────────────────────────

  describe("schedule_invoice_download", () => {
    it("sends fiscal_id in path with optional options body", async () => {
      const mockData = { fiscal_id: "IT12345678901", active: true };
      vi.mocked(mockClient.post).mockResolvedValue({ status: 202, data: mockData });

      const result = await callTool(mcpClient, "schedule_invoice_download", {
        fiscal_id: "IT12345678901",
        options: { auto_renewal: true },
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/schedule/invoice-download/IT12345678901",
        { auto_renewal: true },
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("works without options body", async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ status: 202, data: { active: true } });

      const result = await callTool(mcpClient, "schedule_invoice_download", {
        fiscal_id: "IT12345678901",
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/schedule/invoice-download/IT12345678901",
        undefined,
      );
      expect(result.isError).toBeFalsy();
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValue(new Error("Schedule creation failed"));

      const result = await callTool(mcpClient, "schedule_invoice_download", {
        fiscal_id: "IT12345678901",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Schedule creation failed");
    });
  });

  // ── get_download_schedule ─────────────────────────────────────────────

  describe("get_download_schedule", () => {
    it("fetches schedule by fiscal_id", async () => {
      const mockData = { fiscal_id: "IT12345678901", active: true, auto_renewal: true };
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "get_download_schedule", {
        fiscal_id: "IT12345678901",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/schedule/invoice-download/IT12345678901",
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error("Not found"));

      const result = await callTool(mcpClient, "get_download_schedule", {
        fiscal_id: "IT00000000000",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Not found");
    });
  });

  // ── update_download_schedule ──────────────────────────────────────────

  describe("update_download_schedule", () => {
    it("sends update body for the given fiscal_id", async () => {
      const options = { auto_renewal: false };
      const mockData = { fiscal_id: "IT12345678901", active: true, auto_renewal: false };
      vi.mocked(mockClient.put).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "update_download_schedule", {
        fiscal_id: "IT12345678901",
        options,
      });

      expect(mockClient.put).toHaveBeenCalledWith(
        "/schedule/invoice-download/IT12345678901",
        options,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.put).mockRejectedValue(new Error("Update failed"));

      const result = await callTool(mcpClient, "update_download_schedule", {
        fiscal_id: "IT12345678901",
        options: { auto_renewal: false },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Update failed");
    });
  });

  // ── delete_download_schedule ──────────────────────────────────────────

  describe("delete_download_schedule", () => {
    it("deletes schedule for the given fiscal_id", async () => {
      vi.mocked(mockClient.delete).mockResolvedValue({ status: 200, data: {} });

      const result = await callTool(mcpClient, "delete_download_schedule", {
        fiscal_id: "IT12345678901",
      });

      expect(mockClient.delete).toHaveBeenCalledWith(
        "/schedule/invoice-download/IT12345678901",
      );
      expect(result.isError).toBeFalsy();
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.delete).mockRejectedValue(new Error("Delete failed"));

      const result = await callTool(mcpClient, "delete_download_schedule", {
        fiscal_id: "IT12345678901",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Delete failed");
    });
  });

  // ── download_invoices_once ────────────────────────────────────────────

  describe("download_invoices_once", () => {
    it("sends job params for one-time download", async () => {
      const mockData = { job_id: "job-123", status: "queued" };
      vi.mocked(mockClient.post).mockResolvedValue({ status: 202, data: mockData });

      const result = await callTool(mcpClient, "download_invoices_once", {
        fiscal_id: "IT12345678901",
        from_date: "2024-01-01",
        to_date: "2024-12-31",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/jobs/invoice-download", {
        fiscal_id: "IT12345678901",
        from_date: "2024-01-01",
        to_date: "2024-12-31",
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValue(new Error("Job creation failed"));

      const result = await callTool(mcpClient, "download_invoices_once", {
        fiscal_id: "IT12345678901",
        from_date: "2024-01-01",
        to_date: "2024-12-31",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Job creation failed");
    });
  });

  // ── count_rejected_invoices ───────────────────────────────────────────

  describe("count_rejected_invoices", () => {
    it("counts without date filters (no query string)", async () => {
      const mockData = { count: 5 };
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "count_rejected_invoices", {
        fiscal_id: "IT12345678901",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/rejected-invoices/IT12345678901/count",
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("counts with both date filters (has query params)", async () => {
      const mockData = { count: 2 };
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "count_rejected_invoices", {
        fiscal_id: "IT12345678901",
        from_date: "2024-01-01",
        to_date: "2024-06-30",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/rejected-invoices/IT12345678901/count?from_date=2024-01-01&to_date=2024-06-30",
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error("Server error"));

      const result = await callTool(mcpClient, "count_rejected_invoices", {
        fiscal_id: "IT12345678901",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Server error");
    });
  });

  // ── recover_rejected_invoices ─────────────────────────────────────────

  describe("recover_rejected_invoices", () => {
    it("sends recovery request with fiscal_id and date range", async () => {
      const mockData = { recovered: 3, status: "processing" };
      vi.mocked(mockClient.post).mockResolvedValue({ status: 202, data: mockData });

      const result = await callTool(mcpClient, "recover_rejected_invoices", {
        fiscal_id: "IT12345678901",
        from_date: "2024-01-01",
        to_date: "2024-06-30",
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/rejected-invoices/IT12345678901/recover",
        {
          from_date: "2024-01-01",
          to_date: "2024-06-30",
        },
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValue(new Error("Recovery failed"));

      const result = await callTool(mcpClient, "recover_rejected_invoices", {
        fiscal_id: "IT12345678901",
        from_date: "2024-01-01",
        to_date: "2024-06-30",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Recovery failed");
    });
  });
});
