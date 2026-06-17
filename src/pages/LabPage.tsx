import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { labById, labs } from '../content'
import { useProgress } from '../state/ProgressContext'
import { exId, labProgress, secId } from '../lib/ids'
import { Markdown } from '../components/Markdown'
import { TheoryBlock } from '../components/TheoryBlock'
import { ExerciseCard } from '../components/ExerciseCard'

type Tab = 'theory' | 'exercises'

export function LabPage() {
  const { labId } = useParams<{ labId: string }>()
  const lab = labId ? labById(labId) : undefined
  const [tab, setTab] = useState<Tab>('theory')
  const { exercises, reading } = useProgress()

  if (!lab) {
    return (
      <div className="empty">
        <h2>Lab not found</h2>
        <Link className="btn" to="/">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const p = labProgress(lab, exercises, reading)
  const idx = labs.findIndex((l) => l.id === lab.id)
  const prev = idx > 0 ? labs[idx - 1] : undefined
  const next = idx < labs.length - 1 ? labs[idx + 1] : undefined

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          Lab {String(lab.number).padStart(2, '0')} · ~{lab.estimatedHours}h
        </div>
        <h1 className="page-title">{lab.title}</h1>
        <p className="page-lead">{lab.subtitle}</p>
        <div className="chips" style={{ marginTop: 14 }}>
          {lab.concepts.map((c) => (
            <span className="chip" key={c}>
              {c}
            </span>
          ))}
        </div>
        <div className="progress" style={{ marginTop: 18 }}>
          <div className="progress__bar" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          {p.doneSections}/{p.totalSections} topics read · {p.doneExercises}/
          {p.totalExercises} exercises done
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg-elev)' }}>
        <Markdown>{lab.overview}</Markdown>
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <span className="callout__icon">▶</span>
        <div>
          <strong>How to run exercises.</strong> Write your attempt in the editor, click{' '}
          <em>Copy code</em>, paste it into a <code>.java</code> file in your IDE, then run
          it. From a terminal: <code>javac Solution.java &amp;&amp; java Solution</code> (or{' '}
          <code>java Solution.java</code> directly on JDK 11+).
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab${tab === 'theory' ? ' active' : ''}`}
          onClick={() => setTab('theory')}
        >
          Theory<span className="tab__count">{lab.theory.length}</span>
        </button>
        <button
          className={`tab${tab === 'exercises' ? ' active' : ''}`}
          onClick={() => setTab('exercises')}
        >
          Exercises<span className="tab__count">{lab.exercises.length}</span>
        </button>
      </div>

      {tab === 'theory' && (
        <div>
          {lab.theory.map((section, i) => (
            <TheoryBlock
              key={section.id}
              section={section}
              globalId={secId(lab.id, section.id)}
              defaultOpen={i === 0}
            />
          ))}

          <div className="divider" />
          <h3 style={{ marginTop: 0 }}>Key takeaways</h3>
          <ul className="md" style={{ paddingLeft: 22 }}>
            {lab.takeaways.map((t, i) => (
              <li key={i} style={{ margin: '8px 0' }}>
                <Markdown>{t}</Markdown>
              </li>
            ))}
          </ul>
          <button className="btn btn--primary mt-2" onClick={() => setTab('exercises')}>
            Practice these → Exercises
          </button>
        </div>
      )}

      {tab === 'exercises' && (
        <div>
          {lab.exercises.map((ex, i) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              globalId={exId(lab.id, ex.id)}
              index={i + 1}
            />
          ))}
        </div>
      )}

      <div className="divider" />
      <div className="row between">
        {prev ? (
          <Link className="btn btn--ghost" to={`/lab/${prev.id}`}>
            ← Lab {prev.number}: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="btn" to={`/lab/${next.id}`}>
            Lab {next.number}: {next.title} →
          </Link>
        ) : (
          <Link className="btn" to="/plan">
            Back to the plan →
          </Link>
        )}
      </div>
    </div>
  )
}
