interface Props {
  name: string
  status: string
  dirty: boolean
  fileName: string | null
  onRename(name: string): void
  onNew(): void
  onOpen(): void
  onSave(): void
  onSaveAs(): void
  onPresent(): void
}

export function TopBar({ name, status, dirty, fileName, onRename, onNew, onOpen, onSave, onSaveAs, onPresent }: Props) {
  return (
    <header className="topbar">
      <span className="wordmark">Frame</span>
      <span className="topbar-sep" />
      <input
        className="project-name"
        aria-label="Project name"
        data-testid="project-name"
        value={name}
        onChange={(e) => onRename(e.target.value)}
        spellCheck={false}
      />
      <span className="topbar-file" data-testid="file-name" title={fileName ? `Saved as ${fileName}` : 'Not saved to a file yet'}>
        {fileName ?? 'Not saved to a file'}
      </span>
      {dirty && (
        <span className="topbar-dirty" data-testid="dirty" title="Changes since the last save are kept in this browser until you save to a file">
          Unsaved changes
        </span>
      )}
      <span className="topbar-status" data-testid="status">
        {dirty ? '' : status}
      </span>
      <div className="spacer" />
      <div className="btn-group">
        <button onClick={onNew} data-testid="new" title="New project">New</button>
        <button onClick={onOpen} data-testid="open" title="Open a .frame file (Ctrl+O)">Open…</button>
        <button onClick={onSave} data-testid="save" title="Save (Ctrl+S)">Save</button>
        <button onClick={onSaveAs} data-testid="save-as" title="Save to a new file (Ctrl+Shift+S)">Save As…</button>
      </div>
      <button className="btn-primary" onClick={onPresent} data-testid="present-button" title="Present from this slide (Esc to exit)">
        Present
      </button>
    </header>
  )
}
