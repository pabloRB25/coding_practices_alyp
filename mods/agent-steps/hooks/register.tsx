import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Alcance, Job, Plan, Step, Task, WfAgent, Workflow } from '../types'
import {
  barra,
  dentro,
  hace,
  HORA,
  jobDeEstado,
  jobsVisibles,
  metaDeWorkflow,
  pct,
  planDeEstado,
  planDeProgreso,
  planVigente,
} from './leer'

const PANE = 'agent-steps'
// Cambiá el tag cuando cambien los campos de un valor: descarta lo que una
// versión anterior guardó, que sobrevive a una recarga.
const steps = atom({ plugin: 'agent-steps', key: 'steps' } as const, [], { shape: 'steps-2' })
const tasks = atom({ plugin: 'agent-steps', key: 'tasks' } as const, [], { shape: 'tasks-1' })
const isPaneOn = atom({ plugin: 'agent-steps', key: 'isPaneOn' } as const, false)
const workflows = atom({ plugin: 'agent-steps', key: 'workflows' } as const, [], { shape: 'workflows-1' })
const plans = atom({ plugin: 'agent-steps', key: 'plans' } as const, [], { shape: 'plans-1' })
const jobs = atom({ plugin: 'agent-steps', key: 'jobs' } as const, [], { shape: 'jobs-1' })
const alcance = atom({ plugin: 'agent-steps', key: 'alcance' } as const, 'proyecto' as Alcance)

// El panel ocupa 1/FRACCION del ancho de la terminal (mínimo 24 columnas).
const FRACCION = 4
const REFRESCO_MS = 10_000

const labelOf = (e: Record<string, unknown>): string => {
  const raw = e.command ?? e.file_path ?? e.pattern ?? e.description ?? e.url ?? e.path ?? e.subject ?? ''
  return String(raw).replace(/\s+/g, ' ').slice(0, 70)
}

const corta = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** Una línea para la statusline: plan, tareas y pasos vivos. */
const textoEstado = async ($: EngineInterface): Promise<string | undefined> => {
  const partes: string[] = []
  const p = (await read($, plans))[0]
  if (p) partes.push(`▣ ${p.slug} ${pct(p.aceptadas, p.total)}%${p.isEstimado ? '~' : ''}`)
  const t = await read($, tasks)
  if (t.length > 0) partes.push(`☑ ${t.filter(x => x.status === 'completed').length}/${t.length}`)
  const vivos = (await read($, steps)).filter(s => !s.isDone && !s.isBackground).length
  if (vivos > 0) partes.push(`▶ ${vivos}`)
  return partes.length > 0 ? partes.join(' · ') : undefined
}

/** Relee planes (progreso.json / estado.md) y jobs del disco. Nunca lanza. */
const refrescar = async ($: EngineInterface): Promise<void> => {
  const ahora = await $.clock.now()
  let raiz = ''
  try {
    raiz = (await $.session.repo())?.root ?? ''
  } catch {
    raiz = ''
  }
  if (!raiz) {
    try {
      raiz = await $.session.root()
    } catch {
      raiz = ''
    }
  }
  let config = ''
  try {
    const propio = await $.env.get('CLAUDE_CONFIG_DIR')
    const home = await $.env.get('HOME')
    config = propio || (home ? `${home}/.claude` : '')
  } catch {
    config = ''
  }
  const scope = await read($, alcance)
  const delProyecto = (ruta: string): boolean => scope === 'todos' || (raiz !== '' && dentro(ruta, raiz))

  // Planes: los del repo de la sesión más los del índice global.
  const ledgers = new Set<string>()
  if (raiz) {
    try {
      for (const d of await $.fs.list(`${raiz}/.claude/run`)) if (d.kind === 'dir') ledgers.add(`${raiz}/.claude/run/${d.name}`)
    } catch {
      // sin ledger propio
    }
  }
  if (config) {
    try {
      for (const f of await $.fs.list(`${config}/run-index`)) {
        if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
        try {
          const p = JSON.parse(await $.fs.read(`${config}/run-index/${f.name}`)) as { ledger?: unknown }
          if (typeof p.ledger === 'string') ledgers.add(p.ledger)
        } catch {
          // puntero ilegible
        }
      }
    } catch {
      // sin índice
    }
  }
  const vistos: Plan[] = []
  for (const ledger of ledgers) {
    if (!delProyecto(ledger)) continue
    let plan: Plan | null = null
    try {
      plan = planDeProgreso(ledger, await $.fs.read(`${ledger}/progreso.json`))
    } catch {
      try {
        const st = await $.fs.stat(`${ledger}/estado.md`)
        plan = planDeEstado(ledger, await $.fs.read(`${ledger}/estado.md`), st.mtimeMs)
      } catch {
        plan = null // ledger borrado: el puntero queda y se ignora
      }
    }
    if (plan && planVigente(plan, ahora)) vistos.push(plan)
  }
  vistos.sort((a, b) => Number(a.isEstimado) - Number(b.isEstimado) || b.actualizado - a.actualizado)
  await update($, plans, () => vistos.slice(0, 4))

  // Jobs: todos los de ~/.claude/jobs, filtrados por proyecto salvo "/pasos todos".
  const lista: Job[] = []
  if (config) {
    let sesion = ''
    try {
      sesion = await $.session.id()
    } catch {
      sesion = ''
    }
    try {
      for (const d of await $.fs.list(`${config}/jobs`)) {
        if (d.kind !== 'dir') continue
        try {
          const j = jobDeEstado(d.name, await $.fs.read(`${config}/jobs/${d.name}/state.json`), sesion)
          if (j && delProyecto(j.cwd)) lista.push(j)
        } catch {
          // job sin state.json
        }
      }
    } catch {
      // sin carpeta de jobs
    }
  }
  await update($, jobs, () => jobsVisibles(lista, ahora))

  // Workflows sin actividad en la última hora: fuera.
  await update($, workflows, ws => ws.filter(w => ahora - w.lastAt < HORA))
  $.ui.status(await textoEstado($))
}

const abrirPanel = async ($: EngineInterface, columns = 26): Promise<void> => {
  const opened = await $.ui.open({ id: PANE, title: 'Pasos', columns, rows: 10 })
  await update($, isPaneOn, () => opened.isPlaced)
}

const unirWorkflow = (list: Workflow[], runId: string, now: number, cambio: (w: Workflow) => Workflow): Workflow[] => {
  const w = list.find(x => x.runId === runId)
  const nuevo = cambio(w ?? { runId, name: '', phases: [], startedAt: now, lastAt: now, agents: [] })
  return w ? list.map(x => (x.runId === runId ? nuevo : x)) : [...list, nuevo]
}

export const register: Register = on => {
  let startedAt = 0
  let lastCols = 0
  let seq = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pasos',
      description: 'Panel de pasos y avance. "/pasos todos" o "/pasos proyecto" elige qué planes y jobs se ven',
    })
    try {
      const guardado = await $.store.get('alcance')
      if (guardado === 'todos' || guardado === 'proyecto') await update($, alcance, () => guardado)
    } catch {
      // sin store: queda "proyecto"
    }
    await abrirPanel($)
    await refrescar($)
    $.clock.every(REFRESCO_MS, () => void refrescar($))

    return next(e)
  })

  on('command.run', { command: 'pasos' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'todos' || arg === 'proyecto') {
      await update($, alcance, () => arg)
      try {
        await $.store.set('alcance', arg)
      } catch {
        // sin store: vale para esta sesión
      }
      await refrescar($)
      return {
        text:
          arg === 'todos'
            ? 'Mostrando planes y jobs de todos los proyectos (ojo al compartir pantalla).'
            : 'Mostrando solo planes y jobs de este proyecto.',
      }
    }
    await abrirPanel($)

    return { text: 'Panel de pasos abierto.' }
  })

  on('prompt.submit', async ($, e, next) => {
    startedAt = await $.clock.now()
    // El panel muestra el trabajo actual: fuera lo terminado de turnos anteriores.
    // Lo que sigue corriendo (y el segundo plano de las últimas 2 h) se queda.
    await update($, steps, list =>
      list.filter(s => (s.isBackground ? startedAt - s.startedAt < 2 * HORA : !s.isDone)),
    )

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const id = (r as { agentId?: string }).agentId
    const wf = e.workflow
    if (id && wf && wf.runId) {
      const now = await $.clock.now()
      const agente: WfAgent = {
        id,
        index: wf.agentIndex,
        label: corta(e.description || e.name || `agente ${wf.agentIndex}`, 40),
        status: 'running',
      }
      await update($, workflows, list =>
        unirWorkflow(list, wf.runId, now, w => ({ ...w, lastAt: now, agents: [...w.agents.filter(a => a.id !== id), agente] })),
      )
    }

    return r
  })

  on('tool.call', async ($, e, next) => {
    const now0 = await $.clock.now()
    const step: Step = {
      id: e.tool_use_id || `local-${now0}-${seq++}`,
      agentId: e.agentId,
      tool: e.tool,
      label: labelOf(e as unknown as Record<string, unknown>),
      isDone: false,
      startedAt: now0,
    }
    await update($, steps, list => [...list, step].slice(-300))

    const cerrar = async (fields: Partial<Step>): Promise<void> => {
      const now = await $.clock.now()
      await update($, steps, list =>
        list.map(one =>
          one.id === step.id ? { ...one, isDone: true, seconds: Math.round((now - one.startedAt) / 1000), ...fields } : one,
        ),
      )
    }

    let ran: Awaited<ReturnType<typeof next>>
    try {
      ran = await next(e)
    } catch (err) {
      // Interrumpida o con error del motor: que no quede "en curso" para siempre.
      await cerrar({ isFailed: true })
      throw err
    }

    const out = ran as { deny?: string; isError?: boolean; result?: Record<string, unknown> }
    const input = e as unknown as Record<string, unknown>
    if (e.tool === 'Bash' && typeof out.result?.backgroundTaskId === 'string') {
      await cerrar({ isDone: false, isBackground: true })
    } else {
      await cerrar({ isFailed: Boolean(out.deny) || out.isError === true })
    }

    if (e.tool === 'TaskCreate') {
      const made = (out.result?.task as { id?: string } | undefined)?.id
      await update($, tasks, prev => {
        const list = prev.length > 0 && prev.every(t => t.status === 'completed') ? [] : prev
        const nueva: Task = {
          id: made ?? String(list.length + 1),
          subject: String(input.subject ?? ''),
          active: String(input.activeForm ?? ''),
          status: 'pending',
        }
        return [...list, nueva]
      })
    } else if (e.tool === 'TaskUpdate') {
      const id = String(input.taskId ?? '')
      const status = input.status as Task['status'] | 'deleted' | undefined
      await update($, tasks, list =>
        status === 'deleted'
          ? list.filter(t => t.id !== id)
          : list.map(t =>
              t.id === id
                ? {
                    ...t,
                    status: status ?? t.status,
                    subject: input.subject ? String(input.subject) : t.subject,
                    active: input.activeForm ? String(input.activeForm) : t.active,
                  }
                : t,
            ),
      )
    } else if (e.tool === 'TaskList') {
      const all = out.result?.tasks as { id: string; subject: string; status: Task['status'] }[] | undefined
      if (Array.isArray(all)) {
        await update($, tasks, prev =>
          all.map(t => ({
            id: String(t.id),
            subject: t.subject,
            active: prev.find(p => p.id === String(t.id))?.active ?? '',
            status: t.status,
          })),
        )
      }
    } else if (e.tool === 'TodoWrite') {
      const todos = (input.todos ?? []) as { content: string; status: Task['status']; activeForm: string }[]
      await update($, tasks, () =>
        todos.map((t, i) => ({ id: String(i + 1), subject: t.content, active: t.activeForm, status: t.status })),
      )
    } else if (e.tool === 'Workflow' && out.result) {
      const runId = typeof out.result.runId === 'string' ? out.result.runId : ''
      if (runId) {
        let script = typeof input.script === 'string' ? input.script : ''
        const ruta = typeof out.result.scriptPath === 'string' ? out.result.scriptPath : ''
        if (!script && ruta) {
          try {
            script = await $.fs.read(ruta)
          } catch {
            script = ''
          }
        }
        const meta = metaDeWorkflow(script)
        const name = meta.name || String(out.result.workflowName ?? input.name ?? 'workflow')
        const now = await $.clock.now()
        await update($, workflows, list => unirWorkflow(list, runId, now, w => ({ ...w, name, phases: meta.phases, lastAt: now })))
      }
    }

    $.ui.status(await textoEstado($))
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    const fallo = e.isAborted || e.reason !== 'answer'
    if (e.agentId) {
      const id = e.agentId
      const estado: WfAgent['status'] = fallo ? 'failed' : 'done'
      await update($, workflows, list =>
        list.map(w =>
          w.agents.some(a => a.id === id)
            ? { ...w, lastAt: now, agents: w.agents.map(a => (a.id === id ? { ...a, status: estado } : a)) }
            : w,
        ),
      )
      // Lo que el agente dejó abierto al terminar ya no corre.
      await update($, steps, list =>
        list.map(s => (s.agentId === id && !s.isDone && !s.isBackground ? { ...s, isDone: true, isFailed: true } : s)),
      )
    } else {
      if (e.isAborted) {
        await update($, steps, list =>
          list.map(s => (s.agentId === undefined && !s.isDone && !s.isBackground ? { ...s, isDone: true, isFailed: true } : s)),
        )
      }
      const seconds = Math.round((now - startedAt) / 1000)
      if (startedAt > 0 && seconds > 60) {
        const total = (await read($, steps)).filter(s => s.startedAt >= startedAt).length
        $.ui.toast(`Turno terminado: ${seconds}s, ${total} pasos`)
      }
    }
    $.ui.status(await textoEstado($))

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, steps)
    const plan = await read($, tasks)
    const runs = await read($, workflows)
    const corridas = await read($, plans)
    const trabajos = await read($, jobs)
    const scope = await read($, alcance)
    const agents = await $.agent.list()
    const ahora = await $.clock.now()
    const width = Math.max(8, Math.min(24, (e.props.bodyColumns ?? 28) - 12))

    const wfDe = (id?: string): WfAgent | undefined => {
      for (const w of runs) {
        const a = w.agents.find(x => x.id === id)
        if (a) return a
      }
      return undefined
    }
    const nameOf = (id?: string): string => {
      if (id === undefined) return 'Principal'
      const a = agents.find(x => x.id === id)
      if (a) return `${a.type} · ${a.description}`
      const w = wfDe(id)
      return w ? `wf · ${w.label}` : `agente ${id.slice(0, 6)}`
    }
    const stateOf = (id?: string): string => {
      if (id === undefined) return ''
      const a = agents.find(x => x.id === id)
      if (a) return a.status
      const w = wfDe(id)
      if (!w) return ''
      return w.status === 'running' ? 'running' : w.status === 'done' ? 'completed' : 'failed'
    }

    const order: (string | undefined)[] = [undefined, ...agents.map(a => a.id)]
    for (const s of list) if (!order.includes(s.agentId)) order.push(s.agentId)
    const groups = order.map(id => ({ id, items: list.filter(s => s.agentId === id) })).filter(g => g.items.length > 0)
    const fijas =
      corridas.length * 3 + (plan.length > 0 ? 2 : 0) + runs.length * 2 + (trabajos.length > 0 ? trabajos.length + 1 : 0) + 2
    const room = Math.max(4, (e.viewport?.rows ?? 24) - fijas)
    const per = Math.max(2, Math.floor(room / Math.max(1, groups.length)) - 1)
    const running = list.filter(s => !s.isDone && !s.isBackground).length
    const enFondo = list.filter(s => s.isBackground).length
    const done = list.filter(s => s.isDone).length
    const doneTasks = plan.filter(t => t.status === 'completed').length
    const current = plan.find(t => t.status === 'in_progress')
    const [tLlenas, tVacias] = barra(doneTasks, plan.length, width)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color="claude">◆ Pasos </Text>
          <Text color="warning">{running} en curso</Text>
          <Text color="subtle"> · </Text>
          <Text color="success">{done} hechos</Text>
          {enFondo > 0 && <Text color="subtle"> · {enFondo} en 2º plano</Text>}
        </Box>

        {corridas.map(p => {
          const [llenas, vacias] = barra(p.aceptadas, p.total, width)
          const extra = [p.ola ? `ola ${p.ola}` : '', p.enCurso ? `${p.enCurso} en curso` : '', p.bloqueadas ? `${p.bloqueadas} bloq.` : '']
            .filter(Boolean)
            .join(' · ')
          const linea = [extra, p.tarea ? `▸ ${p.tarea}` : ''].filter(Boolean).join(' · ')
          return (
            <Box flexDirection="column" key={p.ledger}>
              <Box>
                <Text bold color="suggestion" wrap="truncate-end">
                  ▣ {p.slug}{' '}
                </Text>
                <Text color="subtle">
                  {p.isEstimado ? 'estimado · ' : ''}
                  {hace(p.actualizado, ahora)}
                </Text>
              </Box>
              <Box>
                <Text color="success">{llenas}</Text>
                <Text color="subtle">{vacias}</Text>
                <Text bold color={p.aceptadas >= p.total ? 'success' : 'warning'}>
                  {' '}
                  {pct(p.aceptadas, p.total)}%
                </Text>
                <Text color="subtle">
                  {' '}
                  {p.aceptadas}/{p.total}
                </Text>
              </Box>
              {linea !== '' && (
                <Text color="subtle" wrap="truncate-end">
                  {linea}
                </Text>
              )}
            </Box>
          )
        })}

        {plan.length > 0 && (
          <Box flexDirection="column">
            <Box>
              <Text color="subtle">☑ </Text>
              <Text color="success">{tLlenas}</Text>
              <Text color="subtle">{tVacias}</Text>
              <Text bold color={doneTasks === plan.length ? 'success' : 'warning'}>
                {' '}
                {pct(doneTasks, plan.length)}%
              </Text>
              <Text color="subtle">
                {' '}
                {doneTasks}/{plan.length}
              </Text>
            </Box>
            {current && (
              <Text color="warning" wrap="truncate-end">
                ▸ {current.active || current.subject}
              </Text>
            )}
          </Box>
        )}

        {runs.map(w => {
          const term = w.agents.filter(a => a.status !== 'running').length
          const fallidos = w.agents.filter(a => a.status === 'failed').length
          return (
            <Box flexDirection="column" key={w.runId}>
              <Box>
                <Text bold color="suggestion" wrap="truncate-end">
                  ⚙ {w.name || 'workflow'}{' '}
                </Text>
                <Text color={term === w.agents.length && w.agents.length > 0 ? 'success' : 'warning'}>
                  {term}/{w.agents.length} agentes
                </Text>
                {fallidos > 0 && <Text color="error"> · {fallidos} fallidos</Text>}
              </Box>
              {w.phases.length > 0 && (
                <Text color="subtle" wrap="truncate-end">
                  fases: {w.phases.join(' · ')}
                </Text>
              )}
            </Box>
          )
        })}

        {groups.length === 0 && <Text color="subtle">Sin pasos en este turno.</Text>}
        {groups.map(g => {
          const live = g.items.some(s => !s.isDone)
          return (
            <Box flexDirection="column" key={g.id ?? 'main'}>
              <Box>
                <Text color={live ? 'warning' : 'subtle'}>{live ? '● ' : '○ '}</Text>
                <Text bold color={g.id === undefined ? 'claude' : 'suggestion'} wrap="truncate-end">
                  {nameOf(g.id)}
                </Text>
                {stateOf(g.id) !== '' && <Text color="subtle"> {stateOf(g.id)}</Text>}
              </Box>
              {g.items.slice(-per).map(s => (
                <Box key={s.id}>
                  <Text color={s.isBackground ? 'suggestion' : s.isFailed ? 'error' : s.isDone ? 'success' : 'warning'}>
                    {s.isBackground ? ' ⧗ ' : s.isFailed ? ' ✗ ' : s.isDone ? ' ✓ ' : ' ▶ '}
                  </Text>
                  <Text bold={!s.isDone} dimColor={s.isDone && !s.isBackground} wrap="truncate-end">
                    {s.tool}{' '}
                  </Text>
                  <Text color="subtle" wrap="truncate-end">
                    {s.label}
                  </Text>
                  {s.isBackground ? (
                    <Text color="subtle"> {hace(s.startedAt, ahora)}</Text>
                  ) : s.seconds ? (
                    <Text color="subtle"> {s.seconds}s</Text>
                  ) : null}
                </Box>
              ))}
            </Box>
          )
        })}

        {trabajos.length > 0 && (
          <Box flexDirection="column">
            <Text bold color="claude">
              ◇ Jobs {scope === 'todos' ? '(todos)' : '(proyecto)'}
            </Text>
            {trabajos.map(j => (
              <Box key={j.id}>
                <Text color={j.state === 'working' ? 'warning' : j.state === 'blocked' ? 'suggestion' : 'error'}>
                  {j.state === 'working' ? ' ● ' : j.state === 'blocked' ? ' ◐ ' : ' ✗ '}
                </Text>
                <Text bold={j.isMine} wrap="truncate-end">
                  {corta(j.name, 28)}{' '}
                </Text>
                <Text color="subtle" wrap="truncate-end">
                  {j.state === 'blocked' ? 'espera input' : j.state === 'working' ? 'trabajando' : 'falló'} ·{' '}
                  {hace(j.updatedAt, ahora)}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const cols = e.viewport?.columns ?? 0
    if (cols > 0 && cols !== lastCols) {
      lastCols = cols
      if (await read($, isPaneOn)) void abrirPanel($, Math.max(24, Math.round(cols / FRACCION)))
    }
    if (e.props.hasSurvey || (await read($, isPaneOn))) return next(e)
    const running = (await read($, steps)).filter(s => !s.isDone && !s.isBackground)
    const cur = running[running.length - 1]
    const corrida = (await read($, plans))[0]
    if (!cur && !corrida) return next(e)
    const plan = await read($, tasks)
    const tareasPct = plan.length ? pct(plan.filter(t => t.status === 'completed').length, plan.length) : -1
    const agents = await $.agent.list()
    const { Box, Text } = $.ui.resolve(e)
    const who = cur?.agentId ? (agents.find(a => a.id === cur.agentId)?.type ?? 'agente') : 'principal'

    return (
      <Box>
        {corrida && (
          <Text color="suggestion">
            ▣ {corrida.slug} {pct(corrida.aceptadas, corrida.total)}%{corrida.isEstimado ? '~' : ''}
            {cur ? ' · ' : ''}
          </Text>
        )}
        {cur && tareasPct >= 0 && <Text bold color="success">{tareasPct}% </Text>}
        {cur && <Text color="warning">▶ </Text>}
        {cur && <Text color="suggestion">[{who}] </Text>}
        {cur && <Text bold>{cur.tool} </Text>}
        {cur && (
          <Text color="subtle" wrap="truncate-end">
            {cur.label}
          </Text>
        )}
        {running.length > 1 ? <Text color="subtle"> +{running.length - 1} en paralelo</Text> : null}
      </Box>
    )
  })
}
