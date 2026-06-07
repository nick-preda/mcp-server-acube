import { describe, it, expect } from "vitest";
import { toolDescriptionPrefix, LIVE_WRITE_TOOLS } from "../src/badge.js";

describe("toolDescriptionPrefix", () => {
  it("marks read tools with the plain environment badge", () => {
    expect(toolDescriptionPrefix("list_invoices", "sandbox")).toBe("[SANDBOX] ");
    expect(toolDescriptionPrefix("list_invoices", "production")).toBe("[PRODUCTION] ");
  });

  it("marks live-write tools in production with the irreversible warning", () => {
    expect(toolDescriptionPrefix("send_invoice", "production")).toBe(
      "[PRODUCTION - LIVE WRITE, irreversible] ",
    );
    expect(toolDescriptionPrefix("send_simplified_invoice", "production")).toBe(
      "[PRODUCTION - LIVE WRITE, irreversible] ",
    );
  });

  it("does NOT escalate live-write tools in sandbox", () => {
    expect(toolDescriptionPrefix("send_invoice", "sandbox")).toBe("[SANDBOX] ");
  });

  it("keeps every known live-write tool in the set", () => {
    for (const name of ["send_invoice", "send_simplified_invoice", "send_receipt", "void_receipt", "return_receipt_items"]) {
      expect(LIVE_WRITE_TOOLS.has(name)).toBe(true);
    }
  });
});
