import { useState } from "react";
import { cn } from "@/lib/utils";

/* Brand colours taken from the webapp's ThemeColor.CRYPTO_* palette
   (kyros/webapp — src/theme/palette.ts). SOL has no entry there, so it uses
   the official Solana purple. */
const PALETTE: { match: RegExp; bg: string; text: string }[] = [
  { match: /btc|bitcoin/i, bg: "bg-[#f7931a]", text: "text-white" },
  { match: /eth|ethereum/i, bg: "bg-[#627eea]", text: "text-white" },
  { match: /sol/i, bg: "bg-[#9945ff]", text: "text-white" },
  { match: /usdc/i, bg: "bg-[#2775ca]", text: "text-white" },
  { match: /usdt|tether/i, bg: "bg-[#009293]", text: "text-white" },
  { match: /usdg|gusd/i, bg: "bg-[#02c38d]", text: "text-white" },
];

type Props = {
  symbol: string | null | undefined;
  /** CoinGecko logo URL; when set, the image is shown instead of the initial. */
  logoUrl?: string | null;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function TokenGlyph({ symbol, logoUrl, fallback, size = "md", className }: Props) {
  const [imgError, setImgError] = useState(false);
  const label = (symbol || fallback || "?").trim();
  const sizeClasses =
    size === "lg"
      ? "size-12 text-base"
      : size === "sm"
        ? "size-6 text-[10px]"
        : "size-9 text-sm";

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={label}
        title={symbol ?? undefined}
        loading="lazy"
        onError={() => setImgError(true)}
        className={cn(
          "shrink-0 rounded-full bg-white object-contain p-0.5 shadow-sm ring-1 ring-white/10",
          sizeClasses,
          className,
        )}
      />
    );
  }

  const palette =
    PALETTE.find((p) => p.match.test(label)) ?? {
      bg: "bg-secondary",
      text: "text-foreground",
    };
  const initial = label[0]?.toUpperCase() ?? "?";

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold shadow-sm ring-1 ring-white/10",
        sizeClasses,
        palette.bg,
        palette.text,
        className,
      )}
      title={symbol ?? undefined}
    >
      {initial}
    </span>
  );
}
