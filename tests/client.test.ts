import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AcubeClient } from "../src/client.js";

describe("AcubeClient", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  const defaultConfig = {
    email: "test@test.com",
    password: "testpass",
    environment: "sandbox" as const,
  };

  /** Helper: create a mock Response for fetch */
  function mockFetchResponse(options: {
    ok?: boolean;
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
    isArrayBuffer?: boolean;
  }) {
    const {
      ok = true,
      status = 200,
      body = {},
      headers = {},
      isArrayBuffer = false,
    } = options;

    const headersMap = new Map(Object.entries(headers));

    return {
      ok,
      status,
      text: vi.fn().mockResolvedValue(
        typeof body === "string" ? body : JSON.stringify(body),
      ),
      json: vi.fn().mockResolvedValue(body),
      arrayBuffer: vi.fn().mockResolvedValue(
        isArrayBuffer && body instanceof ArrayBuffer
          ? body
          : new TextEncoder().encode(
              typeof body === "string" ? body : JSON.stringify(body),
            ).buffer,
      ),
      headers: {
        get: (key: string) => headersMap.get(key) ?? headers[key.toLowerCase()] ?? null,
      },
    } as unknown as Response;
  }

  /** Helper: set up fetch to respond to login first, then subsequent calls */
  function setupFetchWithLogin(
    apiResponse: ReturnType<typeof mockFetchResponse>,
    loginToken = "test-jwt-token",
  ) {
    const loginResponse = mockFetchResponse({
      ok: true,
      status: 200,
      body: { token: loginToken },
    });

    fetchMock.mockResolvedValueOnce(loginResponse).mockResolvedValueOnce(apiResponse);
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ─── getBaseUrl ──────────────────────────────────────────────────────
  describe("getBaseUrl", () => {
    it("returns sandbox URLs for sandbox environment", () => {
      const client = new AcubeClient(defaultConfig);
      expect(client.getBaseUrl("common")).toBe(
        "https://common-sandbox.api.acubeapi.com",
      );
      expect(client.getBaseUrl("govIt")).toBe(
        "https://api-sandbox.acubeapi.com",
      );
    });

    it("returns production URLs for production environment", () => {
      const client = new AcubeClient({
        ...defaultConfig,
        environment: "production",
      });
      expect(client.getBaseUrl("common")).toBe(
        "https://common.api.acubeapi.com",
      );
      expect(client.getBaseUrl("govIt")).toBe("https://api.acubeapi.com");
    });
  });

  // ─── Login and token caching ─────────────────────────────────────────
  describe("login and token caching", () => {
    it("logs in with correct credentials on first request", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: true,
        status: 200,
        body: { token: "test-jwt-token" },
      });
      const apiResponse = mockFetchResponse({
        ok: true,
        status: 200,
        body: { items: [] },
      });

      fetchMock.mockResolvedValueOnce(loginResponse).mockResolvedValueOnce(apiResponse);

      await client.get("/test");

      // First call should be login
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [loginUrl, loginOpts] = fetchMock.mock.calls[0];
      expect(loginUrl).toBe("https://common-sandbox.api.acubeapi.com/login");
      expect(loginOpts.method).toBe("POST");
      expect(JSON.parse(loginOpts.body)).toEqual({
        email: "test@test.com",
        password: "testpass",
      });

      // Second call should be the actual API request with Bearer token
      const [apiUrl, apiOpts] = fetchMock.mock.calls[1];
      expect(apiUrl).toBe("https://api-sandbox.acubeapi.com/test");
      expect(apiOpts.headers.Authorization).toBe("Bearer test-jwt-token");
    });

    it("reuses cached token for subsequent requests within 23h", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: true,
        status: 200,
        body: { token: "cached-token" },
      });
      const apiResponse1 = mockFetchResponse({ ok: true, body: { a: 1 } });
      const apiResponse2 = mockFetchResponse({ ok: true, body: { b: 2 } });

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse1)
        .mockResolvedValueOnce(apiResponse2);

      await client.get("/first");
      await client.get("/second");

      // Login called once, then two API calls = 3 total
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Both API calls should use the same token
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer cached-token",
      );
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
        "Bearer cached-token",
      );
    });

    it("re-authenticates after token expires (23h)", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse1 = mockFetchResponse({
        ok: true,
        body: { token: "token-1" },
      });
      const apiResponse1 = mockFetchResponse({ ok: true, body: { a: 1 } });
      const loginResponse2 = mockFetchResponse({
        ok: true,
        body: { token: "token-2" },
      });
      const apiResponse2 = mockFetchResponse({ ok: true, body: { b: 2 } });

      fetchMock
        .mockResolvedValueOnce(loginResponse1)
        .mockResolvedValueOnce(apiResponse1)
        .mockResolvedValueOnce(loginResponse2)
        .mockResolvedValueOnce(apiResponse2);

      // First request triggers login
      await client.get("/first");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Advance time past 23 hours
      vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 1);

      // Second request should trigger a new login
      await client.get("/second");
      expect(fetchMock).toHaveBeenCalledTimes(4);

      // Verify second login was called
      expect(fetchMock.mock.calls[2][0]).toBe(
        "https://common-sandbox.api.acubeapi.com/login",
      );
      // Verify new token is used
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe(
        "Bearer token-2",
      );
    });

    it("does NOT re-authenticate before 23h", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "token-1" },
      });
      const apiResponse1 = mockFetchResponse({ ok: true, body: {} });
      const apiResponse2 = mockFetchResponse({ ok: true, body: {} });

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse1)
        .mockResolvedValueOnce(apiResponse2);

      await client.get("/first");

      // Advance time to just under 23 hours
      vi.advanceTimersByTime(23 * 60 * 60 * 1000 - 1000);

      await client.get("/second");

      // Only 1 login + 2 API calls = 3 total (no second login)
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Login failure ───────────────────────────────────────────────────
  describe("login failure", () => {
    it("throws descriptive error on 401 login response", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: false,
        status: 401,
        body: "Invalid credentials",
      });
      fetchMock.mockResolvedValueOnce(loginResponse);

      await expect(client.get("/anything")).rejects.toThrow(
        "Acube login failed (401): Invalid credentials",
      );
    });

    it("throws descriptive error on 500 login response", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: false,
        status: 500,
        body: "Internal server error",
      });
      fetchMock.mockResolvedValueOnce(loginResponse);

      await expect(client.get("/anything")).rejects.toThrow(
        "Acube login failed (500): Internal server error",
      );
    });

    it("throws when login returns non-ok status with JSON body", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: false,
        status: 403,
        body: { message: "Forbidden" },
      });
      fetchMock.mockResolvedValueOnce(loginResponse);

      await expect(client.get("/test")).rejects.toThrow(
        /Acube login failed \(403\)/,
      );
    });
  });

  // ─── request method ──────────────────────────────────────────────────
  describe("request method", () => {
    it("parses JSON response correctly", async () => {
      const client = new AcubeClient(defaultConfig);
      const responseBody = { invoices: [{ id: "inv-1" }, { id: "inv-2" }] };

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: responseBody }),
      );

      const result = await client.get("/invoices");

      expect(result.status).toBe(200);
      expect(result.data).toEqual(responseBody);
    });

    it("treats 202 status as success (invoice submission)", async () => {
      const client = new AcubeClient(defaultConfig);
      const responseBody = { uuid: "abc-123", status: "accepted" };

      setupFetchWithLogin(
        mockFetchResponse({ ok: false, status: 202, body: responseBody }),
      );

      const result = await client.post("/invoices", { xml: "<Invoice/>" });

      expect(result.status).toBe(202);
      expect(result.data).toEqual(responseBody);
    });

    it("handles PDF response with base64 encoding", async () => {
      const client = new AcubeClient(defaultConfig);
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      const pdfBuffer = pdfBytes.buffer;

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "test-jwt-token" },
      });
      const pdfResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(pdfBuffer),
        text: vi.fn().mockResolvedValue(""),
        headers: {
          get: () => "application/pdf",
        },
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(pdfResponse);

      const result = await client.get("/invoices/123/pdf", {
        accept: "application/pdf",
      });

      expect(result.status).toBe(200);
      // Verify it's base64 encoded
      const expectedBase64 = Buffer.from(pdfBuffer).toString("base64");
      expect(result.data).toBe(expectedBase64);
      expect(result.raw).toBeDefined();
    });

    it("handles octet-stream response with base64 encoding", async () => {
      const client = new AcubeClient(defaultConfig);
      const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const binaryBuffer = binaryData.buffer;

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "test-jwt-token" },
      });
      const binaryResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(binaryBuffer),
        text: vi.fn().mockResolvedValue(""),
        headers: {
          get: () => "application/octet-stream",
        },
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(binaryResponse);

      const result = await client.get("/files/download", {
        accept: "application/octet-stream",
      });

      expect(result.status).toBe(200);
      const expectedBase64 = Buffer.from(binaryBuffer).toString("base64");
      expect(result.data).toBe(expectedBase64);
    });

    it("returns raw text for XML response", async () => {
      const client = new AcubeClient(defaultConfig);
      const xmlBody = '<?xml version="1.0"?><Invoice><ID>123</ID></Invoice>';

      setupFetchWithLogin(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: xmlBody,
          headers: { "content-type": "application/xml" },
        }),
      );

      const result = await client.get("/invoices/123/xml", {
        accept: "application/xml",
      });

      expect(result.status).toBe(200);
      expect(result.data).toBe(xmlBody);
    });

    it("returns raw text when JSON parse fails", async () => {
      const client = new AcubeClient(defaultConfig);
      const plainText = "not valid json at all";

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "test-jwt-token" },
      });

      // Create a response where text() returns non-parseable JSON but
      // Accept header is application/json (the default)
      const textResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(plainText),
        headers: {
          get: () => "text/plain",
        },
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(textResponse);

      // Default accept is application/json, but response content-type is text/plain
      // Since accept is "application/json", it will try to parse, fail, and return text
      const result = await client.get("/some-endpoint");

      expect(result.status).toBe(200);
      expect(result.data).toBe(plainText);
    });

    it("throws on 4xx error response", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({
          ok: false,
          status: 404,
          body: "Not Found",
        }),
      );

      await expect(client.get("/missing")).rejects.toThrow(
        "Acube API error (404): Not Found",
      );
    });

    it("throws on 5xx error response", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({
          ok: false,
          status: 500,
          body: "Internal Server Error",
        }),
      );

      await expect(client.get("/broken")).rejects.toThrow(
        "Acube API error (500): Internal Server Error",
      );
    });

    it("throws on 400 error with JSON body", async () => {
      const client = new AcubeClient(defaultConfig);
      const errorBody = { error: "validation_error", message: "Invalid field" };

      setupFetchWithLogin(
        mockFetchResponse({
          ok: false,
          status: 400,
          body: errorBody,
        }),
      );

      await expect(client.post("/invoices", {})).rejects.toThrow(
        /Acube API error \(400\)/,
      );
    });

    it("throws on PDF response with error status", async () => {
      const client = new AcubeClient(defaultConfig);

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "test-jwt-token" },
      });
      const errorResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("PDF not found"),
        headers: {
          get: () => "text/plain",
        },
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(errorResponse);

      await expect(
        client.get("/invoices/999/pdf", { accept: "application/pdf" }),
      ).rejects.toThrow("Acube API error (404): PDF not found");
    });

    it("serializes object body as JSON", async () => {
      const client = new AcubeClient(defaultConfig);
      const body = { name: "Test Invoice", amount: 100 };

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: { id: "new-1" } }),
      );

      await client.post("/invoices", body);

      // Check the API call (second fetch call, index 1)
      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.body).toBe(JSON.stringify(body));
    });

    it("passes raw string body without JSON.stringify", async () => {
      const client = new AcubeClient(defaultConfig);
      const xmlBody = "<Invoice><ID>123</ID></Invoice>";

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 202, body: { uuid: "abc" } }),
      );

      await client.post("/invoices", xmlBody, {
        headers: { "Content-Type": "application/xml" },
      });

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.body).toBe(xmlBody);
    });

    it("auto-sets Content-Type to application/json when body is present", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.post("/test", { foo: "bar" });

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers["Content-Type"]).toBe("application/json");
    });

    it("does NOT set Content-Type when no body is provided", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.get("/test");

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers["Content-Type"]).toBeUndefined();
    });

    it("does not override explicit Content-Type header", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.post("/test", "<xml/>", {
        headers: { "Content-Type": "application/xml" },
      });

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers["Content-Type"]).toBe("application/xml");
    });

    it("passes custom headers through to the request", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.get("/test", {
        headers: { "X-Custom-Header": "custom-value" },
      });

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers["X-Custom-Header"]).toBe("custom-value");
      // Should still have Authorization
      expect(apiOpts.headers.Authorization).toBe("Bearer test-jwt-token");
    });

    it("sets Accept header from options", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: "<xml/>",
          headers: { "content-type": "application/xml" },
        }),
      );

      await client.get("/test", { accept: "application/xml" });

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers.Accept).toBe("application/xml");
    });

    it("defaults Accept to application/json", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.get("/test");

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers.Accept).toBe("application/json");
    });

    it("uses govIt service by default", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.get("/test");

      const [apiUrl] = fetchMock.mock.calls[1];
      expect(apiUrl).toBe("https://api-sandbox.acubeapi.com/test");
    });

    it("uses common service when specified", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.get("/test", { service: "common" });

      const [apiUrl] = fetchMock.mock.calls[1];
      expect(apiUrl).toBe("https://common-sandbox.api.acubeapi.com/test");
    });

    it("returns parsed JSON when content-type includes json", async () => {
      const client = new AcubeClient(defaultConfig);
      const responseBody = { result: "ok" };

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "test-jwt-token" },
      });
      const apiResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(responseBody)),
        headers: {
          get: (key: string) =>
            key === "content-type"
              ? "application/json; charset=utf-8"
              : null,
        },
      } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse);

      // Use a non-json accept header but the response content-type is json
      const result = await client.get("/test", { accept: "text/plain" });

      expect(result.data).toEqual(responseBody);
    });
  });

  // ─── Convenience methods ─────────────────────────────────────────────
  describe("convenience methods", () => {
    it("get() calls request with GET method", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: { ok: true } }),
      );

      await client.get("/items");

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.method).toBe("GET");
    });

    it("post() calls request with POST method and body", async () => {
      const client = new AcubeClient(defaultConfig);
      const body = { name: "test" };

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 201, body: { id: "1" } }),
      );

      await client.post("/items", body);

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.method).toBe("POST");
      expect(apiOpts.body).toBe(JSON.stringify(body));
    });

    it("post() works without body", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.post("/trigger");

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.method).toBe("POST");
      expect(apiOpts.body).toBeUndefined();
    });

    it("put() calls request with PUT method and body", async () => {
      const client = new AcubeClient(defaultConfig);
      const body = { name: "updated" };

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: { id: "1" } }),
      );

      await client.put("/items/1", body);

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.method).toBe("PUT");
      expect(apiOpts.body).toBe(JSON.stringify(body));
    });

    it("delete() calls request with DELETE method", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 204, body: "" }),
      );

      await client.delete("/items/1");

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.method).toBe("DELETE");
    });

    it("get() passes options through to request", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: "<xml/>",
          headers: { "content-type": "application/xml" },
        }),
      );

      await client.get("/items/1/xml", {
        accept: "application/xml",
        headers: { "X-Custom": "value" },
      });

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers.Accept).toBe("application/xml");
      expect(apiOpts.headers["X-Custom"]).toBe("value");
    });

    it("post() passes extra options through to request", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 202, body: {} }),
      );

      await client.post("/items", { data: "value" }, { service: "common" });

      const [apiUrl] = fetchMock.mock.calls[1];
      expect(apiUrl).toBe("https://common-sandbox.api.acubeapi.com/items");
    });

    it("put() passes extra options through to request", async () => {
      const client = new AcubeClient(defaultConfig);

      setupFetchWithLogin(
        mockFetchResponse({ ok: true, status: 200, body: {} }),
      );

      await client.put(
        "/items/1",
        { data: "value" },
        { headers: { "X-Extra": "yes" } },
      );

      const [, apiOpts] = fetchMock.mock.calls[1];
      expect(apiOpts.headers["X-Extra"]).toBe("yes");
    });
  });

  // ─── Production environment ──────────────────────────────────────────
  describe("production environment", () => {
    it("uses production URLs for login and API calls", async () => {
      const client = new AcubeClient({
        ...defaultConfig,
        environment: "production",
      });

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "prod-token" },
      });
      const apiResponse = mockFetchResponse({
        ok: true,
        body: { items: [] },
      });

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse);

      await client.get("/invoices");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://common.api.acubeapi.com/login",
      );
      expect(fetchMock.mock.calls[1][0]).toBe(
        "https://api.acubeapi.com/invoices",
      );
    });

    it("uses production common URL when service is common", async () => {
      const client = new AcubeClient({
        ...defaultConfig,
        environment: "production",
      });

      const loginResponse = mockFetchResponse({
        ok: true,
        body: { token: "prod-token" },
      });
      const apiResponse = mockFetchResponse({
        ok: true,
        body: {},
      });

      fetchMock
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse);

      await client.get("/status", { service: "common" });

      expect(fetchMock.mock.calls[1][0]).toBe(
        "https://common.api.acubeapi.com/status",
      );
    });
  });
});
