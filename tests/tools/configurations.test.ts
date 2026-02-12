import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerConfigurationTools } from "../../src/tools/configurations.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("configuration tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mcpClient: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    mockClient = createMockClient();
    const env = await createTestServer(registerConfigurationTools, mockClient);
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

  // ── list_business_registries ──────────────────────────────────────────

  describe("list_business_registries", () => {
    it("returns the list of business registries", async () => {
      const mockData = [
        { id: "reg-1", fiscal_id: "IT12345678901", company_name: "Acme Srl" },
        { id: "reg-2", fiscal_id: "IT98765432100", company_name: "Beta SpA" },
      ];
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "list_business_registries");

      expect(mockClient.get).toHaveBeenCalledWith("/business-registry-configurations");
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error("Network error"));

      const result = await callTool(mcpClient, "list_business_registries");

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Network error");
    });
  });

  // ── create_business_registry ──────────────────────────────────────────

  describe("create_business_registry", () => {
    it("sends config body and returns created registry", async () => {
      const config = { fiscal_id: "IT12345678901", company_name: "Acme Srl" };
      const mockData = { id: "reg-new", ...config };
      vi.mocked(mockClient.post).mockResolvedValue({ status: 202, data: mockData });

      const result = await callTool(mcpClient, "create_business_registry", { config });

      expect(mockClient.post).toHaveBeenCalledWith("/business-registry-configurations", config);
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValue(new Error("Validation failed"));

      const result = await callTool(mcpClient, "create_business_registry", {
        config: { fiscal_id: "bad" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Validation failed");
    });
  });

  // ── get_business_registry ─────────────────────────────────────────────

  describe("get_business_registry", () => {
    it("fetches a business registry by ID", async () => {
      const mockData = { id: "reg-1", fiscal_id: "IT12345678901", company_name: "Acme Srl" };
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "get_business_registry", { id: "reg-1" });

      expect(mockClient.get).toHaveBeenCalledWith("/business-registry-configurations/reg-1");
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error("Not found"));

      const result = await callTool(mcpClient, "get_business_registry", { id: "no-such-id" });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Not found");
    });
  });

  // ── update_business_registry ──────────────────────────────────────────

  describe("update_business_registry", () => {
    it("sends update body for the given ID", async () => {
      const config = { company_name: "Acme Updated Srl" };
      const mockData = { id: "reg-1", fiscal_id: "IT12345678901", ...config };
      vi.mocked(mockClient.put).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "update_business_registry", {
        id: "reg-1",
        config,
      });

      expect(mockClient.put).toHaveBeenCalledWith(
        "/business-registry-configurations/reg-1",
        config,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.put).mockRejectedValue(new Error("Server error"));

      const result = await callTool(mcpClient, "update_business_registry", {
        id: "reg-1",
        config: { company_name: "fail" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Server error");
    });
  });

  // ── list_appointees ───────────────────────────────────────────────────

  describe("list_appointees", () => {
    it("returns the list of appointees", async () => {
      const mockData = [
        { id: "app-1", fiscal_id: "IT11111111111" },
        { id: "app-2", fiscal_id: "IT22222222222" },
      ];
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "list_appointees");

      expect(mockClient.get).toHaveBeenCalledWith("/ade-appointees");
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error("Unauthorized"));

      const result = await callTool(mcpClient, "list_appointees");

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Unauthorized");
    });
  });

  // ── create_appointee ──────────────────────────────────────────────────

  describe("create_appointee", () => {
    it("sends appointee data and returns created appointee", async () => {
      const appointee = { fiscal_id: "IT11111111111", name: "Mario Rossi" };
      const mockData = { id: "app-new", ...appointee };
      vi.mocked(mockClient.post).mockResolvedValue({ status: 202, data: mockData });

      const result = await callTool(mcpClient, "create_appointee", { appointee });

      expect(mockClient.post).toHaveBeenCalledWith("/ade-appointees", appointee);
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValue(new Error("Bad request"));

      const result = await callTool(mcpClient, "create_appointee", {
        appointee: { fiscal_id: "bad" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Bad request");
    });
  });

  // ── get_appointee ─────────────────────────────────────────────────────

  describe("get_appointee", () => {
    it("fetches an appointee by ID", async () => {
      const mockData = { id: "app-1", fiscal_id: "IT11111111111", name: "Mario Rossi" };
      vi.mocked(mockClient.get).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "get_appointee", { id: "app-1" });

      expect(mockClient.get).toHaveBeenCalledWith("/ade-appointees/app-1");
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error("Not found"));

      const result = await callTool(mcpClient, "get_appointee", { id: "no-such-id" });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Not found");
    });
  });

  // ── update_appointee ──────────────────────────────────────────────────

  describe("update_appointee", () => {
    it("sends update body for the given appointee ID", async () => {
      const appointee = { name: "Mario Rossi Updated" };
      const mockData = { id: "app-1", fiscal_id: "IT11111111111", ...appointee };
      vi.mocked(mockClient.put).mockResolvedValue({ status: 200, data: mockData });

      const result = await callTool(mcpClient, "update_appointee", {
        id: "app-1",
        appointee,
      });

      expect(mockClient.put).toHaveBeenCalledWith("/ade-appointees/app-1", appointee);
      expect(result.isError).toBeFalsy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(mockData);
    });

    it("returns isError on failure", async () => {
      vi.mocked(mockClient.put).mockRejectedValue(new Error("Conflict"));

      const result = await callTool(mcpClient, "update_appointee", {
        id: "app-1",
        appointee: { name: "fail" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Conflict");
    });
  });
});
