import { Link } from 'react-router-dom'
import { projects } from '../content'

const trackLabel: Record<'java' | 'spring', string> = {
  java: 'Core Java',
  spring: 'Spring Boot',
}

export function ProjectsPage() {
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
        {projects.map((proj) => (
          <Link key={proj.id} to={`/project/${proj.id}`} className="card card--hover">
            <div className="lab-card">
              <div className="lab-card__top">
                <span className="lab-card__num">
                  {proj.track === 'spring' ? '🌱' : '☕'} {trackLabel[proj.track]}
                </span>
                <span className="badge badge--challenge">Capstone</span>
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
              <div className="lab-card__meta">
                <span>⏱ {proj.estimate}</span>
                <span>🎯 {proj.milestones.length} milestones</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
