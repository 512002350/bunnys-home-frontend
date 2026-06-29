export default function Sidebar({
  sessions,
  currentSessionId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onSettings,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>🐰 Bunny's Home</h1>
        <button className="new-session-btn" onClick={onNew} title="新建会话">+</button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
            还没有对话<br />点击 + 开始吧
          </div>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
            onClick={() => onSwitch(s.id)}
          >
            <span className="session-name">{s.name}</span>
            <span className="session-time">
              {formatTime(s.updated_at || s.created_at)}
            </span>
            <span className="session-actions" onClick={e => e.stopPropagation()}>
              <button
                className="session-action-btn"
                title="重命名"
                onClick={() => {
                  const name = prompt('新名称:', s.name);
                  if (name && name.trim()) onRename(s.id, name.trim());
                }}
              >✎</button>
              <button
                className="session-action-btn"
                title="删除"
                onClick={() => onDelete(s.id)}
              >✕</button>
            </span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="settings-btn" onClick={onSettings}>⚙ 设置</button>
      </div>
    </aside>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
