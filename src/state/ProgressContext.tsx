import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Progress is persisted to localStorage so the user keeps their place across
// sessions without any backend. We track:
//   - completed exercises (the unit of lab work)
//   - which theory sections have been marked read
//   - completed project milestone tasks (the unit of capstone work)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'java-path:progress:v1'

interface ProgressState {
  /** exercise global id -> true */
  exercises: Record<string, boolean>
  /** theory section global id -> true */
  reading: Record<string, boolean>
  /** project task global id -> true */
  tasks: Record<string, boolean>
}

interface ProgressContextValue {
  exercises: Record<string, boolean>
  reading: Record<string, boolean>
  tasks: Record<string, boolean>
  isExerciseDone: (id: string) => boolean
  toggleExercise: (id: string) => void
  isSectionRead: (id: string) => boolean
  toggleSection: (id: string) => void
  isTaskDone: (id: string) => boolean
  toggleTask: (id: string) => void
  reset: () => void
}

const empty: ProgressState = { exercises: {}, reading: {}, tasks: {} }

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    return {
      exercises: parsed.exercises ?? {},
      reading: parsed.reading ?? {},
      tasks: parsed.tasks ?? {},
    }
  } catch {
    return empty
  }
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

/** Toggle a boolean key in a record, removing it when turning off. */
function toggled(map: Record<string, boolean>, id: string): Record<string, boolean> {
  const next = { ...map }
  if (next[id]) delete next[id]
  else next[id] = true
  return next
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full / disabled — non-fatal
    }
  }, [state])

  const toggleExercise = useCallback((id: string) => {
    setState((s) => ({ ...s, exercises: toggled(s.exercises, id) }))
  }, [])

  const toggleSection = useCallback((id: string) => {
    setState((s) => ({ ...s, reading: toggled(s.reading, id) }))
  }, [])

  const toggleTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: toggled(s.tasks, id) }))
  }, [])

  const reset = useCallback(() => setState(empty), [])

  const value = useMemo<ProgressContextValue>(
    () => ({
      exercises: state.exercises,
      reading: state.reading,
      tasks: state.tasks,
      isExerciseDone: (id) => Boolean(state.exercises[id]),
      toggleExercise,
      isSectionRead: (id) => Boolean(state.reading[id]),
      toggleSection,
      isTaskDone: (id) => Boolean(state.tasks[id]),
      toggleTask,
      reset,
    }),
    [state, toggleExercise, toggleSection, toggleTask, reset],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider')
  return ctx
}
