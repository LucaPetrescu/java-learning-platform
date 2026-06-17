// Core content model for the Java learning platform.
// Every lab is a self-contained module of theory + exercises authored against
// these types. Markdown is allowed in any field documented as such; fenced
// ```java code blocks render with syntax highlighting.

export type Difficulty = 'warmup' | 'core' | 'challenge'

export interface TheorySection {
  /** Stable slug, unique within the lab (used for anchors). */
  id: string
  heading: string
  /** Markdown body. Use fenced ```java blocks for code. */
  body: string
}

export interface Exercise {
  /** Stable slug, unique within the lab. Used as the progress key. */
  id: string
  title: string
  difficulty: Difficulty
  /** Markdown prompt describing the task and requirements. */
  prompt: string
  /** Java starter code shown in the editor as a scaffold. */
  starter: string
  /** Progressive hints, revealed one at a time. */
  hints: string[]
  /** Reference solution (Java source). */
  solution: string
  /** Markdown explanation of how/why the solution works. */
  explanation: string
}

/** Which curriculum track a lab belongs to. Defaults to 'java' when omitted. */
export type Track = 'java' | 'spring'

export interface Lab {
  /** e.g. "lab-01" */
  id: string
  number: number
  /** Curriculum track. Omitted == 'java'. */
  track?: Track
  title: string
  subtitle: string
  /** Markdown overview shown at the top of the lab. */
  overview: string
  /** Rough time budget in hours for theory + exercises. */
  estimatedHours: number
  /** Short concept tags shown as badges. */
  concepts: string[]
  theory: TheorySection[]
  exercises: Exercise[]
  /** Key takeaways, each a short markdown string. */
  takeaways: string[]
}

// ---------------------------------------------------------------------------
// Capstone projects — larger builds the learner implements themselves. Unlike
// labs, these are project briefs (goals, requirements, milestones, acceptance
// criteria) rather than theory + graded exercises.
// ---------------------------------------------------------------------------

export type ProjectDifficulty = 'core' | 'challenge' | 'capstone'

export interface ProjectMilestone {
  title: string
  /** Concrete tasks for this milestone (markdown allowed inline). */
  tasks: string[]
}

export interface Project {
  /** e.g. "proj-java-telemetry" */
  id: string
  track: Track
  title: string
  subtitle: string
  difficulty: ProjectDifficulty
  /** Rough effort, e.g. "1–2 weeks". */
  estimate: string
  /** Short concept/tech tags. */
  tags: string[]
  /** Markdown overview / the pitch. */
  overview: string
  /** What you'll be able to demonstrate after building it. */
  learningGoals: string[]
  /** Markdown: functional + non-functional requirements. */
  requirements: string
  /** Ordered build milestones. */
  milestones: ProjectMilestone[]
  /** Done = all of these are true. */
  acceptanceCriteria: string[]
  /** Optional extensions for going deeper. */
  stretchGoals: string[]
  /** Markdown: what this proves in an interview + likely questions. */
  interviewAngle: string
  /** Suggested stack / libraries. */
  techStack: string[]
  /** Lab ids this project draws on. */
  relatedLabs: string[]
  /** Markdown: where to start, scaffolding hints, links to existing code. */
  startingPoint?: string
}

export interface PlanWeek {
  week: number
  /** Phase grouping, e.g. "Foundations". */
  phase: string
  /** One-line focus for the week. */
  focus: string
  /** Lab ids covered this week (may be empty for consolidation weeks). */
  labIds: string[]
  /** Project ids being worked on this week (capstones span multiple weeks). */
  projectIds?: string[]
  /** Concrete goals to tick off. */
  goals: string[]
  /** Optional milestone marker shown prominently. */
  milestone?: string
}
