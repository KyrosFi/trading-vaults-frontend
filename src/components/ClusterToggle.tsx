import { CURRENT_CLUSTER, setCluster, type Cluster } from "@/lib/cluster";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Cluster; label: string }[] = [
  { value: "mainnet", label: "Mainnet" },
  { value: "devnet", label: "Devnet" },
];

export function ClusterToggle() {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-secondary p-0.5 text-xs font-medium">
      {OPTIONS.map((opt) => {
        const active = opt.value === CURRENT_CLUSTER;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCluster(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              active
                ? opt.value === "devnet"
                  ? "bg-warning text-warning-foreground"
                  : "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
