import { describe, expect, it } from "vitest";
import { resolveApp } from "./app";

describe("resolveApp", () => {
  it("defaults to the public app", () => expect(resolveApp(undefined)).toBe("public"));
  it("treats an empty value as unset", () => expect(resolveApp("")).toBe("public"));
  it("selects the public app explicitly", () => expect(resolveApp("public")).toBe("public"));
  it("selects the backoffice", () => expect(resolveApp("backoffice")).toBe("backoffice"));
  it("rejects anything else", () => expect(() => resolveApp("admin")).toThrow(/KYROS_APP/));
});
