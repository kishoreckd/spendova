import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RouteError() {
  useRouteError();
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">This page could not be loaded</h1>
      <Button onClick={() => window.location.reload()}>Try again</Button>
      <Button variant="outline" onClick={() => window.location.assign("/")}>
        Go to overview
      </Button>
    </main>
  );
}
