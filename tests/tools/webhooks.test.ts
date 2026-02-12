import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerWebhookTools } from "../../src/tools/webhooks.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("webhook tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mcpClient: Client;
  let server: McpServer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    mockClient = createMockClient();
    const env = await createTestServer(registerWebhookTools, mockClient);
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

  // ---------- list_webhook_configs ----------

  describe("list_webhook_configs", () => {
    it("should return list of configs with no params", async () => {
      const configList = [
        { id: "cfg-1", event: "supplier-invoice", target_url: "https://example.com/hook1" },
        { id: "cfg-2", event: "receipt", target_url: "https://example.com/hook2" },
      ];
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: configList,
      });

      const result = await callTool(mcpClient, "list_webhook_configs", {});

      expect(mockClient.get).toHaveBeenCalledWith("/api-configurations");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(configList);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Unauthorized"));

      const result = await callTool(mcpClient, "list_webhook_configs", {});

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Unauthorized");
    });
  });

  // ---------- create_webhook_config ----------

  describe("create_webhook_config", () => {
    it("should create config with event and target_url only", async () => {
      const created = { id: "cfg-new", event: "receipt", target_url: "https://example.com/hook" };
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        status: 202,
        data: created,
      });

      const result = await callTool(mcpClient, "create_webhook_config", {
        event: "receipt",
        target_url: "https://example.com/hook",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/api-configurations", {
        event: "receipt",
        target_url: "https://example.com/hook",
      });
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(created);
    });

    it("should create config with full authentication params", async () => {
      const created = {
        id: "cfg-auth",
        event: "customer-invoice",
        target_url: "https://example.com/hook",
        authentication_type: "header",
        authentication_key: "X-Api-Key",
        authentication_token: "secret-token",
      };
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        status: 202,
        data: created,
      });

      const result = await callTool(mcpClient, "create_webhook_config", {
        event: "customer-invoice",
        target_url: "https://example.com/hook",
        authentication_type: "header",
        authentication_key: "X-Api-Key",
        authentication_token: "secret-token",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/api-configurations", {
        event: "customer-invoice",
        target_url: "https://example.com/hook",
        authentication_type: "header",
        authentication_key: "X-Api-Key",
        authentication_token: "secret-token",
      });
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(created);
    });

    it("should not include optional auth params when undefined", async () => {
      vi.mocked(mockClient.post).mockResolvedValueOnce({
        status: 202,
        data: { id: "cfg-min" },
      });

      await callTool(mcpClient, "create_webhook_config", {
        event: "supplier-invoice",
        target_url: "https://example.com/hook",
      });

      const calledBody = vi.mocked(mockClient.post).mock.calls[0][1] as Record<string, unknown>;
      expect(calledBody).not.toHaveProperty("authentication_type");
      expect(calledBody).not.toHaveProperty("authentication_key");
      expect(calledBody).not.toHaveProperty("authentication_token");
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.post).mockRejectedValueOnce(new Error("Invalid event type"));

      const result = await callTool(mcpClient, "create_webhook_config", {
        event: "receipt",
        target_url: "https://example.com/hook",
      });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Invalid event type");
    });
  });

  // ---------- get_webhook_config ----------

  describe("get_webhook_config", () => {
    it("should return a single config", async () => {
      const config = {
        id: "cfg-1",
        event: "supplier-invoice",
        target_url: "https://example.com/hook",
      };
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        status: 200,
        data: config,
      });

      const result = await callTool(mcpClient, "get_webhook_config", { id: "cfg-1" });

      expect(mockClient.get).toHaveBeenCalledWith("/api-configurations/cfg-1");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(config);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error("Config not found"));

      const result = await callTool(mcpClient, "get_webhook_config", { id: "nonexistent" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Config not found");
    });
  });

  // ---------- update_webhook_config ----------

  describe("update_webhook_config", () => {
    it("should update config fields", async () => {
      const updated = {
        id: "cfg-1",
        event: "receipt",
        target_url: "https://example.com/new-hook",
      };
      vi.mocked(mockClient.put).mockResolvedValueOnce({
        status: 200,
        data: updated,
      });

      const configUpdate = { target_url: "https://example.com/new-hook" };
      const result = await callTool(mcpClient, "update_webhook_config", {
        id: "cfg-1",
        config: configUpdate,
      });

      expect(mockClient.put).toHaveBeenCalledWith("/api-configurations/cfg-1", configUpdate);
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual(updated);
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.put).mockRejectedValueOnce(new Error("Update failed"));

      const result = await callTool(mcpClient, "update_webhook_config", {
        id: "cfg-1",
        config: { target_url: "bad" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Update failed");
    });
  });

  // ---------- delete_webhook_config ----------

  describe("delete_webhook_config", () => {
    it("should delete a config", async () => {
      vi.mocked(mockClient.delete).mockResolvedValueOnce({
        status: 200,
        data: { deleted: true },
      });

      const result = await callTool(mcpClient, "delete_webhook_config", { id: "cfg-1" });

      expect(mockClient.delete).toHaveBeenCalledWith("/api-configurations/cfg-1");
      expect(result.isError).toBeUndefined();
      const text = (result.content as any)[0].text;
      expect(JSON.parse(text)).toEqual({ deleted: true });
    });

    it("should return isError on failure", async () => {
      vi.mocked(mockClient.delete).mockRejectedValueOnce(new Error("Forbidden"));

      const result = await callTool(mcpClient, "delete_webhook_config", { id: "cfg-locked" });

      expect(result.isError).toBe(true);
      const text = (result.content as any)[0].text;
      expect(text).toContain("Forbidden");
    });
  });
});
