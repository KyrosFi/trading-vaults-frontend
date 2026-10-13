import { describe, expect, it } from "vitest";
import { checkPublicModules } from "./publicBundleGuard";

const ROOT = "/repo";
const OPTS = { root: ROOT, allowedInstructions: ["deposit", "redeem"] } as const;
const ix = (name: string, exports: string[]) => ({
  id: `${ROOT}/src/lib/solana/generated/instructions/${name}.ts`,
  renderedExports: exports,
});
const depositorBuilders = [
  ix("deposit", ["getDepositInstructionAsync"]),
  ix("redeem", ["getRedeemInstructionAsync"]),
];

describe("checkPublicModules", () => {
  it("passes when only the depositor instruction builders are bundled", () => {
    expect(checkPublicModules(depositorBuilders, OPTS)).toEqual([]);
  });

  it("reports an operator instruction builder", () => {
    const problems = checkPublicModules(
      [...depositorBuilders, ix("operatorWithdraw", ["getOperatorWithdrawInstructionAsync"])],
      OPTS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("operator_withdraw");
  });

  it("ignores instruction modules that are bundled only for decoding or constants", () => {
    const problems = checkPublicModules(
      [
        ...depositorBuilders,
        ix("pause", ["PAUSE_DISCRIMINATOR", "parsePauseInstruction"]),
        {
          id: `${ROOT}/src/lib/solana/generated/programs/kyrosVault.ts`,
          renderedExports: ["identifyKyrosVaultInstruction"],
        },
      ],
      OPTS,
    );
    expect(problems).toEqual([]);
  });

  it("reports any backoffice module in the public bundle", () => {
    const problems = checkPublicModules(
      [
        ...depositorBuilders,
        { id: `${ROOT}/src/backoffice/hooks/useStratWrites.ts?v=1`, renderedExports: [] },
      ],
      OPTS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("src/backoffice/hooks/useStratWrites.ts");
  });

  it("reports an allowed builder it cannot find, so the check can't go blind", () => {
    const problems = checkPublicModules([depositorBuilders[0]], OPTS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("redeem");
  });
});
