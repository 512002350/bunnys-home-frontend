import { useRef, useCallback } from 'react';
import { avatarColor, getInitial } from '../../utils/avatar';

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
  onQuote,
  onRetract,
  isLastUser = false,
}) {
  const isUser = role === 'user';
  const longPressTimerRef = useRef(null);
  const preventClickRef = useRef(false);

  // 长按检测 (移动端)
  const handleTouchStart = useCallback(() => {
    preventClickRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      preventClickRef.current = true;
      const rect = document.activeElement?.getBoundingClientRect?.();
      onQuote?.(content, { x: rect?.left ?? 100, y: rect?.top ?? 200 });
    }, 500);
  }, [content, onQuote]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    // 移动超过阈值取消长按
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 右键菜单 (桌面端)
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    onQuote?.(content, { x: e.clientX, y: e.clientY });
  }, [content, onQuote]);

  return (
    <div
      className={`message-row ${role} ${position}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={handleContextMenu}
    >
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

        {/* 气泡 */}
        <div className="message-bubble">
          {renderContent ? renderContent(content, role) : content}
        </div>

        {/* 时间戳 + 撤回按钮 */}
        <div className="message-meta">
          {timestamp && (
            <span className="message-time">{formatTimestamp(timestamp)}</span>
          )}
          {isLastUser && isUser && onRetract && (
            <button
              className="retract-btn"
              onClick={onRetract}
              title="撤回消息（同时撤回 AI 回复）"
            >
              撤回
            </button>
          )}
        </div>
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
