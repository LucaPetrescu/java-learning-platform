import { useState } from 'react'
import type { TheorySection } from '../content/types'
import { useProgress } from '../state/ProgressContext'
import { Markdown } from './Markdown'

export function TheoryBlock({
  section,
  globalId,
  defaultOpen,
}: {
  section: TheorySection
  globalId: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const { isSectionRead, toggleSection } = useProgress()
  const read = isSectionRead(globalId)

  return (
    <div className="theory-section">
      <div className="theory-section__head" onClick={() => setOpen((o) => !o)}>
        <button
          className={`read-check${read ? ' read' : ''}`}
          title={read ? 'Marked as read' : 'Mark as read'}
          onClick={(e) => {
            e.stopPropagation()
            toggleSection(globalId)
          }}
        >
          ✓
        </button>
        <h3>{section.heading}</h3>
        <span className={`theory-section__caret${open ? ' open' : ''}`}>▶</span>
      </div>
      {open && (
        <div className="theory-section__body">
          <Markdown>{section.body}</Markdown>
        </div>
      )}
    </div>
  )
}
