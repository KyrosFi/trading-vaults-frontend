import "@/lib/bigint-json";
import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SolanaProvider } from "@solana/react-hooks";
import { installPolyfills } from "@solana/connector";
import { Toaster } from "@/components/ui/sonner";
import { createAppClient } from "@/lib/solana/client";
import { registerWalletConnect } from "@/lib/solana/walletconnect";
import { env } from "@/env";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Shared startup for both apps — the public one (src/main.tsx) and the operator
 * backoffice (src/backoffice/main.tsx). Each entry passes its own root component,
 * so neither bundle pulls in the other's routes.
 */
export function bootstrap(App: ComponentType) {
  void start(App).catch((err) => {
    console.error("[bootstrap] fatal error", err);
    document.body.textContent = "Failed to load. Please refresh.";
  });
}

async function start(App: ComponentType) {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element #root not found");

  // Buffer/global shims that @walletconnect/universal-provider needs in the browser.
  installPolyfills();
  // Best-effort: registerWalletConnect never throws, so a WC failure can't block render.
  await registerWalletConnect(env.VITE_WALLETCONNECT_PROJECT_ID);
  const solanaClient = createAppClient();

  createRoot(rootElement).render(
    <StrictMode>
      <SolanaProvider client={solanaClient}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster richColors closeButton position="bottom-right" />
          </BrowserRouter>
        </QueryClientProvider>
      </SolanaProvider>
    </StrictMode>,
  );
}
