# Política de Seguridad

## Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en este proyecto, reportala de forma
responsable. **No abras un issue público de GitHub para vulnerabilidades.**

### Cómo reportar

1. **Email**: enviá un reporte detallado a **$SECURITY_EMAIL**.
2. **GitHub Security Advisories**: alternativamente, usá
   [GitHub Security Advisories](../../security/advisories/new) para reportar en privado.

### Qué incluir

- Descripción de la vulnerabilidad
- Pasos para reproducir
- Impacto potencial
- Fix sugerido (si lo tenés)

### SLA de respuesta

| Etapa | SLA |
|:---|:---|
| Acuse de recibo del reporte | < 48 horas |
| Evaluación inicial y clasificación de severidad | < 7 días |
| Fix para severidad Crítica/Alta | < 30 días |
| Fix para severidad Media/Baja | < 90 días |

## Alcance

Esta política aplica **solo** al código de este repositorio. No cubre:

- Infraestructura interna de $CLIENT_NAME ni de Alyp Studio
- Servicios de terceros que la plataforma integra (Supabase, Vercel, proveedores
  de pago/OTel) — reportá esos a sus respectivos mantenedores
- Dependencias de terceros — reportá esas a sus mantenedores

Están **en alcance**: bypass de RLS o de autorización, fuga de secretos/credenciales,
escalada de privilegios entre tenants, inyección (SQL/command), exposición de PII,
y validación faltante en trust boundaries (server actions, route handlers, middleware).

## Buenas prácticas para contribuidores

- Nunca commitees secretos, API keys, tokens ni credenciales (lo bloquea
  `secret-scan.yml`)
- Nunca commitees PII ni datos de clientes
- Tratá `.env.local` como configuración local; nunca commitees un `.env` poblado
- Mantené las dependencias al día (Dependabot está configurado en
  `.github/dependabot.yml`)

## Divulgación

Seguimos divulgación coordinada. Te pedimos:

- Darnos tiempo razonable para arreglar antes de divulgar públicamente
- No explotar la vulnerabilidad más allá de lo necesario para demostrarla
- No acceder ni modificar datos que no te pertenezcan
