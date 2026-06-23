import type { Lab, Project } from '../content/types'

export const exId = (labId: string, exerciseId: string) => `${labId}::ex::${exerciseId}`
export const secId = (labId: string, sectionId: string) => `${labId}::sec::${sectionId}`
/** Stable id for a project milestone task (by milestone + task index). */
export const taskId = (projectId: string, milestoneIndex: number, taskIndex: number) =>
  `${projectId}::task::${milestoneIndex}.${taskIndex}`

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

export interface ProjectProgress {
  done: number
  total: number
  /** 0..1 over all milestone tasks. */
  ratio: number
  complete: boolean
}

/** Completeness of a project, measured over its milestone tasks. */
export function projectProgress(
  project: Project,
  tasks: Record<string, boolean>,
): ProjectProgress {
  let total = 0
  let done = 0
  project.milestones.forEach((m, mi) => {
    m.tasks.forEach((_, ti) => {
      total++
      if (tasks[taskId(project.id, mi, ti)]) done++
    })
  })
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    complete: total > 0 && done === total,
  }
}
