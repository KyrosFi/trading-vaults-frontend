import { useParams } from "react-router-dom";
import { useVaultState } from "@/hooks/useVaultState";
import { useMintInfo } from "@/hooks/useMintInfo";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { useStratData } from "@/hooks/useStratData";
import { useVaultRole } from "@/hooks/useVaultRole";
import { useIsDepositor } from "@/hooks/useIsDepositor";

/** Everything both vault pages (public and backoffice) read for /vault/:id. */
export function useVaultDetail() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam && /^\d+$/.test(idParam) ? BigInt(idParam) : null;

  const { data: state, isLoading, isError } = useVaultState(id);
  const { data: depositMint } = useMintInfo(state?.depositMint);
  const { data: shareMint } = useMintInfo(state?.shareMint);
  const { data: depositMeta } = useTokenMetadata(state?.depositMint);
  const { data: shareMeta } = useTokenMetadata(state?.shareMint);
  const { data: strat, isError: stratFailed } = useStratData(state?.vaultStateAddress);
  const { role, walletAddress } = useVaultRole(state?.admin, state?.operator);
  // isLoading, not isPending: without a wallet the query is disabled, and a disabled query
  // stays pending forever without ever loading.
  const { data: walletIsDepositor, isLoading: isDepositorLoading } = useIsDepositor(walletAddress);
  const isDepositor = !!walletAddress && walletIsDepositor === true;

  return {
    id,
    state,
    isLoading,
    isError,
    depositMint,
    shareMint,
    depositMeta,
    shareMeta,
    strat,
    stratFailed,
    role,
    walletAddress,
    isDepositor,
    isDepositorLoading,
  };
}

export type VaultDetail = ReturnType<typeof useVaultDetail>;
