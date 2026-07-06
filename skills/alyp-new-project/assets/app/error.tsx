"use client";
import { useEffect } from "react";
import { Button } from "@$PACKAGE_SCOPE/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // TODO: reportar a sistema de observabilidad cuando alyp-observability esté listo
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Algo salió mal</h2>
      <Button onClick={reset} variant="outline">Reintentar</Button>
    </div>
  );
}
