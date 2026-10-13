import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
          <AlertTriangle className="size-10 text-destructive" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="size-4" />
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
