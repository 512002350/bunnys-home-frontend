import { useState, useMemo, useRef, useEffect } from 'react';

/**
 * 根据字符串生成一致的颜色
 */
function avatarColor(str) {
  const colors = [
    '#FF6B6B', '#FF8E53', '#FFC048', '#4ECDC4',
    '#45B7D1', '#96CEB4', '#6C5CE7', '#A29BFE',
    '#FD79A8', '#FDCB6E', '#00B894', '#00CEC9',
    '#E17055', '#D63031', '#0984E3', '#6C5CE7',
    '#E84393', '#00B894', '#FDCB6E', '#636E72',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitial(str) {
  if (!str) return '?';
  const chineseMatch = str.match(/[一-鿿]/);
  if (chineseMatch) return chineseMatch[0];
  return str.charAt(0).toUpperCase();
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - msgDay) / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[d.getDay()];
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getPreview(content) {
  if (!content) return '';
  let text = content
    .replace(/\[STICKER_IMG\].*?\[\/STICKER_IMG\]/g, '🖼 表情')
    .replace(/\[sticker:[^\]]+\]/gi, '')
    .replace(/\n/g, ' ')
    .trim();
  if (text.length > 40) text = text.slice(0, 40) + '...';
  return text;
}

export default function Sidebar({
  sessions,
  currentSessionId,
  isOpen,
  onClose,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onSettings,
  characters = [],
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const menuRef = useRef(null);

  // 过滤会话
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => s.name.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  const handleContextMenu = (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    setContextMenu({ x, y, session });
  };

  const handleRename = () => {
    const s = contextMenu?.session;
    if (!s) return;
    const name = prompt('新名称:', s.name);
    if (name && name.trim()) onRename(s.id, name.trim());
    setContextMenu(null);
  };

  const handleDelete = () => {
    const s = contextMenu?.session;
    if (!s) return;
    onDelete(s.id);
    setContextMenu(null);
  };

  const handleNewClick = () => {
    // 只要有可用角色就弹出选择窗口
    if (characters.length > 0) {
      setShowCharPicker(true);
    } else {
      // 角色列表还未加载，直接用默认
      onNew('default');
    }
  };

  const handleCharSelect = (characterId, characterName) => {
    setShowCharPicker(false);
    onNew(characterId, characterName);
  };

  // 获取角色名字
  const getCharName = (charId) => {
    const c = characters.find(ch => ch.id === charId);
    return c?.name || (charId === 'default' ? '小鹿' : charId);
  };

  // 获取会话的显示名称和头像键
  const getSessionAvatarKey = (session) => {
    const charId = session.character_id || 'default';
    const char = characters.find(c => c.id === charId);
    return { charId, charName: char?.name || getCharName(charId), avatarKey: charId };
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* 头部 */}
      <div className="sidebar-header">
        <h1>🐰 Bunny's Home</h1>
        <div className="sidebar-header-actions">
          <button className="header-icon-btn" onClick={handleNewClick} title="新建对话">+</button>
          <button className="sidebar-close-btn" onClick={onClose} title="关闭菜单">✕</button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="sidebar-search">
        <div className="search-wrapper">
          <input
            className="search-input"
            type="text"
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 会话列表 */}
      <div className="session-list">
        {filteredSessions.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            padding: 40,
            lineHeight: 1.8,
          }}>
            {searchQuery ? '没有找到匹配的对话' : '还没有对话\n点击 + 开始吧'}
          </div>
        )}
        {filteredSessions.map(s => {
          const { charId, charName, avatarKey } = getSessionAvatarKey(s);
          return (
            <div
              key={s.id}
              className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
              onClick={() => onSwitch(s.id)}
              onContextMenu={e => handleContextMenu(e, s)}
            >
              <div
                className="session-avatar"
                style={{ background: avatarColor(avatarKey) }}
                title={charName}
              >
                {getInitial(charName)}
              </div>
              <div className="session-info">
                <div className="session-top">
                  <span className="session-name">{s.name}</span>
                  <span className="session-time">
                    {formatTime(s.updated_at || s.created_at)}
                  </span>
                </div>
                <span className="session-preview">
                  {getPreview(s.last_message_preview || '')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部 */}
      <div className="sidebar-footer">
        <button className="settings-btn-bottom" onClick={onSettings}>
          ⚙ 设置
        </button>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="session-context-menu"
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="menu-item" onClick={handleRename}>
            ✎ 重命名
          </button>
          <button className="menu-item danger" onClick={handleDelete}>
            🗑 删除
          </button>
        </div>
      )}

      {/* 角色选择弹窗 */}
      {showCharPicker && (
        <>
          <div className="char-picker-overlay" onClick={() => setShowCharPicker(false)} />
          <div className="char-picker-modal">
            <div className="char-picker-title">选择对话对象</div>
            <div className="char-picker-list">
              {characters.map(c => (
                <div
                  key={c.id}
                  className="char-picker-item"
                  onClick={() => handleCharSelect(c.id, c.name)}
                >
                  <div
                    className="char-picker-avatar"
                    style={{ background: avatarColor(c.id) }}
                  >
                    {getInitial(c.name)}
                  </div>
                  <div className="char-picker-info">
                    <div className="char-picker-name">{c.name}</div>
                    <div className="char-picker-desc">{c.description || ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="char-picker-cancel" onClick={() => setShowCharPicker(false)}>
              取消
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
