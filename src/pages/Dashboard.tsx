import { Link } from 'react-router-dom'
import { javaLabs, springLabs, labs, projects } from '../content'
import type { Lab } from '../content/types'
import { useProgress } from '../state/ProgressContext'
import { labProgress } from '../lib/ids'

function LabCard({ lab }: { lab: Lab }) {
  const { exercises, reading } = useProgress()
  const p = labProgress(lab, exercises, reading)
  return (
    <Link to={`/lab/${lab.id}`} className="card card--hover">
      <div className="lab-card">
        <div className="lab-card__top">
          <span className="lab-card__num">LAB {String(lab.number).padStart(2, '0')}</span>
          {p.complete ? (
            <span className="badge badge--warmup">✓ Done</span>
          ) : p.ratio > 0 ? (
            <span className="badge">{Math.round(p.ratio * 100)}%</span>
          ) : null}
        </div>
        <div>
          <div className="lab-card__title">{lab.title}</div>
          <div className="lab-card__sub">{lab.subtitle}</div>
        </div>
        <div className="progress" style={{ marginTop: 4 }}>
          <div className="progress__bar" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
        </div>
        <div className="lab-card__meta">
          <span>⏱ ~{lab.estimatedHours}h</span>
          <span>📝 {lab.exercises.length} exercises</span>
          <span>📖 {lab.theory.length} topics</span>
        </div>
      </div>
    </Link>
  )
}

export function Dashboard() {
  const { exercises, reading } = useProgress()

  const totalExercises = labs.reduce((n, l) => n + l.exercises.length, 0)
  const doneExercises = labs.reduce(
    (n, l) => n + labProgress(l, exercises, reading).doneExercises,
    0,
  )
  const labsComplete = labs.filter((l) => labProgress(l, exercises, reading).complete).length
  const overall = totalExercises === 0 ? 0 : Math.round((doneExercises / totalExercises) * 100)

  const nextLab =
    labs.find((l) => !labProgress(l, exercises, reading).complete) ?? labs[labs.length - 1]

  return (
    <div>
      <div className="hero">
        <div className="eyebrow">Your roadmap</div>
        <h1 className="page-title" style={{ marginBottom: 10 }}>
          Get interview-ready in Java &amp; Spring Boot
        </h1>
        <p className="page-lead">
          An intermediate path: 12 core-Java labs, 5 Spring Boot labs, and 3 capstone
          projects you build yourself. Theory is a sharp refresher; the exercises and
          projects are where the work is. Built on the{' '}
          <a
            href="https://ocw.cs.pub.ro/courses/poo-ca-cd/laboratoare/poo-java"
            target="_blank"
            rel="noreferrer"
          >
            POO Java curriculum
          </a>
          , extended for Spring.
        </p>

        <div className="row wrap" style={{ marginTop: 22, gap: 28 }}>
          <div className="stat">
            <span className="stat__value">{overall}%</span>
            <span className="stat__label">Overall progress</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              {labsComplete}/{labs.length}
            </span>
            <span className="stat__label">Labs complete</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              {doneExercises}/{totalExercises}
            </span>
            <span className="stat__label">Exercises done</span>
          </div>
          <div style={{ flex: 1 }} />
          <Link className="btn btn--primary" to={`/lab/${nextLab.id}`}>
            {overall === 0 ? 'Start Lab 1 →' : `Continue · ${nextLab.title} →`}
          </Link>
        </div>

        <div className="progress" style={{ marginTop: 20 }}>
          <div className="progress__bar" style={{ width: `${overall}%` }} />
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, letterSpacing: '-0.01em', margin: 0 }}>
          ☕ Core Java
        </h2>
        <span className="muted" style={{ fontSize: 13 }}>{javaLabs.length} labs</span>
      </div>
      <div className="grid grid--2">
        {javaLabs.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </div>

      <div className="row between" style={{ margin: '34px 0 16px' }}>
        <h2 style={{ fontSize: 20, letterSpacing: '-0.01em', margin: 0 }}>
          🌱 Spring Boot
        </h2>
        <span className="muted" style={{ fontSize: 13 }}>{springLabs.length} labs · interview-focused</span>
      </div>
      <div className="grid grid--2">
        {springLabs.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </div>

      <div className="row between" style={{ margin: '34px 0 16px' }}>
        <h2 style={{ fontSize: 20, letterSpacing: '-0.01em', margin: 0 }}>
          ✦ Capstone projects
        </h2>
        <Link to="/projects" className="muted" style={{ fontSize: 13 }}>
          View all →
        </Link>
      </div>
      <div className="grid grid--3">
        {projects.map((proj) => (
          <Link key={proj.id} to={`/project/${proj.id}`} className="card card--hover">
            <div className="lab-card">
              <span className={`track-tag track-tag--${proj.track}`}>
                {proj.track === 'spring' ? 'Spring Boot' : 'Core Java'}
              </span>
              <div className="lab-card__title" style={{ fontSize: 16 }}>
                {proj.title}
              </div>
              <div className="lab-card__sub">{proj.subtitle}</div>
              <div className="lab-card__meta">
                <span>⏱ {proj.estimate}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Progress is saved automatically in your browser. Spring labs use Spring Boot 4
        conventions to match your environment.
      </p>
    </div>
  )
}
