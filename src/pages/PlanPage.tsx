import { Link } from 'react-router-dom'
import { studyPlan } from '../content/studyPlan'
import { labById, projectById } from '../content'
import type { PlanWeek } from '../content/types'

export function PlanPage() {
  // group weeks by phase, preserving order
  const phases: { name: string; weeks: PlanWeek[] }[] = []
  for (const w of studyPlan) {
    let group = phases.find((p) => p.name === w.phase)
    if (!group) {
      group = { name: w.phase, weeks: [] }
      phases.push(group)
    }
    group.weeks.push(w)
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">16 weeks · ~4 months</div>
        <h1 className="page-title">The study plan</h1>
        <p className="page-lead">
          Roughly one lab per week with built-in consolidation and mock-interview weeks.
          Adjust the pace to your schedule — the order matters more than the timing.
        </p>
      </div>

      {phases.map((phase) => {
        const first = phase.weeks[0].week
        const last = phase.weeks[phase.weeks.length - 1].week
        return (
          <div className="phase" key={phase.name}>
            <div className="phase__head">
              <span className="phase__name">{phase.name}</span>
              <span className="phase__range">
                Weeks {first}–{last}
              </span>
            </div>
            <div className="card" style={{ padding: '4px 22px' }}>
              {phase.weeks.map((w) => (
                <div className="week" key={w.week}>
                  <div className="week__no">
                    W{w.week}
                    <small>{w.labIds.length ? 'lab' : w.projectIds?.length ? 'build' : 'review'}</small>
                  </div>
                  <div>
                    <div className="week__focus">{w.focus}</div>
                    {w.labIds.length > 0 && (
                      <div className="week__labs">
                        {w.labIds.map((id) => {
                          const lab = labById(id)
                          return lab ? (
                            <Link key={id} to={`/lab/${id}`} className="chip">
                              Lab {lab.number}: {lab.title}
                            </Link>
                          ) : (
                            <span key={id} className="chip">
                              {id}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {w.projectIds && w.projectIds.length > 0 && (
                      <div className="week__labs">
                        {w.projectIds.map((id) => {
                          const proj = projectById(id)
                          return proj ? (
                            <Link key={id} to={`/project/${id}`} className="chip">
                              ✦ {proj.title}
                            </Link>
                          ) : (
                            <span key={id} className="chip">
                              {id}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <ul className="week__goals">
                      {w.goals.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                    {w.milestone && (
                      <span className="week__milestone">🏁 {w.milestone}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
