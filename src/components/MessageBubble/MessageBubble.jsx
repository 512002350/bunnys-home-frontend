import { useState } from 'react';

export default function MessageBubble({ role, content, thinking, timestamp, renderContent }) {
  const [thinkingOpen, setThinkingOpen] = useState(false);

  return (
    <div className={`message-row ${role}`}>
      <div>
        {thinking && (
          <div className="thinking-fold">
            <button
              className="thinking-toggle"
              onClick={() => setThinkingOpen(!thinkingOpen)}
            >
              {thinkingOpen ? '▾' : '▸'} {thinkingOpen ? '收起思考过程' : '查看思考过程'}
            </button>
            {thinkingOpen && (
              <div className="thinking-content">{thinking}</div>
            )}
          </div>
        )}
        <div className="message-bubble">
          {renderContent ? renderContent(content) : content}
        </div>
        <div className="message-time">
          {formatTimestamp(timestamp)}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - msgDay) / 86400000);

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `昨天 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}
