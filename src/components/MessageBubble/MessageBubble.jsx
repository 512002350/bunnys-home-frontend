import { useState } from 'react';

/**
 * 头像颜色
 */
function avatarColor(str) {
  const colors = [
    '#FF6B6B', '#FF8E53', '#FFC048', '#4ECDC4',
    '#45B7D1', '#96CEB4', '#6C5CE7', '#A29BFE',
    '#FD79A8', '#FDCB6E', '#00B894', '#00CEC9',
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

function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - msgDay) / 86400000);

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `昨天 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export default function MessageBubble({
  role,
  content,
  thinking,
  timestamp,
  renderContent,
  position = 'single',
  showAvatar = false,
  senderName = null,
}) {
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const isUser = role === 'user';

  return (
    <div className={`message-row ${role} ${position}`}>
      {/* AI 头像 */}
      {!isUser && (
        <div className={`message-avatar ${!showAvatar ? 'hidden' : ''}`}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: avatarColor(senderName || 'default'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
          }}>
            {getInitial(senderName || '?')}
          </div>
        </div>
      )}

      <div className="message-content-wrapper">
        {/* 发送者名字 */}
        {senderName && (
          <div className="message-sender-name">{senderName}</div>
        )}

        {/* Thinking 折叠 */}
        {thinking && (
          <div className="thinking-fold">
            <button
              className="thinking-toggle"
              onClick={() => setThinkingOpen(!thinkingOpen)}
            >
              {thinkingOpen ? '▾' : '▸'} {thinkingOpen ? '收起思考' : '查看思考过程'}
            </button>
            {thinkingOpen && (
              <div className="thinking-content">{thinking}</div>
            )}
          </div>
        )}

        {/* 气泡 */}
        <div className="message-bubble">
          {renderContent ? renderContent(content) : content}
        </div>

        {/* 时间戳（仅最后一条显示） */}
        {timestamp && (
          <div className="message-time">
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>

      {/* 用户端空占位 */}
      {isUser && (
        <div className={`message-avatar ${!showAvatar ? 'hidden' : ''}`}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: '#B0BEC5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
          }}>
            {getInitial('我')}
          </div>
        </div>
      )}
    </div>
  );
}
