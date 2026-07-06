# FASE 3.6 — App Shell & Resilience

> Nota de migración: en el documento original esta fase también está numerada "FASE 3.6" (duplicada con Data Layer & Tenancy). Se conserva la numeración original.

Crear en `apps/app/src/app/`:

`error.tsx`: código completo en [`../assets/app/error.tsx`](../assets/app/error.tsx).

`global-error.tsx` — idéntico a `error.tsx` pero para el layout raíz.

`not-found.tsx`:
```typescript
import Link from "next/link";
import { Button } from "@$PACKAGE_SCOPE/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">Página no encontrada</h2>
      <Button asChild><Link href="/dashboard">Volver al inicio</Link></Button>
    </div>
  );
}
```

`loading.tsx`:
```typescript
import { Skeleton } from "@$PACKAGE_SCOPE/ui";

export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
```

Health endpoint `apps/app/src/app/api/health/route.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ status: "error", error: String(err) }, { status: 503 });
  }
}
```
