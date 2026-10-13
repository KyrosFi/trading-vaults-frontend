import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Page chrome shared by the public app and the operator backoffice. */
export function AppShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <AppHeader subtitle={subtitle} />
      <main className="flex-1">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <AppFooter />
    </div>
  );
}
