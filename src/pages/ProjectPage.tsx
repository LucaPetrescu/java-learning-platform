import { Link, useParams } from 'react-router-dom'
import { labById, projectById } from '../content'
import { Markdown } from '../components/Markdown'
import { useProgress } from '../state/ProgressContext'
import { projectProgress, taskId } from '../lib/ids'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = projectId ? projectById(projectId) : undefined
  const { tasks, isTaskDone, toggleTask } = useProgress()

  if (!project) {
    return (
      <div className="empty">
        <h2>Project not found</h2>
        <Link className="btn" to="/projects">
          Back to projects
        </Link>
      </div>
    )
  }

  const p = projectProgress(project, tasks)

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          {project.track === 'spring' ? '🌱 Spring Boot' : '☕ Core Java'} capstone · {project.estimate}
        </div>
        <h1 className="page-title">{project.title}</h1>
        <p className="page-lead">{project.subtitle}</p>
        <div className="chips" style={{ marginTop: 14 }}>
          {project.tags.map((t) => (
            <span className="chip" key={t}>
              {t}
            </span>
          ))}
        </div>
        <div className={`progress${p.complete ? ' progress--green' : ''}`} style={{ marginTop: 18 }}>
          <div className="progress__bar" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          {p.complete ? '✓ All milestones complete — ' : ''}
          {p.done}/{p.total} build tasks done ({Math.round(p.ratio * 100)}%)
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg-elev)' }}>
        <Markdown>{project.overview}</Markdown>
      </div>

      <h2 className="section-h">What you'll be able to demonstrate</h2>
      <div className="card">
        <ul className="md" style={{ margin: 0, paddingLeft: 22 }}>
          {project.learningGoals.map((g, i) => (
            <li key={i} style={{ margin: '6px 0' }}>
              {g}
            </li>
          ))}
        </ul>
      </div>

      <h2 className="section-h">Requirements</h2>
      <div className="card">
        <Markdown>{project.requirements}</Markdown>
      </div>

      <h2 className="section-h">Milestones</h2>
      {project.milestones.map((m, i) => {
        const mDone = m.tasks.filter((_, j) => isTaskDone(taskId(project.id, i, j))).length
        return (
          <div className="card" key={i} style={{ marginBottom: 12 }}>
            <div className="milestone-head">
              <span className={`milestone-num${mDone === m.tasks.length ? ' done' : ''}`}>
                {mDone === m.tasks.length ? '✓' : i + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: 16, flex: 1 }}>{m.title}</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                {mDone}/{m.tasks.length}
              </span>
            </div>
            <div
              className={`progress${mDone === m.tasks.length ? ' progress--green' : ''}`}
              style={{ marginTop: 12 }}
            >
              <div
                className="progress__bar"
                style={{
                  width: `${m.tasks.length === 0 ? 0 : Math.round((mDone / m.tasks.length) * 100)}%`,
                }}
              />
            </div>
            <ul className="task-list">
              {m.tasks.map((t, j) => {
                const id = taskId(project.id, i, j)
                const done = isTaskDone(id)
                return (
                  <li key={j} className={`task-item${done ? ' done' : ''}`}>
                    <button
                      className={`read-check${done ? ' read' : ''}`}
                      title={done ? 'Done' : 'Mark task done'}
                      onClick={() => toggleTask(id)}
                    >
                      ✓
                    </button>
                    <div className="task-item__text">
                      <Markdown>{t}</Markdown>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      <div className="grid grid--2" style={{ marginTop: 8 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>✅ Done when…</h3>
          <ul className="md" style={{ margin: 0, paddingLeft: 22 }}>
            {project.acceptanceCriteria.map((c, i) => (
              <li key={i} style={{ margin: '5px 0' }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>🚀 Stretch goals</h3>
          <ul className="md" style={{ margin: 0, paddingLeft: 22 }}>
            {project.stretchGoals.map((c, i) => (
              <li key={i} style={{ margin: '5px 0' }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="section-h">Why it matters in interviews</h2>
      <div className="callout">
        <span className="callout__icon">🎤</span>
        <div>
          <Markdown>{project.interviewAngle}</Markdown>
        </div>
      </div>

      {project.startingPoint && (
        <>
          <h2 className="section-h">Where to start</h2>
          <div className="card">
            <Markdown>{project.startingPoint}</Markdown>
          </div>
        </>
      )}

      <h2 className="section-h">Suggested stack</h2>
      <div className="chips">
        {project.techStack.map((t) => (
          <span className="chip" key={t}>
            {t}
          </span>
        ))}
      </div>

      <div className="divider" />
      <div>
        <span className="muted" style={{ fontSize: 13 }}>Builds on: </span>
        <span className="chips" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
          {project.relatedLabs.map((id) => {
            const lab = labById(id)
            return lab ? (
              <Link key={id} to={`/lab/${id}`} className="chip">
                Lab {lab.number}: {lab.title}
              </Link>
            ) : null
          })}
        </span>
      </div>

      <div className="divider" />
      <Link className="btn btn--ghost" to="/projects">
        ← All projects
      </Link>
    </div>
  )
}
