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
// sessions without any backend. We track completed exercises (the unit of
// real work) and which theory sections have been marked read.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'java-path:progress:v1'

interface ProgressState {
  /** exerciseGlobalId -> true */
  exercises: Record<string, boolean>
  /** theory section global id -> true */
  reading: Record<string, boolean>
}

interface ProgressContextValue {
  exercises: Record<string, boolean>
  reading: Record<string, boolean>
  isExerciseDone: (id: string) => boolean
  toggleExercise: (id: string) => void
  isSectionRead: (id: string) => boolean
  toggleSection: (id: string) => void
  reset: () => void
}

const empty: ProgressState = { exercises: {}, reading: {} }

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<ProgressState>
    return {
      exercises: parsed.exercises ?? {},
      reading: parsed.reading ?? {},
    }
  } catch {
    return empty
  }
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

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
    setState((s) => {
      const next = { ...s.exercises }
      if (next[id]) delete next[id]
      else next[id] = true
      return { ...s, exercises: next }
    })
  }, [])

  const toggleSection = useCallback((id: string) => {
    setState((s) => {
      const next = { ...s.reading }
      if (next[id]) delete next[id]
      else next[id] = true
      return { ...s, reading: next }
    })
  }, [])

  const reset = useCallback(() => setState(empty), [])

  const value = useMemo<ProgressContextValue>(
    () => ({
      exercises: state.exercises,
      reading: state.reading,
      isExerciseDone: (id) => Boolean(state.exercises[id]),
      toggleExercise,
      isSectionRead: (id) => Boolean(state.reading[id]),
      toggleSection,
      reset,
    }),
    [state, toggleExercise, toggleSection, reset],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider')
  return ctx
}
