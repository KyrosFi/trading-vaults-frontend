import { NavLink, Link } from "react-router-dom";
import { Vault } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ClusterToggle } from "@/components/ClusterToggle";
import { IS_DEVNET } from "@/lib/cluster";

const NAV_LINKS = [
  { label: "Vaults", to: "/" },
  { label: "Closed", to: "/closed" },
];

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="relative border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 pt-6 pb-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-kairos ring-1 ring-border">
            <Vault className="size-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <h1 className="text-2xl font-semibold tracking-tight text-kairos">
              Kyros Vaults
            </h1>
            {subtitle && (
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <ClusterToggle />
          <ConnectWallet />
        </div>
      </div>
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 pb-3">
        {NAV_LINKS.map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            end
            className="nav-link text-sm font-medium"
          >
            {label}
          </NavLink>
        ))}
      </div>
      {IS_DEVNET && (
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-warning"
          aria-hidden
        />
      )}
    </header>
  );
}
