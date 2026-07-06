# FASE 2 — Repositorio GitHub

```bash
gh repo create alyp-studio/$PROJECT_SLUG \
  --private \
  --description "$CLIENT_NAME — Plataforma SaaS" \
  --clone \
  --gitignore Node

cd $BASE_DIR/$PROJECT_SLUG

# Ramas
git checkout -b develop && git push origin develop
git checkout -b staging  && git push origin staging
git checkout develop
```

Crear `.github/CODEOWNERS`:

```
# Revisión requerida en todo cambio
* @pablopr @alyp-studio

# Archivos críticos — solo @pablopr
supabase/migrations/    @pablopr
.github/workflows/      @pablopr
vercel.json             @pablopr
turbo.json              @pablopr
```

**Gate de salida**: repo creado, 3 ramas en origin, CODEOWNERS commiteado.
