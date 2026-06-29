/**
 * API 调用层 —— 所有与后端的通信都从这里走
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
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

export async function createSession(name) {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
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

export async function getSessionMessages(sessionId) {
  return request(`/api/sessions/${sessionId}/messages`);
}

// ---- 对话 ----

export async function sendMessage(sessionId, message, model) {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message, model }),
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
