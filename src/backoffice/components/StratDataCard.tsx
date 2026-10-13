import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2, Wallet, FileText } from "lucide-react";
import type { Address } from "@solana/kit";
import { useWalletSession } from "@solana/react-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useStratData } from "@/hooks/useStratData";
import { useClearStratData, useSaveStratData } from "@/backoffice/hooks/useStratWrites";
import { EMPTY_STRAT, stratIsEmpty, type StratData, type StratStatus } from "@/lib/strat";

type Props = {
  vaultState: Address;
  /** Whether the connected wallet may edit (the vault's on-chain operator). */
  canEdit: boolean;
};

const STATUS_OPTIONS: { value: StratStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "settled", label: "Settled" },
];

export function StratDataCard({ vaultState, canEdit }: Props) {
  const { data, isLoading, isError, error } = useStratData(vaultState);
  const save = useSaveStratData(vaultState);
  const clear = useClearStratData(vaultState);
  const session = useWalletSession();
  const canWrite = canEdit;
  const [editing, setEditing] = useState(false);
  // Ledger/hardware wallets can't sign the auth message directly — they sign a
  // transaction instead. The user opts in here so we pick the right signing path.
  const [ledger, setLedger] = useState(false);

  useEffect(() => {
    if (canWrite && data && stratIsEmpty(data)) setEditing(true);
  }, [canWrite, data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Strategy data
          </CardTitle>
          {data?.updatedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last updated {new Date(data.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        {!editing && data && !stratIsEmpty(data) && canWrite && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={save.isPending || clear.isPending}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Clear all strategy data for this vault?")) {
                  clear.mutate({ ledger });
                }
              }}
              disabled={save.isPending || clear.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {canWrite && (
          <label className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={ledger}
              onChange={(e) => setLedger(e.target.checked)}
              disabled={save.isPending || clear.isPending}
              className="size-3.5"
            />
            Using a Ledger? (signs via a transaction instead of a message)
          </label>
        )}
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            Failed to load strategy data:{" "}
            {error instanceof Error ? error.message : "unknown error"}
          </p>
        )}
        {!isLoading && !isError && data && (
          editing && canWrite ? (
            <EditForm
              initial={data}
              onCancel={() => {
                if (!stratIsEmpty(data)) setEditing(false);
              }}
              canCancel={!stratIsEmpty(data)}
              onSave={(d) =>
                save.mutate(
                  { data: d, ledger },
                  {
                    onSuccess: () => setEditing(false),
                  },
                )
              }
              isSaving={save.isPending}
            />
          ) : !canWrite ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Wallet className="size-3.5" />
              {session
                ? "Only the vault operator can edit strategy data."
                : "Connect the vault operator wallet to edit strategy data."}
            </div>
          ) : stratIsEmpty(data) ? null : (
            <p className="text-xs text-muted-foreground">
              Strategy data is visible above. Click <span className="font-medium">Edit</span> to
              update.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

type FormState = Omit<StratData, "updatedAt">;

const toNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const toStr = (s: string): string | null => {
  const t = s.trim();
  return t || null;
};
const numStr = (n: number | null) => (n === null ? "" : n.toString());
const txtStr = (s: string | null) => s ?? "";

function EditForm({
  initial,
  onSave,
  onCancel,
  canCancel,
  isSaving,
}: {
  initial: StratData;
  onSave: (d: FormState) => void;
  onCancel: () => void;
  canCancel: boolean;
  isSaving: boolean;
}) {
  // text state mirrors form inputs; numbers stored as strings
  const [name, setName] = useState(txtStr(initial.name));
  const [status, setStatus] = useState<StratStatus | "">(initial.status ?? "");
  const [description, setDescription] = useState(txtStr(initial.description));
  const [maxSize, setMaxSize] = useState(numStr(initial.maxSize));

  const [direction, setDirection] = useState(txtStr(initial.direction));
  const [entryLevel, setEntryLevel] = useState(txtStr(initial.entryLevel));
  const [thesis, setThesis] = useState(txtStr(initial.thesis));

  const [marketEntry, setMarketEntry] = useState(txtStr(initial.marketEntry));
  const [marketEntryNote, setMarketEntryNote] = useState(txtStr(initial.marketEntryNote));
  const [stopLossNote, setStopLossNote] = useState(txtStr(initial.stopLossNote));
  const [maxDuration, setMaxDuration] = useState(txtStr(initial.maxDuration));
  const [maxDurationNote, setMaxDurationNote] = useState(txtStr(initial.maxDurationNote));

  const [tp1, setTp1] = useState(numStr(initial.tp1));
  const [tp1Allocation, setTp1Allocation] = useState(numStr(initial.tp1Allocation));
  const [tp1Multiplier, setTp1Multiplier] = useState(numStr(initial.tp1Multiplier));
  const [tp2, setTp2] = useState(numStr(initial.tp2));
  const [tp2Allocation, setTp2Allocation] = useState(numStr(initial.tp2Allocation));
  const [tp2Multiplier, setTp2Multiplier] = useState(numStr(initial.tp2Multiplier));
  const [tp3, setTp3] = useState(numStr(initial.tp3));
  const [tp3Allocation, setTp3Allocation] = useState(numStr(initial.tp3Allocation));
  const [tp3Multiplier, setTp3Multiplier] = useState(numStr(initial.tp3Multiplier));

  const [sl, setSl] = useState(numStr(initial.sl));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...EMPTY_STRAT,
      name: toStr(name),
      status: status || null,
      description: toStr(description),
      maxSize: toNum(maxSize),
      direction: toStr(direction),
      entryLevel: toStr(entryLevel),
      thesis: toStr(thesis),
      marketEntry: toStr(marketEntry),
      marketEntryNote: toStr(marketEntryNote),
      stopLossNote: toStr(stopLossNote),
      maxDuration: toStr(maxDuration),
      maxDurationNote: toStr(maxDurationNote),
      tp1: toNum(tp1),
      tp1Allocation: toNum(tp1Allocation),
      tp1Multiplier: toNum(tp1Multiplier),
      tp2: toNum(tp2),
      tp2Allocation: toNum(tp2Allocation),
      tp2Multiplier: toNum(tp2Multiplier),
      tp3: toNum(tp3),
      tp3Allocation: toNum(tp3Allocation),
      tp3Multiplier: toNum(tp3Multiplier),
      sl: toNum(sl),
    });
  };

  return (
    <form className="grid gap-6" onSubmit={submit}>
      <Section title="Identity">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Strategy name" wide>
            <Input
              value={name}
              maxLength={120}
              placeholder="e.g. BTC Bullish Breakout $75,000"
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
            />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StratStatus | "")}
              disabled={isSaving}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Maximum size (deposit token)">
            <Input
              inputMode="decimal"
              placeholder="100000"
              value={maxSize}
              onChange={(e) => setMaxSize(e.target.value)}
              disabled={isSaving}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={description}
            maxLength={1000}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving}
            placeholder="What this strategy does, in plain language."
            className="min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="Strategy overview">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Direction">
            <Input
              value={direction}
              maxLength={60}
              placeholder="Long BTC"
              onChange={(e) => setDirection(e.target.value)}
              disabled={isSaving}
            />
          </Field>
          <Field label="Entry level">
            <Input
              maxLength={60}
              placeholder="75000 or 0.042-0.044"
              value={entryLevel}
              onChange={(e) => setEntryLevel(e.target.value)}
              disabled={isSaving}
            />
          </Field>
          <Field label="Thesis">
            <Input
              value={thesis}
              maxLength={60}
              placeholder="Bullish breakout"
              onChange={(e) => setThesis(e.target.value)}
              disabled={isSaving}
            />
          </Field>
        </div>
      </Section>

      <Section title="Trading conditions">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Market entry">
            <Input
              value={marketEntry}
              maxLength={60}
              placeholder="At Market"
              onChange={(e) => setMarketEntry(e.target.value)}
              disabled={isSaving}
            />
            <Input
              value={marketEntryNote}
              maxLength={240}
              placeholder="Sub-note (optional)"
              onChange={(e) => setMarketEntryNote(e.target.value)}
              disabled={isSaving}
              className="mt-2"
            />
          </Field>
          <Field label="Stop loss note">
            <Input
              value={stopLossNote}
              maxLength={240}
              placeholder="Strategy closes if stop loss is hit"
              onChange={(e) => setStopLossNote(e.target.value)}
              disabled={isSaving}
            />
          </Field>
          <Field label="Maximum duration">
            <Input
              value={maxDuration}
              maxLength={60}
              placeholder="30 days"
              onChange={(e) => setMaxDuration(e.target.value)}
              disabled={isSaving}
            />
            <Input
              value={maxDurationNote}
              maxLength={240}
              placeholder="Auto-close at expiry"
              onChange={(e) => setMaxDurationNote(e.target.value)}
              disabled={isSaving}
              className="mt-2"
            />
          </Field>
        </div>
      </Section>

      <Section title="Take profit & stop loss">
        <TpRow
          label="TP1"
          price={tp1}
          alloc={tp1Allocation}
          mult={tp1Multiplier}
          onPrice={setTp1}
          onAlloc={setTp1Allocation}
          onMult={setTp1Multiplier}
          disabled={isSaving}
        />
        <TpRow
          label="TP2"
          price={tp2}
          alloc={tp2Allocation}
          mult={tp2Multiplier}
          onPrice={setTp2}
          onAlloc={setTp2Allocation}
          onMult={setTp2Multiplier}
          disabled={isSaving}
        />
        <TpRow
          label="TP3"
          price={tp3}
          alloc={tp3Allocation}
          mult={tp3Multiplier}
          onPrice={setTp3}
          onAlloc={setTp3Allocation}
          onMult={setTp3Multiplier}
          disabled={isSaving}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Stop loss price">
            <Input
              inputMode="decimal"
              placeholder="72000"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              disabled={isSaving}
            />
          </Field>
        </div>
      </Section>

      <Separator />
      <div className="flex items-center justify-end gap-2">
        {canCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function TpRow({
  label,
  price,
  alloc,
  mult,
  onPrice,
  onAlloc,
  onMult,
  disabled,
}: {
  label: string;
  price: string;
  alloc: string;
  mult: string;
  onPrice: (v: string) => void;
  onAlloc: (v: string) => void;
  onMult: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[4rem_repeat(3,1fr)] sm:items-end">
      <span className="text-sm font-medium">{label}</span>
      <Field label="Price">
        <Input
          inputMode="decimal"
          placeholder="0.00"
          value={price}
          onChange={(e) => onPrice(e.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field label="Take profit %">
        <Input
          inputMode="decimal"
          placeholder="50"
          value={alloc}
          onChange={(e) => onAlloc(e.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field label="Captured payout (x)">
        <Input
          inputMode="decimal"
          placeholder="1.7"
          value={mult}
          onChange={(e) => onMult(e.target.value)}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}
