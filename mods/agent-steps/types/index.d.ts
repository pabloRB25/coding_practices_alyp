/** Una llamada a herramienta, del loop principal o de un subagente. */
export type Step = {
  id: string
  agentId?: string
  tool: string
  label: string
  isDone: boolean
  /** Bash lanzado en segundo plano: sigue corriendo aunque la llamada volvió. */
  isBackground?: boolean
  /** Rechazada, con error o cortada por una interrupción. */
  isFailed?: boolean
  startedAt: number
  seconds?: number
}

/** Una tarea de TaskCreate/TodoWrite de esta sesión. */
export type Task = {
  id: string
  subject: string
  active: string
  status: 'pending' | 'in_progress' | 'completed'
}

/** Un agente de una corrida de Workflow. */
export type WfAgent = {
  id: string
  index: number
  label: string
  status: 'running' | 'done' | 'failed'
}

/** Una corrida de Workflow lanzada en esta sesión. */
export type Workflow = {
  runId: string
  name: string
  phases: string[]
  startedAt: number
  lastAt: number
  agents: WfAgent[]
}

/** Una corrida de alyp-exec (progreso.json, o estado.md si falta). */
export type Plan = {
  ledger: string
  slug: string
  titulo: string
  repo: string
  total: number
  aceptadas: number
  enCurso: number
  bloqueadas: number
  ola: string
  tarea: string
  /** Milisegundos desde la época de la última escritura. */
  actualizado: number
  /** Sin progreso.json: contado desde estado.md, aproximado. */
  isEstimado: boolean
}

/** Un job de Claude Code (~/.claude/jobs/<id>/state.json). */
export type Job = {
  id: string
  name: string
  state: string
  detail: string
  cwd: string
  updatedAt: number
  isMine: boolean
}

/** Qué planes y jobs se muestran: los del proyecto de la sesión o todos. */
export type Alcance = 'proyecto' | 'todos'

declare module 'claude-code' {
  interface PluginState {
    'agent-steps': {
      steps: Shaped<Step[]>
      tasks: Shaped<Task[]>
      isPaneOn: boolean
      workflows: Shaped<Workflow[]>
      plans: Shaped<Plan[]>
      jobs: Shaped<Job[]>
      alcance: Alcance
      /** Ledgers que esta sesión trabaja (rutas absolutas): los únicos planes en modo proyecto. */
      vinculados: Shaped<string[]>
    }
  }
}
