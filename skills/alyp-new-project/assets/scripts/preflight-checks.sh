# Versiones mínimas
gh --version        # GitHub CLI — debe estar autenticado
vercel --version    # Vercel CLI — debe estar autenticado
pnpm --version      # >= 9
node --version      # >= 22
supabase --version  # Supabase CLI

# Scopes del token de GitHub (necesita repo + admin:org para branch protection y secrets)
gh auth status

# Identidad Vercel
vercel whoami

# Identidad git
git config --global user.name   # pablopr
git config --global user.email  # pr@pablorodriguezb.com
