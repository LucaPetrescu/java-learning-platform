import type { Lab } from '../content/types'

export const exId = (labId: string, exerciseId: string) => `${labId}::ex::${exerciseId}`
export const secId = (labId: string, sectionId: string) => `${labId}::sec::${sectionId}`

export interface LabProgress {
  doneExercises: number
  totalExercises: number
  doneSections: number
  totalSections: number
  /** 0..1 across exercises + theory combined. */
  ratio: number
  complete: boolean
}

export function labProgress(
  lab: Lab,
  exercises: Record<string, boolean>,
  reading: Record<string, boolean>,
): LabProgress {
  const doneExercises = lab.exercises.filter((e) => exercises[exId(lab.id, e.id)]).length
  const doneSections = lab.theory.filter((s) => reading[secId(lab.id, s.id)]).length
  const totalExercises = lab.exercises.length
  const totalSections = lab.theory.length
  const total = totalExercises + totalSections
  const done = doneExercises + doneSections
  return {
    doneExercises,
    totalExercises,
    doneSections,
    totalSections,
    ratio: total === 0 ? 0 : done / total,
    complete: total > 0 && done === total,
  }
}
