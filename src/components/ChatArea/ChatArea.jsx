import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import MessageBubble from '../MessageBubble/MessageBubble';
import StickerPicker from '../StickerPicker/StickerPicker';
import { sendTypingEvent, uploadChatImage } from '../../services/api';

/**
 * 错峰延迟：多条 AI 回复逐条显示
 * 检测尾部连续 AI 消息，逐条解锁
 */
function useStaggeredReveal(messages, loading) {
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const prevLengthRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const prevLen = prevLengthRef.current;
    prevLengthRef.current = messages.length;

    // 没有消息 → 清空
    if (messages.length === 0) {
      setRevealedIndices(new Set());
      return;
    }

    // 首次加载（prevLen === 0 → 历史消息加载）→ 全部立即可见
    const isInitialLoad = prevLen === 0;

    // 找出尾部连续的 AI 消息
    let aiStart = messages.length;
    while (aiStart > 0 && messages[aiStart - 1]?.role === 'assistant') {
      aiStart--;
    }

    const aiBatch = messages.slice(aiStart);
    // 只在"新增消息 + 尾部是多段AI回复 + 非首次加载"时启用错峰
    const isNewMultiBatch = !isInitialLoad && messages.length > prevLen && aiBatch.length > 1 && !loading;

    if (isNewMultiBatch) {
      // 新的多段 AI 回复 → 逐条解锁
      const newIndices = new Set();
      for (let i = 0; i < aiStart; i++) {
        newIndices.add(i);
      }
      newIndices.add(aiStart); // 第一条立即可见
      setRevealedIndices(newIndices);

      // 清除旧 timer
      if (timerRef.current) clearTimeout(timerRef.current);

      /**
       * 根据内容长短计算错峰延迟
       * 短内容（≤20字）: 1.5~2.5秒
       * 中等（20~80字）: 2.5~4秒
       * 长内容（>80字）: 4~7秒
       */
      const calcDelay = (content) => {
        const len = content?.length || 0;
        const base = 1500;                         // 基础 1.5 秒
        const perChar = 35;                        // 每字 +35ms
        const noise = Math.random() * 1000;        // 随机 ±0.5s
        const raw = base + len * perChar + noise;
        return Math.min(7000, Math.max(1500, raw)); // 限制 1.5~7 秒
      };

      // 递归 setTimeout 链：每次解锁下一条，根据下一条长度算延迟
      let idx = aiStart + 1;
      const revealNext = () => {
        if (idx >= messages.length) {
          timerRef.current = null;
          return;
        }
        const delay = calcDelay(messages[idx]?.content);
        timerRef.current = setTimeout(() => {
          setRevealedIndices(prev => {
            const updated = new Set(prev);
            updated.add(idx);
            return updated;
          });
          idx++;
          revealNext();
        }, delay);
      };
      revealNext();
    } else {
      // 单条或历史消息 → 全部立即可见
      const all = new Set();
      for (let i = 0; i < messages.length; i++) all.add(i);
      setRevealedIndices(all);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [messages.length]); // eslint-disable-line

  return revealedIndices;
}

/**
 * 头像颜色（与 Sidebar 一致）
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

/**
 * 格式化日期分隔线
 */
function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - msgDay) / 86400000);

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  if (diffDays < 7) return weekdays[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 将消息列表转为分组结构
 * 同角色连续消息为一组，跨天自动拆分
 */
function groupMessages(messages) {
  if (!messages || messages.length === 0) return [];

  const groups = [];
  let currentGroup = null;

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString();

    // 判断是否需要新建组
    const needNewGroup =
      !currentGroup ||
      currentGroup.role !== msg.role ||
      currentGroup.dateLabel !== msgDate;

    if (needNewGroup) {
      currentGroup = {
        role: msg.role,
        dateLabel: msgDate,
        messages: [msg],
      };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(msg);
    }
  }

  return groups;
}

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
  onMenuClick,
  characterName = '小鹿',
  characterId = 'default',
  characters = [],
  onClearHistory,
  onCompact,
  onRetry,
  onExtractContext,
}) {
  const [input, setInput] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [typingVisible, setTypingVisible] = useState(false);
  const [typingStage, setTypingStage] = useState(0); // 0=无, 1=等待中, 2=正在输入
  const [showCmdPanel, setShowCmdPanel] = useState(false);
  // 图片上传状态
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const listRef = messageListRef || useRef(null);
  const prevMsgLenRef = useRef(0);
  const isAtBottomRef = useRef(true);

  // ====== 输入行为追踪 —— 用于沈夜检测害羞/犹豫信号 ======
  const typingMetricsRef = useRef({
    focusTime: null,           // 输入框获得焦点的时间戳
    firstKeystrokeTime: null,  // 第一次按键的时间戳
    prevLength: 0,             // 上一次文本长度
    deleteRetypeCycles: 0,     // 删了又打循环次数
    inDeletePhase: false,      // 当前是否处于删除阶段
    idleTimerId: null,         // 光标空闲超时定时器
    messageReceivedTime: null, // 收到最后一条 AI 消息的时间戳
  });

  // 重置输入行为追踪
  const resetTypingMetrics = () => {
    const m = typingMetricsRef.current;
    if (m.idleTimerId) clearTimeout(m.idleTimerId);
    m.focusTime = null;
    m.firstKeystrokeTime = null;
    m.prevLength = 0;
    m.deleteRetypeCycles = 0;
    m.inDeletePhase = false;
    m.idleTimerId = null;
  };

  // 当收到新 AI 消息时，记录时间（用于计算"看到消息后多久开始打字"）
  useEffect(() => {
    if (!loading && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        typingMetricsRef.current.messageReceivedTime = Date.now();
      }
    }
  }, [loading, messages.length]);

  // 图片选择弹出菜单：点击外部关闭
  useEffect(() => {
    if (!showImagePicker) return;
    const handleClick = (e) => {
      if (!e.target.closest('.image-picker-popup') && !e.target.closest('.image-btn')) {
        setShowImagePicker(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showImagePicker]);

  const handleInputFocus = () => {
    const now = Date.now();
    const m = typingMetricsRef.current;
    m.focusTime = now;
    m.firstKeystrokeTime = null;
    m.prevLength = input.length;
    m.deleteRetypeCycles = 0;
    m.inDeletePhase = false;

    // 清除之前的空闲定时器
    if (m.idleTimerId) clearTimeout(m.idleTimerId);

    // 启动光标空闲检测：12 秒内没打出任何字 → 推送 cursor_idle 事件
    m.idleTimerId = setTimeout(() => {
      if (sessionId && m.firstKeystrokeTime === null) {
        const idleSec = Math.round((Date.now() - m.focusTime) / 1000);
        sendTypingEvent(sessionId, 'cursor_idle', { seconds: idleSec }).catch(() => {});
      }
    }, 12000);
  };

  // ====== 图片上传处理 ======
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      setImagePreview({ base64, mimeType: file.type, dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setShowImagePicker(false);
  };

  const removeImagePreview = () => {
    setImagePreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleInputChangeWithTracking = (e) => {
    const newValue = e.target.value;
    const now = Date.now();
    const m = typingMetricsRef.current;

    // 首次按键 → 取消光标空闲定时器
    if (m.firstKeystrokeTime === null && newValue.length > 0 && m.focusTime !== null) {
      m.firstKeystrokeTime = now;
      if (m.idleTimerId) {
        clearTimeout(m.idleTimerId);
        m.idleTimerId = null;
      }
    }

    // 检测"删了又打"循环：文本先变短（删除）→ 再变长（重打）= 1 个循环
    const newLen = newValue.length;
    const prevLen = m.prevLength;

    if (newLen < prevLen && (prevLen - newLen) >= 2) {
      // 删除阶段开始（至少删了 2 个字符才算）
      if (!m.inDeletePhase) {
        m.inDeletePhase = true;
      }
    } else if (newLen > prevLen && m.inDeletePhase && (newLen - prevLen) >= 2) {
      // 删除后又开始重新输入（至少输入 2 个字符才算）
      m.deleteRetypeCycles++;
      m.inDeletePhase = false;

      // 第 1-2 次删了又打 → 推送事件给后端
      if (m.deleteRetypeCycles <= 2 && sessionId) {
        sendTypingEvent(sessionId, 'delete_retype', { cycles: m.deleteRetypeCycles }).catch(() => {});
      }
    }

    m.prevLength = newLen;
    setInput(newValue);
  };

  // 构建发送时附带的输入行为元数据
  const buildTypingMetrics = () => {
    const m = typingMetricsRef.current;
    const now = Date.now();

    // 光标空闲时长（从获得焦点到首次按键，或到发送）
    const cursorIdleSec = m.firstKeystrokeTime && m.focusTime
      ? Math.round((m.firstKeystrokeTime - m.focusTime) / 1000)
      : m.focusTime
        ? Math.round((now - m.focusTime) / 1000)
        : 0;

    // 从收到消息到开始打字的延时
    const reactionDelaySec = m.messageReceivedTime && m.firstKeystrokeTime
      ? Math.round((m.firstKeystrokeTime - m.messageReceivedTime) / 1000)
      : 0;

    // 打字总时长
    const typingDurationSec = m.firstKeystrokeTime
      ? Math.round((now - m.firstKeystrokeTime) / 1000)
      : 0;

    return {
      cursorIdleSeconds: cursorIdleSec,
      reactionDelaySeconds: reactionDelaySec,
      typingDurationSeconds: typingDurationSec,
      finalMessageLength: input.length,
      deleteRetypeCycles: m.deleteRetypeCycles,
    };
  };

  // 错峰显示：多条 AI 回复逐条解锁
  const revealedIndices = useStaggeredReveal(messages, loading);

  // ====== 打字模拟：随机延迟后显示"正在输入..."气泡 ======
  useEffect(() => {
    if (loading) {
      // 阶段1：随机等待 1.5~4 秒（模拟思考时间）
      const typingDelay = 1500 + Math.random() * 2500;
      setTypingStage(1);
      typingTimerRef.current = setTimeout(() => {
        setTypingStage(2); // 阶段2：显示"正在输入..."
        setTypingVisible(true);
        // 阶段3：消息到达后 typingVisible 由 loading 变为 false 自动关闭
      }, typingDelay);
    } else {
      // loading 结束 → 关闭打字动画
      setTypingVisible(false);
      setTypingStage(0);
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [loading]);

  // 只取已解锁的消息进行分组渲染
  const visibleMessages = useMemo(
    () => messages.filter((_, i) => revealedIndices.has(i)),
    [messages, revealedIndices]
  );

  // 计算消息分组
  const messageGroups = useMemo(() => groupMessages(visibleMessages), [visibleMessages]);

  // 日期分隔线追踪
  let lastDateLabel = null;

  // 检测是否在底部
  const checkScrollPosition = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom && el.scrollHeight > el.clientHeight + 200);
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback((force = false) => {
    const el = listRef.current;
    if (!el) return;
    if (force || isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // 新消息到达时自动滚到底部
  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    prevMsgLenRef.current = visibleMessages.length;
    // 如果是新增消息，滚动
    if (visibleMessages.length > prevLen) {
      scrollToBottom(true);
    }
  }, [visibleMessages.length, scrollToBottom]);

  // 加载时滚到底部
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [sessionId]); // eslint-disable-line

  // 监听滚动
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollPosition, { passive: true });
    return () => el.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

  const handleSend = async () => {
    if ((!input.trim() && !imagePreview) || loading || uploadingImage) return;

    // 收集输入行为元数据
    const typingMetrics = buildTypingMetrics();
    resetTypingMetrics();

    let imageDescription = null;

    // 如果有图片，先上传并获取 DeepSeek 识图描述
    if (imagePreview) {
      setUploadingImage(true);
      try {
        const result = await uploadChatImage(sessionId, imagePreview.base64, imagePreview.mimeType);
        imageDescription = result.description;
        const imageTag = `[CHAT_IMAGE]${result.url}[/CHAT_IMAGE]`;
        const finalMessage = input.trim() ? `${imageTag} ${input}` : imageTag;
        setImagePreview(null);
        onSend(finalMessage, typingMetrics, imageDescription);
        setInput('');
      } catch (err) {
        alert('图片上传失败: ' + err.message);
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    } else {
      onSend(input, typingMetrics, imageDescription);
      setInput('');
    }

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

  // 去除 AI 回复中的 Markdown 格式标记（** **, __ __, ~~ ~~ 等）
  const stripMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')     // **粗体**
      .replace(/__(.+?)__/g, '$1')          // __粗体__
      .replace(/~~(.+?)~~/g, '$1')          // ~~删除线~~
      .replace(/`(.+?)`/g, '$1');           // `代码`
  };

  // 检测 sticker / 聊天图片标记并渲染
  const renderContent = (content) => {
    if (!content) return '';
    // 先处理 [CHAT_IMAGE]url[/CHAT_IMAGE]
    const chatImageParts = content.split(/\[CHAT_IMAGE\](.*?)\[\/CHAT_IMAGE\]/g);
    return chatImageParts.map((part, i) => {
      if (i % 2 === 1) {
        return <img key={`ci-${i}`} src={part} alt="聊天图片" className="chat-image-inline" />;
      }
      // 再处理 [STICKER_IMG]url[/STICKER_IMG]
      const stickerParts = part.split(/\[STICKER_IMG\](.*?)\[\/STICKER_IMG\]/g);
      return stickerParts.map((subPart, j) => {
        if (j % 2 === 1) {
          return <img key={`st-${i}-${j}`} src={subPart} alt="sticker" className="sticker-img" />;
        }
        return subPart;
      });
    }).flat();
  };

  // ---- 空状态 ----
  if (!sessionId) {
    return (
      <main className="chat-area">
        <div className="chat-header">
          <button className="hamburger-btn" onClick={onMenuClick} title="菜单">☰</button>
          <span className="chat-header-name">Bunny's Home</span>
        </div>
        <div className="empty-chat">
          <div className="empty-chat-icon">🐰</div>
          <div>选择一个会话或新建一个，开始聊天吧</div>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-area">
      {/* 头部 */}
      <div className="chat-header">
        <button className="hamburger-btn" onClick={onMenuClick} title="菜单">☰</button>

        {/* 当前对话对象（不可点击切换，避免混淆） */}
        <div
          className="chat-header-char"
          style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}
        >
          <div
            className="chat-header-avatar"
            style={{ background: avatarColor(characterId) }}
          >
            {getInitial(characterName)}
          </div>
          <div className="chat-header-info">
            <div className="chat-header-name">{characterName}</div>
            <div className={`chat-header-status ${typingStage === 2 ? 'typing-status' : ''}`}>
              {typingStage === 2 ? '正在输入...' : loading ? '思考中...' : '在线'}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          <select
            className="model-select"
            value={model}
            onChange={e => onModelChange(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'var(--font)',
            }}
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name.split('（')[0]}</option>
            ))}
          </select>

          {/* 更多菜单 */}
          <div style={{ position: 'relative' }}>
            <button
              className="hamburger-btn"
              style={{ display: 'flex' }}
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              title="更多"
            >⋮</button>
            {showHeaderMenu && (
              <>
                <div
                  className="char-dropdown-backdrop"
                  onClick={() => setShowHeaderMenu(false)}
                />
                <div className="char-dropdown" style={{ right: 0, left: 'auto', minWidth: 180 }}>
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      if (confirm('确定要清空当前对话的所有消息吗？此操作不可撤销。')) {
                        onClearHistory?.();
                      }
                      setShowHeaderMenu(false);
                    }}
                  >
                    🗑 清空对话记录
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className={`message-list ${visibleMessages.length > 0 ? 'has-messages' : ''}`} ref={listRef}>
        {visibleMessages.length === 0 && !loading && (
          <div className="empty-chat">
            <div className="empty-chat-icon">💬</div>
            <div>发送第一条消息吧</div>
          </div>
        )}

        {messageGroups.map((group, gi) => {
          // 日期分隔线
          let dateSep = null;
          if (group.dateLabel !== lastDateLabel) {
            dateSep = <div className="date-separator" key={`date-${group.dateLabel}`}>
              <span>{formatDateLabel(group.messages[0]?.created_at)}</span>
            </div>;
            lastDateLabel = group.dateLabel;
          }

          // 动画标记：后 3 组标记为 animate-in
          const groupAge = messageGroups.length - 1 - gi;
          const animClass = groupAge < 3
            ? `animate-in ${group.role === 'user' ? 'user-group' : 'assistant-group'}${groupAge > 0 ? ` stagger-${Math.min(groupAge, 3)}` : ''}`
            : '';

          const groupEl = (
            <div className={`message-group ${animClass}`} key={`g-${gi}`}>
              {group.messages.map((msg, mi) => {
                const isFirst = mi === 0;
                const isLast = mi === group.messages.length - 1;
                const isSingle = group.messages.length === 1;
                let position = 'middle';
                if (isSingle) position = 'single';
                else if (isFirst) position = 'first';
                else if (isLast) position = 'last';

                return (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    thinking={msg.thinking_content}
                    timestamp={isLast ? msg.created_at : null}
                    renderContent={renderContent}
                    position={position}
                    showAvatar={group.role === 'assistant' && isLast}
                    senderName={group.role === 'assistant' && isFirst ? characterName : null}
                  />
                );
              })}
            </div>
          );

          return dateSep ? [dateSep, groupEl] : groupEl;
        })}

        {/* 打字动画气泡 */}
        {typingVisible && (
          <div className="typing-row">
            <div
              className="typing-avatar"
              style={{ background: avatarColor(characterId) }}
            >
              {getInitial(characterName)}
            </div>
            <div className="typing-bubble">
              <span className="typing-text">正在输入</span>
              <span className="typing-dot-anim">.</span>
              <span className="typing-dot-anim">.</span>
              <span className="typing-dot-anim">.</span>
            </div>
          </div>
        )}
      </div>

      {/* 滚动到底部按钮 */}
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={() => scrollToBottom(true)} title="回到底部">
          ↓
        </button>
      )}

      {/* 输入区 */}
      <div className="input-area">
        {/* 左下角命令按钮 */}
        <div className="cmd-btn-wrapper">
          <button
            className={`cmd-btn ${showCmdPanel ? 'active' : ''}`}
            onClick={() => setShowCmdPanel(!showCmdPanel)}
            title="功能"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>

          {/* 命令菜单 */}
          {showCmdPanel && (
            <>
              <div className="cmd-backdrop" onClick={() => setShowCmdPanel(false)} />
              <div className="cmd-panel">
                <button className="cmd-item" onClick={() => { onExtractContext?.(); setShowCmdPanel(false); }}>
                  <span className="cmd-icon">💾</span>
                  <div className="cmd-item-text">
                    <span className="cmd-item-label">保存关键上下文</span>
                    <span className="cmd-item-desc">提取核心信息，新会话自动继承</span>
                  </div>
                </button>
                <button className="cmd-item" onClick={() => { onCompact?.(); setShowCmdPanel(false); }}>
                  <span className="cmd-icon">🗜️</span>
                  <div className="cmd-item-text">
                    <span className="cmd-item-label">压缩记忆</span>
                    <span className="cmd-item-desc">立即压缩上下文，释放 token</span>
                  </div>
                </button>
                <button className="cmd-item" onClick={() => { onClearHistory?.(); setShowCmdPanel(false); }}>
                  <span className="cmd-icon">🧹</span>
                  <div className="cmd-item-text">
                    <span className="cmd-item-label">清空对话</span>
                    <span className="cmd-item-desc">清除当前会话的所有消息</span>
                  </div>
                </button>
                <button className="cmd-item" onClick={() => { onRetry?.(); setShowCmdPanel(false); }}>
                  <span className="cmd-icon">🔄</span>
                  <div className="cmd-item-text">
                    <span className="cmd-item-label">重新生成</span>
                    <span className="cmd-item-desc">撤回上一条 AI 回复并重试</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 输入框 */}
        <div className="input-wrapper">
          {showStickers && (
            <>
              <div className="sticker-backdrop" onClick={() => setShowStickers(false)} />
              <StickerPicker
                stickers={stickers}
                onSelect={handleStickerSelect}
                onUpload={onUploadSticker}
                onClose={() => setShowStickers(false)}
              />
            </>
          )}
          {/* 图片预览缩略图 */}
          {imagePreview && (
            <div className="image-preview-bar">
              <img src={imagePreview.dataUrl} alt="预览" className="image-preview-thumb" />
              <button className="image-preview-remove" onClick={removeImagePreview} title="移除图片">✕</button>
              {uploadingImage && <span className="image-uploading-text">识别中...</span>}
            </div>
          )}

          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={handleInputChangeWithTracking}
            onFocus={handleInputFocus}
            onBlur={() => {
              // 失焦时检测：如果有过删了又打且最终内容为空或极短 → 放弃了输入
              const m = typingMetricsRef.current;
              if (m.deleteRetypeCycles >= 1 && input.trim().length === 0 && sessionId) {
                sendTypingEvent(sessionId, 'abandoned_input', { cycles: m.deleteRetypeCycles }).catch(() => {});
              }
              // 清除空闲定时器
              if (m.idleTimerId) {
                clearTimeout(m.idleTimerId);
                m.idleTimerId = null;
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            rows={1}
          />
        </div>

        {/* 拍照/图片上传按钮 */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleImageFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFileChange}
        />
        <div className="image-btn-wrapper">
          <button
            className={`image-btn ${imagePreview ? 'has-image' : ''}`}
            onClick={() => setShowImagePicker(!showImagePicker)}
            disabled={loading || uploadingImage}
            title="拍照/上传图片"
          >📷</button>
          {showImagePicker && (
            <div className="image-picker-popup">
              <button
                className="image-picker-option"
                onClick={() => { cameraInputRef.current?.click(); setShowImagePicker(false); }}
              >
                <span className="image-picker-icon">📸</span>
                <span>拍照</span>
              </button>
              <button
                className="image-picker-option"
                onClick={() => { galleryInputRef.current?.click(); setShowImagePicker(false); }}
              >
                <span className="image-picker-icon">🖼️</span>
                <span>从相册选择</span>
              </button>
            </div>
          )}
        </div>

        {/* 表情按钮（输入框和发送之间） */}
        <button
          className={`sticker-btn ${showStickers ? 'active' : ''}`}
          onClick={() => setShowStickers(!showStickers)}
          title="表情"
        >😊</button>

        {/* 发送按钮 */}
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={(!input.trim() && !imagePreview) || loading || uploadingImage}
          title="发送"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"
              fill="currentColor"/>
          </svg>
        </button>
      </div>
    </main>
  );
}
