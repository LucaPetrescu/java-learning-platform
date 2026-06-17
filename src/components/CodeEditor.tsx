import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { oneDark } from '@codemirror/theme-one-dark'

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  /** Filename shown in the editor title bar. */
  filename?: string
  readOnly?: boolean
  minHeight?: string
}

/**
 * A local, dependency-light Java editor (CodeMirror 6). No execution — write
 * your attempt here, then run it in your own JDK/IDE. Fully offline.
 */
export function CodeEditor({
  value,
  onChange,
  filename = 'Main.java',
  readOnly = false,
  minHeight = '180px',
}: CodeEditorProps) {
  return (
    <div className="editor-wrap">
      <div className="editor-wrap__bar">
        <span className="dot-row">
          <span style={{ background: '#ff5f56' }} />
          <span style={{ background: '#ffbd2e' }} />
          <span style={{ background: '#27c93f' }} />
        </span>
        <span>{filename}</span>
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={oneDark}
        extensions={[java()]}
        editable={!readOnly}
        readOnly={readOnly}
        minHeight={minHeight}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: !readOnly,
          foldGutter: false,
          autocompletion: false,
        }}
      />
    </div>
  )
}
