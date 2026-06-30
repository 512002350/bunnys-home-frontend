/**
 * API 调用层 —— 所有与后端的通信都从这里走
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ---- 会话 ----

export async function getSessions() {
  return request('/api/sessions');
}

export async function createSession(name, character) {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name, character }),
  });
}

// ---- 角色 ----

export async function getCharacters() {
  return request('/api/characters');
}

export async function renameSession(id, name) {
  return request(`/api/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteSession(id) {
  return request(`/api/sessions/${id}`, {
    method: 'DELETE',
  });
}

export async function clearSessionMessages(sessionId) {
  return request(`/api/sessions/${sessionId}/messages`, {
    method: 'DELETE',
  });
}

export async function getSessionMessages(sessionId) {
  return request(`/api/sessions/${sessionId}/messages`);
}

// ---- 对话 ----

export async function sendMessage(sessionId, message, model, character, typingMetrics, imageDescription) {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message, model, character, typingMetrics, imageDescription }),
  });
}

export async function uploadChatImage(sessionId, imageBase64, mimeType) {
  return request('/api/chat/upload-image', {
    method: 'POST',
    body: JSON.stringify({ sessionId, imageBase64, mimeType }),
  });
}

export async function sendTypingEvent(sessionId, type, data) {
  return request('/api/chat/typing-event', {
    method: 'POST',
    body: JSON.stringify({ sessionId, type, data }),
  });
}

export async function compactChat(sessionId) {
  return request('/api/chat/compact', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function retryChat(sessionId, model) {
  return request('/api/chat/retry', {
    method: 'POST',
    body: JSON.stringify({ sessionId, model }),
  });
}

export async function extractContext(sessionId) {
  return request('/api/chat/extract-context', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

// ---- 设置 ----

export async function getSettings() {
  return request('/api/settings');
}

export async function updateSettings(updates) {
  return request('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ---- 表情包 ----

export async function getStickers() {
  return request('/api/stickers');
}

export async function uploadSticker(imageBase64) {
  return request('/api/stickers/upload', {
    method: 'POST',
    body: JSON.stringify({ imageBase64 }),
  });
}

export async function deleteSticker(id) {
  return request(`/api/stickers/${id}`, {
    method: 'DELETE',
  });
}
