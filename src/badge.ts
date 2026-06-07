/**
 * @module badge
 *
 * Environment-awareness helpers.
 *
 * Every tool description is prefixed with the active environment so an AI agent
 * always knows whether it is operating against the sandbox or live SDI before
 * acting. Live-write tools in production get an explicit, stronger warning
 * because their effects are real and irreversible.
 */
import type { AcubeEnvironment } from "./client.js";

/**
 * Tools whose production execution has a real, irreversible effect on SDI / the
 * Agenzia delle Entrate (a sent document can only be undone with a credit note,
 * a voided receipt cannot be un-voided, etc.). These get a stronger badge.
 */
export const LIVE_WRITE_TOOLS = new Set<string>([
  "send_invoice",
  "send_simplified_invoice",
  "send_receipt",
  "void_receipt",
  "return_receipt_items",
]);

/**
 * Returns the prefix to prepend to a tool's description for the given
 * environment.
 *
 * @example
 * toolDescriptionPrefix("list_invoices", "sandbox")  // "[SANDBOX] "
 * toolDescriptionPrefix("list_invoices", "production")  // "[PRODUCTION] "
 * toolDescriptionPrefix("send_invoice", "production")   // "[PRODUCTION - LIVE WRITE, irreversible] "
 */
export function toolDescriptionPrefix(
  name: string,
  environment: AcubeEnvironment,
): string {
  if (environment === "production" && LIVE_WRITE_TOOLS.has(name)) {
    return "[PRODUCTION - LIVE WRITE, irreversible] ";
  }
  return environment === "production" ? "[PRODUCTION] " : "[SANDBOX] ";
}
