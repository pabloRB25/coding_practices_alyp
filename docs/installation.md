# Instalación de Skills en Claude Code

Los skills son archivos `.md` que Claude Code carga al invocarlos con `/nombre-del-skill`. Se instalan copiando el archivo a `~/.claude/commands/`.

---

## Instalación

### Opción A: Manual (recomendado para control total)

```bash
# Clonar este repo
git clone https://github.com/alyp-studio/coding_practices_alyp.git
cd coding_practices_alyp

# Copiar todos los skills a Claude Code
cp skills/alyp-new-project.md ~/.claude/commands/
cp skills/alyp-observability.md ~/.claude/commands/
cp skills/alyp-agentic-standards.md ~/.claude/commands/
cp skills/agentic-logging.md ~/.claude/commands/

echo "✓ Skills instalados"
```

### Opción B: Script de instalación

```bash
# Desde la raíz del repo:
for skill in skills/*.md; do
  cp "$skill" ~/.claude/commands/
  echo "✓ Instalado: $(basename $skill)"
done
```

### Verificar instalación

En Claude Code, los skills aparecen en la lista de comandos disponibles. Para confirmar:

```bash
ls ~/.claude/commands/
# Debe mostrar:
# agentic-logging.md
# alyp-agentic-standards.md
# alyp-new-project.md
# alyp-observability.md
```

---

## Uso de cada skill

### Crear proyecto nuevo
```
/alyp-new-project
```
El skill hace preguntas sobre el proyecto (nombre, cliente, arquitectura) y ejecuta las 16 fases en orden.

### Agregar estándares agentic-ready a proyecto existente
```
/alyp-agentic-standards
```
Seleccionar modo `audit` para integrar sin romper lo que hay.

### Instalar observabilidad completa
```
/alyp-observability
```
Reemplaza los stubs de logger con la implementación completa y configura el transporte.

### Instalar logging GPS en cualquier proyecto Node/TS
```
/agentic-logging
```
No requiere el stack Alyp — funciona en cualquier proyecto Node/TypeScript.

---

## Actualizar skills

Cuando este repo tenga una nueva versión:

```bash
cd coding_practices_alyp
git pull

# Re-instalar skills actualizados
cp skills/*.md ~/.claude/commands/
```

Para actualizar proyectos existentes al nuevo estándar:
```bash
# En el directorio del proyecto:
/alyp-agentic-standards
# → seleccionar modo: audit
```

---

## Estructura del directorio de Claude Code

```
~/.claude/
├── commands/          ← aquí van los skills (.md)
│   ├── alyp-new-project.md
│   ├── alyp-observability.md
│   ├── alyp-agentic-standards.md
│   └── agentic-logging.md
├── projects/
│   └── -Users-parb/
│       └── memory/   ← memoria persistente del agente
└── settings.json      ← configuración de Claude Code
```

---

## Prerequisitos del sistema

Antes de ejecutar `/alyp-new-project`, verificar:

| Herramienta | Versión mínima | Para qué |
|-------------|----------------|---------|
| `node` | >= 22 | Runtime de Next.js |
| `pnpm` | >= 9 | Package manager |
| `gh` CLI | cualquiera | Crear repos, secrets, branch protection |
| `vercel` CLI | cualquiera | Crear proyectos, linkear GitHub |
| `supabase` CLI | cualquiera | Crear proyectos, migraciones, gen tipos |
| `git` | cualquiera | Control de versiones |

Verificar autenticación:
```bash
gh auth status        # debe mostrar cuenta activa
vercel whoami         # debe mostrar tu cuenta de Vercel
supabase --version    # solo verifica que está instalado
```
