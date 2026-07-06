// instrumentation.ts
// OpenTelemetry — agnóstico de backend.
// El destino se configura via OTEL_EXPORTER_OTLP_ENDPOINT (env var).
// Backends compatibles: Grafana Tempo, Honeycomb, Datadog, Jaeger self-hosted,
// New Relic, Dynatrace — sin cambiar código, solo credenciales.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOTel } = await import('@vercel/otel');
    registerOTel({
      serviceName: process.env.SERVICE_NAME ?? process.env.NEXT_PUBLIC_PROJECT_SLUG ?? 'app',
    });
  }
}
