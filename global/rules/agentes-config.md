---
paths:
  - "**/.claude/agents/**"
  - "**/serena_config.yml"
  - "**/.serena/**"
  - "**/agents/*.md"
  - "**/.mcp.json"
  - "**/.claude/settings*.json"
---
# Agentes y Serena

- Ningún agente declarado solo-lectura recibe Serena: su superficie MCP conserva escritura simbólica (`rename_symbol`, `safe_delete_symbol`, `replace_symbol_body`, `insert_*_symbol`) que no pasa por `permissions` (`permissions.deny` gobierna la tool Read, no las tools MCP).
- `excluded_tools` en `serena_config.yml` ya saca las cuatro que duplicaban una tool gobernada (`execute_shell_command`, `create_text_file`, `replace_content`, `replace_in_files`); las simbólicas se conservan a propósito, son la razón de tener Serena.
- La garantía es estructural, no configuracional: el `explorador` usa `typescript-lsp` (read-only por diseño), no Serena.
- `~/.serena/serena_config.yml` lo gestiona la máquina: Serena lo reescribe al activar un proyecto, borra los comentarios y poda de `projects:` toda ruta sin `.serena/project.yml`.
- No documentes razones en ese archivo (se pierden) ni agregues proyectos a mano: un repo se registra solo la primera vez que se lo activa por ruta.
<!-- Verificado 2026-08-31: de 19 rutas escritas a mano, Serena descartaba 14 con un warning por arranque. -->
