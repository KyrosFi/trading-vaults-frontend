// BigInt is not JSON-serializable by default, and React 19.2's dev-only
// component-render logger calls JSON.stringify on component props on every
// commit. Solana values (vault ids, amounts, AUM) are bigints passed as props,
// so without this JSON.stringify throws ("Do not know how to serialize a
// BigInt"), the error escapes during commit, and React's render loop wedges.
//
// Teaching BigInt how to serialize fixes the whole class at the root. This is
// a no-op in production (the dev render logger isn't present there), and the
// string form is the sensible JSON representation for a bigint anyway.
//
// Import this first in the app entry, before React renders.
interface BigIntWithToJSON {
  toJSON?: () => string;
}

(BigInt.prototype as BigIntWithToJSON).toJSON = function (this: bigint): string {
  return this.toString();
};
