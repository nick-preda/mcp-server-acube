/**
 * @module client
 *
 * HTTP client for the A-Cube API with automatic JWT authentication.
 *
 * The client handles:
 * - Login via email/password and JWT token caching (24h lifetime, 23h refresh).
 * - Automatic token injection on every request.
 * - Content negotiation: JSON, XML, PDF (base64), HTML.
 * - Two base URLs per environment: `common` (authentication) and `govIt` (API operations).
 * - Error handling with clear messages including HTTP status codes.
 *
 * @see https://docs.acubeapi.com/
 */

/** A-Cube API environment: sandbox for testing, production for live SDI operations. */
export type AcubeEnvironment = "production" | "sandbox";

interface AcubeConfig {
  email: string;
  password: string;
  environment: AcubeEnvironment;
}

/**
 * Base URLs for each A-Cube environment.
 *
 * - `common`: Used for authentication (`POST /login`).
 * - `govIt`: Used for all API operations (invoices, notifications, etc.).
 */
const BASE_URLS = {
  production: {
    common: "https://common.api.acubeapi.com",
    govIt: "https://api.acubeapi.com",
  },
  sandbox: {
    common: "https://common-sandbox.api.acubeapi.com",
    govIt: "https://api-sandbox.acubeapi.com",
  },
} as const;

/**
 * A-Cube API client with automatic JWT authentication.
 *
 * Usage:
 * ```ts
 * const client = new AcubeClient({ email: "...", password: "...", environment: "sandbox" });
 * const invoices = await client.get("/invoices?page=1");
 * ```
 *
 * The client automatically handles login and token refresh. The JWT token is
 * cached for 23 hours (1h safety buffer before the actual 24h expiry).
 */
export class AcubeClient {
  private config: AcubeConfig;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: AcubeConfig) {
    this.config = config;
  }

  /** Returns the base URL for the given service in the configured environment. */
  getBaseUrl(service: "common" | "govIt"): string {
    return BASE_URLS[this.config.environment][service];
  }

  /**
   * Authenticate with A-Cube and cache the JWT token.
   *
   * The token has a 24h lifetime. We cache it for 23h to avoid edge-case
   * expiry during a request. As per A-Cube best practices, we minimize
   * login calls by reusing the cached token.
   */
  private async login(): Promise<string> {
    const url = `${this.getBaseUrl("common")}/login`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Acube login failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { token: string };
    this.token = data.token;
    this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
    return this.token;
  }

  /** Returns a valid token, refreshing it if expired. */
  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }
    return this.login();
  }

  /**
   * Make an authenticated API request.
   *
   * Handles:
   * - Automatic Bearer token injection.
   * - Content-Type negotiation based on body presence.
   * - Binary responses (PDF) returned as base64 strings.
   * - JSON parsing with fallback to raw text.
   * - HTTP 202 treated as success (used by A-Cube for invoice submission).
   *
   * @param method  - HTTP method (GET, POST, PUT, DELETE).
   * @param path    - API path (e.g., `/invoices`). Appended to the base URL.
   * @param options - Request options: service, body, headers, accept type.
   * @returns         Object with `status`, `data` (parsed), and optionally `raw` (for binary).
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      service?: "common" | "govIt";
      body?: unknown;
      headers?: Record<string, string>;
      accept?: string;
    } = {},
  ): Promise<{ status: number; data: T; raw?: ArrayBuffer }> {
    const {
      service = "govIt",
      body,
      headers: extraHeaders = {},
      accept = "application/json",
    } = options;
    const token = await this.getToken();
    const url = `${this.getBaseUrl(service)}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      ...extraHeaders,
    };

    if (body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body =
        typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Binary responses (PDF): return as base64
    if (
      accept === "application/pdf" ||
      accept === "application/octet-stream"
    ) {
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Acube API error (${response.status}): ${error}`);
      }
      const raw = await response.arrayBuffer();
      return {
        status: response.status,
        data: Buffer.from(raw).toString("base64") as unknown as T,
        raw,
      };
    }

    // Text responses (JSON, XML, HTML)
    const text = await response.text();

    // HTTP 202 is success for A-Cube (invoice submission)
    if (!response.ok && response.status !== 202) {
      throw new Error(`Acube API error (${response.status}): ${text}`);
    }

    if (
      accept === "application/json" ||
      response.headers.get("content-type")?.includes("json")
    ) {
      try {
        const data = JSON.parse(text) as T;
        return { status: response.status, data };
      } catch {
        return { status: response.status, data: text as unknown as T };
      }
    }

    return { status: response.status, data: text as unknown as T };
  }

  /** Shorthand for `request("GET", path, options)`. */
  async get<T = unknown>(
    path: string,
    options?: Parameters<typeof this.request>[2],
  ) {
    return this.request<T>("GET", path, options);
  }

  /** Shorthand for `request("POST", path, { body, ...options })`. */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<Parameters<typeof this.request>[2], "body">,
  ) {
    return this.request<T>("POST", path, { ...options, body });
  }

  /** Shorthand for `request("PUT", path, { body, ...options })`. */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<Parameters<typeof this.request>[2], "body">,
  ) {
    return this.request<T>("PUT", path, { ...options, body });
  }

  /** Shorthand for `request("DELETE", path, options)`. */
  async delete<T = unknown>(
    path: string,
    options?: Parameters<typeof this.request>[2],
  ) {
    return this.request<T>("DELETE", path, options);
  }
}
