import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TokenMetadataResult } from "@/hooks/useTokenMetadata";

/**
 * Folded read-only view of a vault's share-token metadata, shared by both apps.
 * Creating it is operator-only and lives in the backoffice
 * (src/backoffice/components/ShareTokenMetadataForm.tsx).
 */
export function ShareTokenMetadataView({ metadata }: { metadata: TokenMetadataResult }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 p-6 text-left"
        >
          <CardTitle className="flex items-center gap-2">
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
            Share token metadata
          </CardTitle>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Name</p>
            <p className="mt-0.5 text-sm font-medium">{metadata.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Symbol</p>
            <p className="mt-0.5 font-mono text-sm uppercase">{metadata.symbol || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Metadata URI</p>
            {metadata.uri ? (
              <a
                href={metadata.uri}
                target="_blank"
                rel="noopener noreferrer"
                title={metadata.uri}
                className="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-sm"
              >
                Open
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
