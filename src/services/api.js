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

  // 网络错误重试（Render 免费层冷启动可能导致前几次连接重置）
  const MAX_RETRIES = 2;
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        // AbortError 不解析 body（已被取消）
        if (response.status === 499 || config.signal?.aborted) {
          throw Object.assign(new Error('请求已取消'), { name: 'AbortError' });
        }
        const error = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(error.error || error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      lastError = err;
      // AbortError 不重试
      if (err.name === 'AbortError') throw err;
      // 最后一次尝试也失败，抛出
      if (attempt === MAX_RETRIES) throw err;
      // 退避重试
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
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

export async function sendMessage(sessionId, message, model, character, typingMetrics, imageDescription, signal) {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message, model, character, typingMetrics, imageDescription }),
    signal,
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

export async function retractMessage(sessionId) {
  return request('/api/chat/retract', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function retryChat(sessionId, model, signal) {
  return request('/api/chat/retry', {
    method: 'POST',
    body: JSON.stringify({ sessionId, model }),
    signal,
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

export async function searchStickers(query) {
  return request(`/api/stickers/search?q=${encodeURIComponent(query)}`);
}

export async function searchExternalStickers(query) {
  return request(`/api/stickers/external/search?q=${encodeURIComponent(query)}`);
}

export async function addExternalSticker(imageUrl, name, descr) {
  return request('/api/stickers/external/add', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, name, descr }),
  });
}

// ---- 技能/提示词管理 ----

export async function getSkills(params = {}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.category) qs.set('category', params.category);
  if (params.enabled !== undefined) qs.set('enabled', params.enabled);
  if (params.search) qs.set('search', params.search);
  if (params.tags) qs.set('tags', params.tags.join(','));
  const query = qs.toString();
  return request(`/api/skills${query ? '?' + query : ''}`);
}

export async function getSkill(id, version) {
  const query = version ? `?version=${version}` : '';
  return request(`/api/skills/${id}${query}`);
}

export async function createSkill(data) {
  return request('/api/skills', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSkill(id, data) {
  return request(`/api/skills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSkill(id) {
  return request(`/api/skills/${id}`, {
    method: 'DELETE',
  });
}

export async function getSkillVersions(id) {
  return request(`/api/skills/${id}/versions`);
}

export async function getSkillVersion(id, version) {
  return request(`/api/skills/${id}/versions/${version}`);
}

export async function getSkillDiff(id, v1, v2) {
  return request(`/api/skills/${id}/diff?v1=${v1}&v2=${v2}`);
}

export async function rollbackSkill(id, version, changeSummary, author) {
  return request(`/api/skills/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version, change_summary: changeSummary, author: author || 'ui' }),
  });
}

export async function getCompositions() {
  return request('/api/skills/compositions');
}

export async function getComposition(id) {
  return request(`/api/skills/compositions/${id}`);
}

export async function updateComposition(id, data) {
  return request(`/api/skills/compositions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function previewComposition(id, context) {
  return request(`/api/skills/compositions/${id}/preview`, {
    method: 'POST',
    body: JSON.stringify({ context }),
  });
}

export async function reloadSkills() {
  return request('/api/skills/reload', { method: 'POST' });
}

export async function reloadSkill(id) {
  return request(`/api/skills/reload/${id}`, { method: 'POST' });
}

export async function testSkill(data) {
  return request('/api/skills/test', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
