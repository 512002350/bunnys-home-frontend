import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/ChatArea/ChatArea';
import Settings from './components/Settings/Settings';
import SkillManager from './components/SkillManager/SkillManager';
import * as api from './services/api';

const MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek（推荐·国内可用）' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4（需翻墙）' },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4（需翻墙）' },
];

function getStoredModel() {
  try { return localStorage.getItem('bunny_model') || MODELS[0].id; }
  catch { return MODELS[0].id; }
}

function getStoredSession() {
  try { return localStorage.getItem('bunny_session'); }
  catch { return null; }
}

function getStoredSessionChars() {
  try { return JSON.parse(localStorage.getItem('bunny_session_chars') || '{}'); }
  catch { return {}; }
}

function saveStoredSessionChars(map) {
  try { localStorage.setItem('bunny_session_chars', JSON.stringify(map)); }
  catch { /* 静默 */ }
}

/**
 * 解析会话角色 ID：localStorage → DB → 会话名推测 → 默认
 * 单一来源，消除 switchSession 和 render body 中的重复逻辑
 */
function resolveCharacterId(sessionId, session, sessionChars, characters) {
  if (sessionId && sessionChars[sessionId]) {
    return sessionChars[sessionId];
  }
  if (session?.character_id) {
    return session.character_id;
  }
  if (session?.name) {
    const matchedChar = characters.find(c => c.name && session.name.includes(c.name));
    if (matchedChar) return matchedChar.id;
  }
  return 'default';
}

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(getStoredSession());
  const [messages, setMessages] = useState({});  // { [sessionId]: [...] }
  const [model, setModel] = useState(getStoredModel);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkillManager, setShowSkillManager] = useState(false);
  const [settings, setSettings] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [sessionChars, setSessionChars] = useState(getStoredSessionChars); // { sessionId: charId }
  const messageListRef = useRef(null);
  const abortControllerRef = useRef(null);  // 用于中断 AI 生成
  const wasInterruptedRef = useRef(false);  // 标记上一轮是否被中断

  // 加载可用角色列表
  const loadCharacters = useCallback(async () => {
    try {
      const data = await api.getCharacters();
      setCharacters(data.characters || []);
    } catch (err) {
      // 接口可能还不存在，静默处理
    }
  }, []);

  // 更新会话→角色映射
  const setSessionChar = useCallback((sessionId, charId) => {
    setSessionChars(prev => {
      const next = { ...prev, [sessionId]: charId };
      saveStoredSessionChars(next);
      return next;
    });
  }, []);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('加载会话列表失败:', err);
    }
  }, []);

  // 加载表情库
  const loadStickers = useCallback(async () => {
    try {
      const data = await api.getStickers();
      setStickers(data.stickers || []);
    } catch (err) {
      // 表可能还没创建，静默处理
    }
  }, []);

  useEffect(() => { loadSessions(); loadStickers(); loadCharacters(); }, [loadSessions, loadStickers, loadCharacters]);

  // 切换会话
  const switchSession = useCallback(async (sessionId) => {
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
    localStorage.setItem('bunny_session', sessionId);
    if (!messages[sessionId]) {
      try {
        const data = await api.getSessionMessages(sessionId);
        setMessages(prev => ({ ...prev, [sessionId]: data.messages || [] }));
      } catch (err) {
        setMessages(prev => ({ ...prev, [sessionId]: [] }));
      }
    }

    // 确定会话角色
    const session = sessions.find(s => s.id === sessionId);
    let charId = resolveCharacterId(sessionId, session, sessionChars, characters);
    // 缓存结果，下次直接命中
    if (!sessionChars[sessionId]) {
      setSessionChar(sessionId, charId);
    }

    api.request('/api/character', {
      method: 'PUT',
      body: JSON.stringify({ character: charId }),
    }).catch(() => {});
  }, [messages, sessionChars, sessions, characters, setSessionChar]);

  // 新建会话（绑角色）
  const handleNewSession = useCallback(async (characterId, characterName) => {
    try {
      const charId = characterId || 'default';
      const charName = characterName || '';
      const sessionName = charName ? `${charName}的对话` : '新对话';
      const data = await api.createSession(sessionName, charId);
      setSessions(prev => [data.session, ...prev]);
      setCurrentSessionId(data.session.id);
      localStorage.setItem('bunny_session', data.session.id);
      setMessages(prev => ({ ...prev, [data.session.id]: [] }));
      setSessionChar(data.session.id, charId);
      // 同步切换后端角色
      api.request('/api/character', {
        method: 'PUT',
        body: JSON.stringify({ character: charId }),
      }).catch(() => {});
    } catch (err) {
      console.error('创建会话失败:', err);
    }
  }, [setSessionChar]);

  // 重命名会话
  const handleRenameSession = useCallback(async (id, name) => {
    try {
      await api.renameSession(id, name);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    } catch (err) {
      console.error('重命名失败:', err);
    }
  }, []);

  // 删除会话
  const handleDeleteSession = useCallback(async (id) => {
    if (!confirm('确定要删除这个会话吗？所有消息都会被清除。')) return;
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setMessages(prev => { const next = { ...prev }; delete next[id]; return next; });
      if (currentSessionId === id) {
        const next = sessions.find(s => s.id !== id);
        setCurrentSessionId(next?.id || null);
        localStorage.removeItem('bunny_session');
      }
    } catch (err) {
      console.error('删除失败:', err);
    }
  }, [currentSessionId, sessions]);

  // 发送消息
  const handleSendMessage = useCallback(async (text, typingMetrics, imageDescription) => {
    if (!text.trim() || !currentSessionId || loading) return;

    // 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg = {
      id: `temp-${Date.now()}`,
      session_id: currentSessionId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    // 如果上一轮被中断，追加系统提示给 AI
    const userMsgWithContext = wasInterruptedRef.current
      ? text + '\n\n[系统提示：上一轮你的回复被打断了。用户没有看到你后面想说的内容。他现在说了新的话——请自然地从这里接下去，不要重复之前被中断的内容。]'
      : text;
    wasInterruptedRef.current = false;

    setMessages(prev => ({
      ...prev,
      [currentSessionId]: [...(prev[currentSessionId] || []), userMsg],
    }));
    setLoading(true);

    try {
      const charId = sessionChars[currentSessionId] || 'default';
      const result = await api.sendMessage(currentSessionId, userMsgWithContext, model, charId, typingMetrics, imageDescription, controller.signal);

      // 如果请求被中断了
      if (result.aborted) {
        // 保留用户消息，但移除临时标记
        setMessages(prev => ({
          ...prev,
          [currentSessionId]: [
            ...(prev[currentSessionId] || []).filter(m => m.id !== userMsg.id),
            { ...userMsg, id: `user-${Date.now()}` },
          ],
        }));
        return;
      }

      // 处理多条 AI 回复（按 \n\n 拆分后逐条入库的）
      const replies = result.replies || [];
      const aiMsgs = replies.length > 0
        ? replies.map((r, i) => ({
            id: r.messageId || `ai-${Date.now()}-${i}`,
            session_id: currentSessionId,
            role: 'assistant',
            content: r.content,
            thinking_content: r.thinking || null,
            created_at: new Date(Date.now() + i * 1000).toISOString(), // 错开时间戳
          }))
        : [{
            // 兼容旧格式
            id: result.messageId || `ai-${Date.now()}`,
            session_id: currentSessionId,
            role: 'assistant',
            content: result.reply || '',
            thinking_content: result.thinking || null,
            created_at: new Date().toISOString(),
          }];

      setMessages(prev => ({
        ...prev,
        [currentSessionId]: [
          ...(prev[currentSessionId] || []).filter(m => m.id !== userMsg.id),
          { ...userMsg, id: `user-${Date.now()}` },
          ...aiMsgs,
        ],
      }));

      // 刷新会话列表（更新 updated_at）
      loadSessions();
    } catch (err) {
      if (err.name === 'AbortError') {
        // 用户主动取消，不弹错误提示
        setMessages(prev => ({
          ...prev,
          [currentSessionId]: [
            ...(prev[currentSessionId] || []).filter(m => m.id !== userMsg.id),
            { ...userMsg, id: `user-${Date.now()}` },
          ],
        }));
        wasInterruptedRef.current = true;
      } else {
        alert('发送失败: ' + err.message);
        // 移除临时消息
        setMessages(prev => ({
          ...prev,
          [currentSessionId]: (prev[currentSessionId] || []).filter(m => m.id !== userMsg.id),
        }));
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentSessionId, loading, model, loadSessions, sessionChars]);

  // 中断 AI 生成
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      wasInterruptedRef.current = true;
    }
  }, []);

  // 模型切换
  const handleModelChange = useCallback((newModel) => {
    setModel(newModel);
    localStorage.setItem('bunny_model', newModel);
  }, []);

  // 设置
  const handleOpenSettings = useCallback(async () => {
    setSidebarOpen(false);
    try {
      const data = await api.getSettings();
      setSettings(data.settings);
    } catch (err) {
      console.error('加载设置失败:', err);
    }
    setShowSettings(true);
  }, []);

  // 技能管理
  const handleOpenSkillManager = useCallback(() => {
    setSidebarOpen(false);
    setShowSkillManager(true);
  }, []);

  const handleSaveSettings = useCallback(async (updates) => {
    try {
      const data = await api.updateSettings(updates);
      setSettings(data.settings);
      setShowSettings(false);
    } catch (err) {
      alert('保存设置失败: ' + err.message);
    }
  }, []);

  // 上传表情
  const handleUploadSticker = useCallback(async (base64) => {
    try {
      await api.uploadSticker(base64);
      await loadStickers();
    } catch (err) {
      alert('上传表情失败: ' + err.message);
    }
  }, [loadStickers]);

  const currentMessages = messages[currentSessionId] || [];

  // 当前会话的角色信息（localStorage → DB → 会话名推测 → 默认）
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentCharId = resolveCharacterId(currentSessionId, currentSession, sessionChars, characters);
  const currentChar = characters.find(c => c.id === currentCharId);
  const currentCharName = currentChar?.name
    || (currentCharId === 'shenye' ? '沈夜' : '小鹿');

  // 保存关键上下文
  const handleExtractContext = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      setLoading(true);
      const result = await api.extractContext(currentSessionId);
      setLoading(false);
      if (result.ok) {
        alert(`✅ ${result.message}\n\n摘要：${result.summary || ''}\n关键点：${(result.key_points || []).join('；')}`);
      } else {
        alert(result.message || '提取失败');
      }
    } catch (err) {
      setLoading(false);
      alert('提取失败: ' + err.message);
    }
  }, [currentSessionId]);

  // 手动压缩记忆
  const handleCompact = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const result = await api.compactChat(currentSessionId);
      alert(result.message || '压缩完成');
    } catch (err) {
      alert('压缩失败: ' + err.message);
    }
  }, [currentSessionId]);

  // 重新生成 AI 回复
  const handleRetry = useCallback(async () => {
    if (!currentSessionId || !model) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      setLoading(true);
      // 移除最后一条 AI 消息
      setMessages(prev => {
        const msgs = [...(prev[currentSessionId] || [])];
        while (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
          msgs.pop();
        }
        return { ...prev, [currentSessionId]: msgs };
      });
      const result = await api.retryChat(currentSessionId, model, controller.signal);
      if (result.aborted) return;
      const replies = result.replies || [];
      const aiMsgs = replies.length > 0
        ? replies.map((r, i) => ({
            id: r.messageId || `ai-${Date.now()}-${i}`,
            session_id: currentSessionId,
            role: 'assistant',
            content: r.content,
            thinking_content: r.thinking || null,
            created_at: new Date(Date.now() + i * 1000).toISOString(),
          }))
        : [{ id: result.messageId || `ai-${Date.now()}`, session_id: currentSessionId, role: 'assistant', content: result.reply || '', thinking_content: result.thinking || null, created_at: new Date().toISOString() }];
      setMessages(prev => ({
        ...prev,
        [currentSessionId]: [...(prev[currentSessionId] || []), ...aiMsgs],
      }));
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('重试失败: ' + err.message);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentSessionId, model]);

  // 撤回最后一条用户消息及后续 AI 回复
  const handleRetract = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const result = await api.retractMessage(currentSessionId);
      if (result.hidden > 0) {
        // 重新加载消息
        const data = await api.getSessionMessages(currentSessionId);
        setMessages(prev => ({ ...prev, [currentSessionId]: data.messages || [] }));
      }
    } catch (err) {
      alert('撤回失败: ' + err.message);
    }
  }, [currentSessionId]);

  // 清空当前会话的所有消息
  const handleClearHistory = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      await api.clearSessionMessages(currentSessionId);
      // 前端清除消息缓存
      setMessages(prev => ({ ...prev, [currentSessionId]: [] }));
      // 刷新会话列表（更新时间戳）
      loadSessions();
    } catch (err) {
      alert('清空失败: ' + err.message);
    }
  }, [currentSessionId, loadSessions]);

  return (
    <div className="app">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSwitch={switchSession}
        onNew={handleNewSession}
        onRename={handleRenameSession}
        onDelete={handleDeleteSession}
        onSettings={handleOpenSettings}
        onSkillManager={handleOpenSkillManager}
        characters={characters}
      />
      <ChatArea
        sessionId={currentSessionId}
        messages={currentMessages}
        loading={loading}
        model={model}
        models={MODELS}
        onSend={handleSendMessage}
        onStop={handleStopGeneration}
        onModelChange={handleModelChange}
        stickers={stickers}
        onUploadSticker={handleUploadSticker}
        messageListRef={messageListRef}
        onMenuClick={() => setSidebarOpen(true)}
        characterName={currentCharName}
        characterId={currentCharId}
        characters={characters}
        onClearHistory={handleClearHistory}
        onCompact={handleCompact}
        onRetry={handleRetry}
        onRetract={handleRetract}
        onExtractContext={handleExtractContext}
      />
      {showSettings && (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showSkillManager && (
        <SkillManager
          onClose={() => setShowSkillManager(false)}
        />
      )}
    </div>
  );
}
