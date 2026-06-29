import { useState, useRef, useEffect } from 'react';
import MessageBubble from '../MessageBubble/MessageBubble';
import StickerPicker from '../StickerPicker/StickerPicker';

export default function ChatArea({
  sessionId,
  messages,
  loading,
  model,
  models,
  onSend,
  onModelChange,
  stickers,
  onUploadSticker,
  messageListRef,
}) {
  const [input, setInput] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const inputRef = useRef(null);
  const listRef = messageListRef || useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // 消息变化时也滚动
  const msgLen = messages.length;

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input);
    setInput('');
    setShowStickers(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStickerSelect = (sticker) => {
    setInput(prev => prev + ` [sticker:${sticker.name}]`);
    setShowStickers(false);
    inputRef.current?.focus();
  };

  // 检测 sticker 标记并渲染
  const renderContent = (content) => {
    if (!content) return '';
    // 把 [STICKER_IMG]...[/STICKER_IMG] 替换为 <img>
    const parts = content.split(/\[STICKER_IMG\](.*?)\[\/STICKER_IMG\]/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // 图片 URL
        return <img key={i} src={part} alt="sticker" className="sticker-img" />;
      }
      return part;
    });
  };

  if (!sessionId) {
    return (
      <main className="chat-area">
        <div className="empty-chat">
          🐰 选择一个会话或新建一个，开始和 Bunny 聊天吧
        </div>
      </main>
    );
  }

  return (
    <main className="chat-area">
      <div className="chat-header">
        <span className="chat-title">
          {messages.length > 0 ? '对话中' : '新对话'}
        </span>
        <select
          className="model-select"
          value={model}
          onChange={e => onModelChange(e.target.value)}
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="message-list" ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className="empty-chat">发送第一条消息吧 ✨</div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            thinking={msg.thinking_content}
            timestamp={msg.created_at}
            renderContent={renderContent}
          />
        ))}
        {loading && (
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
        )}
      </div>

      <div className="input-area">
        <button
          className="sticker-btn"
          onClick={() => setShowStickers(!showStickers)}
          title="表情"
        >😊</button>

        <div className="input-wrapper">
          {showStickers && (
            <StickerPicker
              stickers={stickers}
              onSelect={handleStickerSelect}
              onUpload={onUploadSticker}
            />
          )}
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么吧..."
            rows={1}
          />
        </div>

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >↑</button>
      </div>
    </main>
  );
}
