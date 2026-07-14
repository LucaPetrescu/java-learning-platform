import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../utils/supabase/supabase'
import { useAuth } from './AuthContext'

// ---------------------------------------------------------------------------
// Progress is persisted to Supabase (per-user `progress` row) when signed in,
// and falls back to localStorage for guests browsing without an account.
// We track:
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

function loadLocal(): ProgressState {
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

function saveLocal(state: ProgressState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full / disabled — non-fatal
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
  const { user } = useAuth()
  const [state, setState] = useState<ProgressState>(empty)
  const hydrated = useRef(false)

  // Hydrate: from Supabase when signed in, from localStorage as a guest.
  useEffect(() => {
    hydrated.current = false

    if (!user) {
      setState(loadLocal())
      hydrated.current = true
      return
    }

    let cancelled = false

    async function hydrate() {
      const { data } = await supabase
        .from('progress')
        .select('exercises, reading, tasks')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (cancelled) return

      if (data) {
        setState({
          exercises: data.exercises ?? {},
          reading: data.reading ?? {},
          tasks: data.tasks ?? {},
        })
      } else {
        // First sign-in: migrate whatever was saved locally as a guest.
        const local = loadLocal()
        await supabase.from('progress').insert({ user_id: user!.id, ...local })
        setState(local)
      }
      hydrated.current = true
    }

    hydrate()
    return () => {
      cancelled = true
    }
  }, [user])

  // Persist: upsert to Supabase, or localStorage as a guest.
  useEffect(() => {
    if (!hydrated.current) return

    if (!user) {
      saveLocal(state)
      return
    }

    supabase.from('progress').upsert({ user_id: user.id, ...state })
  }, [state, user])

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
