# Opción A: Via Vercel Marketplace (recomendado)
# Dashboard → Integrations → buscar proveedor (Axiom, Datadog, Logtail, etc.)
# Conectar el proyecto y configurar el drain automáticamente

# Opción B: Via API (para cualquier endpoint HTTP)
curl -X POST "https://api.vercel.com/v1/integrations/log-drains" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-drain-endpoint.com/logs",
    "sources": ["build", "edge", "external", "static"],
    "deliveryFormat": "json",
    "projectIds": ["prj_xxx"]
  }'
