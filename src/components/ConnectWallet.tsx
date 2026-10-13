import { useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shortAddress } from "@/lib/solana/format";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useWalletConnectPairingUri } from "@/hooks/useWalletConnectPairingUri";
import { setWalletConnectUri } from "@/lib/solana/walletconnect-uri";

export function ConnectWallet() {
  const [open, setOpen] = useState(false);
  const {
    connectors,
    connect,
    disconnect,
    connected,
    connecting,
    isReady,
    wallet,
    status,
  } = useWalletConnection();
  const wcUri = useWalletConnectPairingUri();

  if (!isReady) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </Button>
    );
  }

  if (connected && wallet) {
    const address = wallet.account.address;
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(address);
            toast.success("Address copied");
          }}
          className="font-mono"
          title={address}
        >
          <Wallet className="size-4" />
          {shortAddress(address)}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void disconnect()}
          title="Disconnect"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={connecting}
      >
        {connecting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <Wallet className="size-4" />
            Connect wallet
          </>
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setWalletConnectUri(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {wcUri ? "Scan with your wallet" : "Connect a wallet"}
            </DialogTitle>
            <DialogDescription>
              {wcUri
                ? "Open your WalletConnect-compatible wallet and scan this code."
                : "Pick a Wallet-Standard-compatible wallet detected in your browser."}
            </DialogDescription>
          </DialogHeader>
          {wcUri ? (
            <div className="flex flex-col items-center gap-4">
              {/* Stays white on the dark theme on purpose: QR codes need a
                  light quiet zone to be scannable. */}
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={wcUri} size={220} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(wcUri);
                  toast.success("Connection URI copied");
                }}
              >
                Copy connection URI
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setWalletConnectUri(null)}
              >
                Back to wallets
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {connectors.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No wallets detected. Install Phantom, Solflare or a similar wallet.
                </p>
              )}
              {connectors.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="justify-start gap-3"
                  onClick={async () => {
                    try {
                      await connect(c.id);
                      setOpen(false);
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed to connect wallet",
                      );
                    }
                  }}
                  disabled={status === "connecting"}
                >
                  {c.icon && (
                    <img
                      src={c.icon}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded"
                    />
                  )}
                  <span>{c.name}</span>
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
