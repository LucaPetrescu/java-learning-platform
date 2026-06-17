import { useState } from 'react'
import type { Exercise } from '../content/types'
import { useProgress } from '../state/ProgressContext'
import { Markdown } from './Markdown'
import { CodeEditor } from './CodeEditor'

const difficultyLabel: Record<Exercise['difficulty'], string> = {
  warmup: 'Warm-up',
  core: 'Core',
  challenge: 'Challenge',
}

export function ExerciseCard({
  exercise,
  globalId,
  index,
}: {
  exercise: Exercise
  globalId: string
  index: number
}) {
  const { isExerciseDone, toggleExercise } = useProgress()
  const done = isExerciseDone(globalId)

  const [code, setCode] = useState(exercise.starter)
  const [hintsShown, setHintsShown] = useState(0)
  const [showSolution, setShowSolution] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className={`exercise${done ? ' done' : ''}`}>
      <div className="exercise__head">
        <span className={`badge badge--${exercise.difficulty}`}>
          {difficultyLabel[exercise.difficulty]}
        </span>
        <h3>
          {index}. {exercise.title}
        </h3>
        <button
          className={`btn btn--sm${done ? ' btn--done' : ''}`}
          onClick={() => toggleExercise(globalId)}
        >
          {done ? '✓ Completed' : 'Mark complete'}
        </button>
      </div>

      <div className="exercise__body">
        <Markdown>{exercise.prompt}</Markdown>

        <CodeEditor
          value={code}
          onChange={setCode}
          filename={`${exercise.id}.java`}
        />

        <div className="exercise__bar">
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => copy(code)}
            title="Copy your code to run in your IDE / terminal"
          >
            {copied ? '✓ Copied' : '⧉ Copy code'}
          </button>
          {hintsShown < exercise.hints.length && (
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => setHintsShown((n) => n + 1)}
            >
              💡 {hintsShown === 0 ? 'Show a hint' : 'Next hint'} (
              {hintsShown}/{exercise.hints.length})
            </button>
          )}
          <div className="spacer" />
          <button
            className="btn btn--sm"
            onClick={() => setShowSolution((s) => !s)}
          >
            {showSolution ? 'Hide solution' : 'Reveal solution'}
          </button>
        </div>

        {exercise.hints.slice(0, hintsShown).map((hint, i) => (
          <div className="hint" key={i}>
            <span className="hint__label">Hint {i + 1}</span>
            {hint}
          </div>
        ))}

        {showSolution && (
          <div className="solution">
            <div className="solution__label">Reference solution</div>
            <CodeEditor
              value={exercise.solution}
              readOnly
              filename={`${exercise.id}.solution.java`}
              minHeight="120px"
            />
            <div style={{ marginTop: 14 }}>
              <Markdown>{exercise.explanation}</Markdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
