import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createMockClient } from "../helpers/mock-client.js";
import { createTestServer, callTool } from "../helpers/test-server.js";
import { registerNotificationTools } from "../../src/tools/notifications.js";
import type { AcubeClient } from "../../src/client.js";

let mockClient: AcubeClient;
let mcpClient: Client;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  mockClient = createMockClient();
  const ctx = await createTestServer(registerNotificationTools, mockClient);
  mcpClient = ctx.mcpClient;
  cleanup = ctx.cleanup;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(() => {
  vi.mocked(mockClient.get).mockReset().mockResolvedValue({ status: 200, data: {} });
  vi.mocked(mockClient.put).mockReset().mockResolvedValue({ status: 200, data: {} });
});

// ─── list_notifications ────────────────────────────────────────────────────────

describe("list_notifications", () => {
  it("should use default pagination (page=1, items_per_page=30)", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [], total: 0 },
    });

    const result = await callTool(mcpClient, "list_notifications", {});

    expect(mockClient.get).toHaveBeenCalledWith(
      expect.stringContaining("page=1"),
    );
    expect(mockClient.get).toHaveBeenCalledWith(
      expect.stringContaining("items_per_page=30"),
    );
    expect(result.isError).toBeUndefined();
  });

  it("should include type filter (e.g. RC)", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_notifications", { type: "RC" });

    expect(mockClient.get).toHaveBeenCalledWith(
      expect.stringContaining("type=RC"),
    );
  });

  it("should include downloaded filter", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: { items: [] },
    });

    await callTool(mcpClient, "list_notifications", { downloaded: true });

    expect(mockClient.get).toHaveBeenCalledWith(
      expect.stringContaining("downloaded=true"),
    );
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    const result = await callTool(mcpClient, "list_notifications", {});

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Connection refused");
  });
});

// ─── get_notification ──────────────────────────────────────────────────────────

describe("get_notification", () => {
  const uuid = "notif-uuid-789";

  it("should return JSON data in JSON format", async () => {
    const notifData = { uuid, type: "RC", downloaded: false };
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: notifData,
    });

    const result = await callTool(mcpClient, "get_notification", { uuid });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/notifications/${uuid}`,
      { accept: "application/json" },
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual(notifData);
  });

  it("should return XML string in XML format", async () => {
    const xmlData = "<Notification><Type>RC</Type></Notification>";
    vi.mocked(mockClient.get).mockResolvedValueOnce({
      status: 200,
      data: xmlData,
    });

    const result = await callTool(mcpClient, "get_notification", {
      uuid,
      format: "xml",
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      `/notifications/${uuid}`,
      { accept: "application/xml" },
    );
    expect((result.content as any)[0].text).toBe(xmlData);
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("Notification not found"),
    );

    const result = await callTool(mcpClient, "get_notification", { uuid });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain(
      "Notification not found",
    );
  });
});

// ─── mark_notifications_downloaded ─────────────────────────────────────────────

describe("mark_notifications_downloaded", () => {
  it("should send array of UUIDs to mark as downloaded", async () => {
    const uuids = ["uuid-1", "uuid-2", "uuid-3"];
    vi.mocked(mockClient.put).mockResolvedValueOnce({
      status: 200,
      data: { updated: 3 },
    });

    const result = await callTool(mcpClient, "mark_notifications_downloaded", {
      uuids,
    });

    expect(mockClient.put).toHaveBeenCalledWith("/notifications", uuids);
    expect(result.isError).toBeUndefined();
    const text = (result.content as any)[0].text;
    expect(JSON.parse(text)).toEqual({ updated: 3 });
  });

  it("should return isError on failure", async () => {
    vi.mocked(mockClient.put).mockRejectedValueOnce(
      new Error("Server error"),
    );

    const result = await callTool(mcpClient, "mark_notifications_downloaded", {
      uuids: ["uuid-1"],
    });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Server error");
  });
});
