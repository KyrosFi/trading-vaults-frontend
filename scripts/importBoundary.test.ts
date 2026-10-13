import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("backoffice import boundary", () => {
  it.each([["@/backoffice/components/AdminActions"], ["../backoffice/components/AdminActions"]])(
    "forbids shared/public code from importing %s",
    async (spec) => {
      const messages = await lint(
        "src/routes/Example.tsx",
        `import { AdminActions } from "${spec}";\nexport const x = AdminActions;\n`,
      );
      expect(messages).toHaveLength(1);
    },
  );

  it("allows backoffice code to import backoffice modules", async () => {
    const messages = await lint(
      "src/backoffice/routes/Example.tsx",
      `import { AdminActions } from "@/backoffice/components/AdminActions";\nexport const x = AdminActions;\n`,
    );
    expect(messages).toHaveLength(0);
  });
});
