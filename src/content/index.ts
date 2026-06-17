import type { Lab } from './types'
import { lab01 } from './lab01'
import { lab02 } from './lab02'
import { lab03 } from './lab03'
import { lab04 } from './lab04'
import { lab05 } from './lab05'
import { lab06 } from './lab06'
import { lab07 } from './lab07'
import { lab08 } from './lab08'
import { lab09 } from './lab09'
import { lab10 } from './lab10'
import { lab11 } from './lab11'
import { lab12 } from './lab12'
import { lab13 } from './lab13'
import { lab14 } from './lab14'
import { lab15 } from './lab15'
import { lab16 } from './lab16'
import { lab17 } from './lab17'

// All labs, in order. Labs 1–12 are the core-Java track; 13–17 are Spring Boot.
export const labs: Lab[] = [
  lab01,
  lab02,
  lab03,
  lab04,
  lab05,
  lab06,
  lab07,
  lab08,
  lab09,
  lab10,
  lab11,
  lab12,
  lab13,
  lab14,
  lab15,
  lab16,
  lab17,
]

export const labById = (id: string): Lab | undefined => labs.find((l) => l.id === id)

/** A lab's track, defaulting to 'java' when not set. */
export const trackOf = (lab: Lab): 'java' | 'spring' => lab.track ?? 'java'

export const javaLabs = labs.filter((l) => trackOf(l) === 'java')
export const springLabs = labs.filter((l) => trackOf(l) === 'spring')

export { projects, projectById } from './projects'
export { studyPlan } from './studyPlan'
export type { Lab, Project } from './types'
