interface Props {
  name: string
  status: string
  onRename(name: string): void
  onNew(): void
  onSave(): void
}

export function TopBar({ name, status, onRename, onNew, onSave }: Props) {
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
      <span className="topbar-status" data-testid="status">{status}</span>
      <div className="spacer" />
      <div className="btn-group">
        <button onClick={onNew} data-testid="new">New</button>
        <button disabled title="Open from a file arrives with local file persistence (Days 21–24)">Open</button>
        <button onClick={onSave} data-testid="save" title="Save (Ctrl+S)">Save</button>
      </div>
      <button className="btn-primary" disabled title="Presentation mode arrives in Days 15–20">Present</button>
    </header>
  )
}
