import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import type { Address } from "@solana/kit";
import { getCreateShareTokenMetadataInstructionAsync } from "@/lib/solana/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { vaultStateQueryKey } from "@/hooks/useVaultState";
import { tokenMetadataQueryKey } from "@/hooks/useTokenMetadata";

/**
 * Create form for a vault's share-token metadata, shown to the vault operator while
 * it is unset. Metadata is created once (`create_share_token_metadata`,
 * operator-signed) and the program has no update instruction, so once set it is
 * read-only (src/components/ShareTokenMetadataView.tsx).
 */
export function ShareTokenMetadataForm({
  vaultId,
  vaultState,
  shareMint,
}: {
  vaultId: bigint;
  vaultState: Address;
  shareMint: Address;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [uri, setUri] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" />
          Share token metadata
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Set the on-chain name/symbol/URI for this vault's share token. One-time setup.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!signer) return;
            try {
              const ix = await getCreateShareTokenMetadataInstructionAsync({
                payer: signer,
                operator: signer,
                vaultState,
                shareMint,
                name,
                symbol,
                uri,
              });
              await submit(ix, {
                pendingMessage: "Creating share token metadata…",
                successMessage: "Share token metadata set",
                invalidate: [vaultStateQueryKey(vaultId), tokenMetadataQueryKey(shareMint)],
              });
              setName("");
              setSymbol("");
              setUri("");
            } catch {
              // toast already shown
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="meta-name">Name</Label>
            <Input
              id="meta-name"
              value={name}
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
              disabled={isSending}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-symbol">Symbol</Label>
            <Input
              id="meta-symbol"
              value={symbol}
              maxLength={10}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={isSending}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-uri">Metadata URI</Label>
            <Input
              id="meta-uri"
              value={uri}
              maxLength={200}
              placeholder="https://example.com/metadata.json"
              onChange={(e) => setUri(e.target.value)}
              disabled={isSending}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSending || !name || !symbol || !uri}>
              {isSending && <Loader2 className="size-4 animate-spin" />}
              Set metadata
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
