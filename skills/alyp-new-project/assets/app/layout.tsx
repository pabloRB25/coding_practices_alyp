import type { Metadata } from "next";
import { Toaster } from "@$PACKAGE_SCOPE/ui";
import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = { title: "$CLIENT_NAME" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
