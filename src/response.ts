/**
 * @module response
 *
 * Response formatting utilities for the A-Cube MCP server.
 *
 * Every tool response passes through these utilities to minimize LLM token
 * consumption. Three optimizations are applied:
 *
 * 1. **Field selection** (`pickFields`) -- Return only the requested fields,
 *    with dot-notation support for nested paths (e.g., `"sender.business_name"`).
 *
 * 2. **Null stripping** (`stripEmpty`) -- Recursively remove `null`, `undefined`,
 *    and empty objects. A typical A-Cube invoice has ~60 null fields across
 *    sender and recipient objects; stripping them reduces token count by ~50%.
 *
 * 3. **Compact JSON** -- Serialize without indentation. The LLM reads compact
 *    JSON just as well, and whitespace tokens add up quickly on large responses.
 */

/**
 * Recursively pick only the specified fields from an object or array of objects.
 *
 * Supports dot-notation for nested paths. When multiple sub-fields of the same
 * parent are requested, they are merged into a single object.
 *
 * @example
 * ```ts
 * pickFields(invoice, ["uuid", "sender.business_name", "sender.business_vat_number_code"])
 * // => { uuid: "...", sender: { business_name: "...", business_vat_number_code: "..." } }
 * ```
 *
 * When applied to an array, each element is filtered individually.
 */
export function pickFields(
  data: unknown,
  fields: string[],
): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => pickFields(item, fields));
  }

  if (typeof data !== "object") return data;

  const record = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const dotIndex = field.indexOf(".");
    if (dotIndex === -1) {
      if (field in record) {
        result[field] = record[field];
      }
    } else {
      const topKey = field.slice(0, dotIndex);
      const rest = field.slice(dotIndex + 1);
      if (topKey in record) {
        const existing = result[topKey];
        if (existing && typeof existing === "object" && !Array.isArray(existing)) {
          const merged = pickFields(record[topKey], [rest]) as Record<string, unknown>;
          Object.assign(existing, merged);
        } else {
          result[topKey] = pickFields(record[topKey], [rest]);
        }
      }
    }
  }

  return result;
}

/**
 * Recursively strip `null`, `undefined`, and empty objects from data.
 *
 * - Null/undefined values are removed (the key is omitted from the parent).
 * - Objects that become empty after stripping are also removed.
 * - Arrays are preserved (elements are stripped individually; null elements
 *   become `undefined` in the array, which `JSON.stringify` converts to `null`).
 * - Primitive values (strings, numbers, booleans) are passed through unchanged.
 *
 * @returns The stripped data, or `undefined` if the entire input was null/empty.
 */
export function stripEmpty(data: unknown): unknown {
  if (data === null || data === undefined) return undefined;

  if (Array.isArray(data)) {
    return data.map(stripEmpty);
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const stripped = stripEmpty(value);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  return data;
}

/**
 * Format data for an MCP tool response.
 *
 * Processing order: **pick fields → strip nulls → compact JSON**.
 *
 * The order matters: if we stripped first, `pickFields` could create empty
 * nested objects (e.g., `{ sender: {} }`) that would not be cleaned up.
 * By picking first and stripping second, any empty objects left by field
 * selection are properly removed.
 *
 * @param data   - The raw API response data.
 * @param fields - Optional list of fields to select (dot-notation supported).
 *                 If omitted or empty, all fields are returned (nulls still stripped).
 * @returns       MCP-compatible content response with compact JSON text.
 */
export function formatResponse(
  data: unknown,
  fields?: string[],
): { content: [{ type: "text"; text: string }] } {
  let processed = data;
  if (fields && fields.length > 0) {
    processed = pickFields(processed, fields);
  }
  processed = stripEmpty(processed) ?? null;
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(processed) },
    ],
  };
}

/**
 * Format an error for an MCP tool response.
 *
 * Extracts the error message from `Error` instances or converts to string.
 * Sets `isError: true` so the MCP client can distinguish errors from results.
 */
export function errorResponse(
  error: unknown,
): { isError: true; content: [{ type: "text"; text: string }] } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}
