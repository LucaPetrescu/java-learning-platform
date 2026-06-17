import { Link, useParams } from 'react-router-dom'
import { labById, projectById } from '../content'
import { Markdown } from '../components/Markdown'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = projectId ? projectById(projectId) : undefined

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
      {project.milestones.map((m, i) => (
        <div className="card" key={i} style={{ marginBottom: 12 }}>
          <div className="milestone-head">
            <span className="milestone-num">{i + 1}</span>
            <h3 style={{ margin: 0, fontSize: 16 }}>{m.title}</h3>
          </div>
          <ul className="md" style={{ margin: '10px 0 0', paddingLeft: 22 }}>
            {m.tasks.map((t, j) => (
              <li key={j} style={{ margin: '5px 0' }}>
                <Markdown>{t}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      ))}

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
