import { NavLink } from 'react-router-dom'
import { javaLabs, springLabs, projects, labs } from '../content'
import type { Lab } from '../content/types'
import { useProgress } from '../state/ProgressContext'
import { labProgress, projectProgress } from '../lib/ids'

function LabLink({ lab }: { lab: Lab }) {
  const { exercises, reading } = useProgress()
  const p = labProgress(lab, exercises, reading)
  const dotClass = p.complete ? 'done' : p.ratio > 0 ? 'partial' : ''
  return (
    <NavLink
      to={`/lab/${lab.id}`}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      <span className="nav-link__num">{String(lab.number).padStart(2, '0')}</span>
      <span className="nav-link__text">{lab.title}</span>
      <span className={`nav-dot ${dotClass}`} />
    </NavLink>
  )
}

export function Sidebar() {
  const { exercises, reading, tasks, reset } = useProgress()

  // Total progress across every lab (Core Java + Spring), driven by completed
  // exercises. Updates live whenever an exercise is toggled.
  let doneExercises = 0
  let totalExercises = 0
  for (const lab of labs) {
    const p = labProgress(lab, exercises, reading)
    doneExercises += p.doneExercises
    totalExercises += p.totalExercises
  }
  const pct = totalExercises === 0 ? 0 : Math.round((doneExercises / totalExercises) * 100)

  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand">
        <img src="/coffee.svg" className="brand__mark" alt="" />
        <div>
          <div className="brand__title">Java Path</div>
          <div className="brand__sub">Learn Java &amp; Spring Boot</div>
        </div>
      </NavLink>

      <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        <span className="nav-link__num">⌂</span>
        <span className="nav-link__text">Dashboard</span>
      </NavLink>
      <NavLink to="/plan" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        <span className="nav-link__num">▦</span>
        <span className="nav-link__text">Study plan</span>
      </NavLink>
      <NavLink to="/projects" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        <span className="nav-link__num">✦</span>
        <span className="nav-link__text">Capstone projects</span>
      </NavLink>

      <div className="sidebar-progress">
        <div className="sidebar-progress__top">
          <span>Total lab progress</span>
          <span className="sidebar-progress__pct">{pct}%</span>
        </div>
        <div className={`progress${pct === 100 ? ' progress--green' : ''}`}>
          <div className="progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <div className="sidebar-progress__sub">
          {doneExercises} / {totalExercises} exercises across all labs
        </div>
      </div>

      <div className="nav-group-label">Core Java</div>
      {javaLabs.map((lab) => (
        <LabLink key={lab.id} lab={lab} />
      ))}

      <div className="nav-group-label">Spring Boot</div>
      {springLabs.map((lab) => (
        <LabLink key={lab.id} lab={lab} />
      ))}

      <div className="nav-group-label">Projects</div>
      {projects.map((proj) => {
        const p = projectProgress(proj, tasks)
        const dotClass = p.complete ? 'done' : p.ratio > 0 ? 'partial' : ''
        return (
          <NavLink
            key={proj.id}
            to={`/project/${proj.id}`}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-link__num">{proj.track === 'spring' ? '🌱' : '☕'}</span>
            <span className="nav-link__text">{proj.title}</span>
            <span className={`nav-dot ${dotClass}`} />
          </NavLink>
        )
      })}

      <div className="sidebar__footer">
        <button
          className="btn btn--ghost btn--sm"
          style={{ width: '100%' }}
          onClick={() => {
            if (confirm('Reset all progress? This cannot be undone.')) reset()
          }}
        >
          Reset progress
        </button>
      </div>
    </aside>
  )
}
