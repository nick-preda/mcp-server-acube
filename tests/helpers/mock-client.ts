import { vi } from "vitest";
import type { AcubeClient } from "../../src/client.js";

export function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    post: vi.fn().mockResolvedValue({ status: 202, data: {} }),
    put: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    delete: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    request: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    getBaseUrl: vi.fn().mockReturnValue("https://api-sandbox.acubeapi.com"),
  } as unknown as AcubeClient;
}
