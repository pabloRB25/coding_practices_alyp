import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SERVICE_NAME:              z.string().min(1).default('app'),
    LOG_LEVEL:                 z.enum(['debug','info','warn','error']).default('info'),
    LOG_PROVIDER:              z.enum(['local','axiom','http']).default('local'),
    LOG_PROVIDER_API_URL:      z.string().url().optional(),
    LOG_PROVIDER_TOKEN:        z.string().optional(),
    LOG_DATASET:               z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_EXPORTER_OTLP_HEADERS:  z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WEB_URL:           z.string().url().optional(),
    NEXT_PUBLIC_PROJECT_SLUG:      z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY,
    SERVICE_NAME:              process.env.SERVICE_NAME,
    LOG_LEVEL:                 process.env.LOG_LEVEL,
    LOG_PROVIDER:              process.env.LOG_PROVIDER,
    LOG_PROVIDER_API_URL:      process.env.LOG_PROVIDER_API_URL,
    LOG_PROVIDER_TOKEN:        process.env.LOG_PROVIDER_TOKEN,
    LOG_DATASET:               process.env.LOG_DATASET,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS:  process.env.OTEL_EXPORTER_OTLP_HEADERS,
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WEB_URL:           process.env.NEXT_PUBLIC_WEB_URL,
    NEXT_PUBLIC_PROJECT_SLUG:      process.env.NEXT_PUBLIC_PROJECT_SLUG,
  },
});
