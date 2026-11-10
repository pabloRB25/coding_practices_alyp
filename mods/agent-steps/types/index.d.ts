export type Step = {
  id: string
  agentId?: string
  tool: string
  label: string
  isDone: boolean
  startedAt: number
  seconds?: number
}

export type Task = {
  id: string
  subject: string
  active: string
  status: 'pending' | 'in_progress' | 'completed'
}

declare module 'claude-code' {
  interface PluginState {
    'agent-steps': { steps: Shaped<Step[]>; tasks: Shaped<Task[]>; isPaneOn: boolean }
  }
}
