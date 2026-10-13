import { Copy, ExternalLink } from "lucide-react";
import type { Address } from "@solana/kit";
import { toast } from "sonner";
import { shortAddress, solscanAddressUrl } from "@/lib/solana/format";
import { cn } from "@/lib/utils";

type Props = {
  address: Address | string | undefined;
  className?: string;
  showShort?: boolean;
};

export function AddressDisplay({ address, className, showShort = true }: Props) {
  if (!address) {
    return <span className={cn("font-mono text-sm text-muted-foreground", className)}>—</span>;
  }
  const display = showShort ? shortAddress(address) : address.toString();
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-sm", className)}>
      <span title={address.toString()}>{display}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(address.toString());
          toast.success("Address copied");
        }}
        className="text-muted-foreground hover:text-foreground"
        title="Copy"
      >
        <Copy className="size-3.5" />
      </button>
      <a
        href={solscanAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        title="Open in Solscan"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="size-3.5" />
      </a>
    </span>
  );
}
