import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Page not found.{" "}
          <Link to="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Back to vaults
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
