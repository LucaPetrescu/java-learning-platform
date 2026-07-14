import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    const from = (location.state as { from?: Location } | null)?.from
    navigate(from?.pathname ?? '/', { replace: true })
  }, [user, location, navigate])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === 'signup') {
      setInfo('Check your email to confirm your account, then sign in.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ padding: '0 0 22px', justifyContent: 'center' }}>
          <span style={{ fontSize: 28 }}>☕</span>
          <div>
            <div className="brand__title">Java Path</div>
            <div className="brand__sub">Sign in to sync your progress</div>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
            type="button"
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
            type="button"
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
            </label>
            <input
              className="field__input"
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <input
              className="field__input"
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button className="btn btn--primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <p className="muted auth-switch">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode('signup')
                }}
              >
                Sign up
              </a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode('signin')
                }}
              >
                Sign in
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
