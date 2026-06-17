import { NavLink } from 'react-router-dom'
import { javaLabs, springLabs, projects } from '../content'
import type { Lab } from '../content/types'
import { useProgress } from '../state/ProgressContext'
import { labProgress } from '../lib/ids'

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
  const { reset } = useProgress()

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

      <div className="nav-group-label">Core Java</div>
      {javaLabs.map((lab) => (
        <LabLink key={lab.id} lab={lab} />
      ))}

      <div className="nav-group-label">Spring Boot</div>
      {springLabs.map((lab) => (
        <LabLink key={lab.id} lab={lab} />
      ))}

      <div className="nav-group-label">Projects</div>
      {projects.map((proj) => (
        <NavLink
          key={proj.id}
          to={`/project/${proj.id}`}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-link__num">{proj.track === 'spring' ? '🌱' : '☕'}</span>
          <span className="nav-link__text">{proj.title}</span>
        </NavLink>
      ))}

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
