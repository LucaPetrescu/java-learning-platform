import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="empty">
      <h2>Page not found</h2>
      <p className="muted">That route doesn't exist.</p>
      <Link className="btn btn--primary" to="/">
        Back to dashboard
      </Link>
    </div>
  )
}
