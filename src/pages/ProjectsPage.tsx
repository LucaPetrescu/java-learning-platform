import { Link } from 'react-router-dom'
import { projects } from '../content'
import { useProgress } from '../state/ProgressContext'
import { projectProgress } from '../lib/ids'

const trackLabel: Record<'java' | 'spring', string> = {
  java: 'Core Java',
  spring: 'Spring Boot',
}

export function ProjectsPage() {
  const { tasks } = useProgress()
  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Build, don't just read</div>
        <h1 className="page-title">Capstone projects</h1>
        <p className="page-lead">
          Three projects to build yourself — the real proof you can ship Java and Spring.
          They share a space theme so they compose into one portfolio: a pure-Java
          telemetry engine, a resilient Spring integration gateway, and a real-time
          WebSocket hub that extends your <code>starwalker-websocket-service</code>.
        </p>
      </div>

      <div className="grid">
        {projects.map((proj) => {
          const p = projectProgress(proj, tasks)
          const pct = Math.round(p.ratio * 100)
          return (
            <Link key={proj.id} to={`/project/${proj.id}`} className="card card--hover">
              <div className="lab-card">
                <div className="lab-card__top">
                  <span className="lab-card__num">
                    {proj.track === 'spring' ? '🌱' : '☕'} {trackLabel[proj.track]}
                  </span>
                  {p.complete ? (
                    <span className="badge badge--warmup">✓ Done</span>
                  ) : (
                    <span className="badge badge--challenge">Capstone</span>
                  )}
                </div>
                <div>
                  <div className="lab-card__title">{proj.title}</div>
                  <div className="lab-card__sub">{proj.subtitle}</div>
                </div>
                <div className="chips" style={{ marginTop: 4 }}>
                  {proj.tags.slice(0, 5).map((t) => (
                    <span className="chip" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className={`progress${p.complete ? ' progress--green' : ''}`} style={{ marginTop: 4 }}>
                  <div className="progress__bar" style={{ width: `${pct}%` }} />
                </div>
                <div className="lab-card__meta">
                  <span>⏱ {proj.estimate}</span>
                  <span>✅ {p.done}/{p.total} tasks</span>
                  <span>{pct}%</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
