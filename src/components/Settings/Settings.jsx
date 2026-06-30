import { useState } from 'react';

export default function Settings({ settings, onSave, onClose }) {
  const [form, setForm] = useState({
    system_prompt: settings?.system_prompt || '',
    temperature: settings?.temperature ?? 0.7,
    context_rounds: settings?.context_rounds ?? 10,
    compression_threshold_tokens: settings?.compression_threshold_tokens ?? 8000,
    compressed_rounds_to_keep: settings?.compressed_rounds_to_keep ?? 3,
    max_response_tokens: settings?.max_response_tokens ?? 2048,
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateNumeric = (value, fieldName, min, max) => {
    const num = fieldName === 'temperature' ? parseFloat(value) : parseInt(value);
    if (isNaN(num)) { alert(`${fieldName} 必须是数字`); return null; }
    if (num < min || num > max) { alert(`${fieldName} 范围: ${min}–${max}`); return null; }
    return num;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const temp = validateNumeric(form.temperature, 'Temperature', 0, 2);
    if (temp === null) return;
    const rounds = validateNumeric(form.context_rounds, '上下文轮数', 2, 50);
    if (rounds === null) return;
    const threshold = validateNumeric(form.compression_threshold_tokens, '压缩阈值', 1000, 100000);
    if (threshold === null) return;
    const keep = validateNumeric(form.compressed_rounds_to_keep, '保留轮数', 1, 20);
    if (keep === null) return;
    const maxTokens = validateNumeric(form.max_response_tokens, '最大回复 token', 256, 32000);
    if (maxTokens === null) return;

    onSave({
      ...form,
      temperature: temp,
      context_rounds: rounds,
      compression_threshold_tokens: threshold,
      compressed_rounds_to_keep: keep,
      max_response_tokens: maxTokens,
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <h2>⚙ 系统设置</h2>

        <form onSubmit={handleSubmit}>
          <div className="setting-group">
            <label>系统提示词（定义 AI 人格与写作风格）</label>
            <textarea
              value={form.system_prompt}
              onChange={e => handleChange('system_prompt', e.target.value)}
              placeholder="你是一个温柔友善的 AI 伴侣..."
              rows={4}
            />
          </div>

          <div className="setting-group">
            <label>Temperature（创造性）: {form.temperature}</label>
            <input
              type="range"
              min="0" max="2" step="0.1"
              value={form.temperature}
              onChange={e => handleChange('temperature', e.target.value)}
            />
            <div className="range-labels">
              <span>更确定 (0)</span>
              <span>更创造 (2)</span>
            </div>
          </div>

          <div className="setting-group">
            <label>上下文保留轮数（最近 N 轮原样保留）</label>
            <input
              type="number"
              min="2" max="50"
              value={form.context_rounds}
              onChange={e => handleChange('context_rounds', e.target.value)}
            />
          </div>

          <div className="setting-group">
            <label>压缩触发阈值（token）</label>
            <input
              type="number"
              min="1000" max="100000" step="500"
              value={form.compression_threshold_tokens}
              onChange={e => handleChange('compression_threshold_tokens', e.target.value)}
            />
          </div>

          <div className="setting-group">
            <label>压缩后保留轮数</label>
            <input
              type="number"
              min="1" max="20"
              value={form.compressed_rounds_to_keep}
              onChange={e => handleChange('compressed_rounds_to_keep', e.target.value)}
            />
          </div>

          <div className="setting-group">
            <label>最大回复 token 数</label>
            <input
              type="number"
              min="256" max="32000" step="256"
              value={form.max_response_tokens}
              onChange={e => handleChange('max_response_tokens', e.target.value)}
            />
          </div>

          <div className="settings-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary">保存设置</button>
          </div>
        </form>
      </div>
    </div>
  );
}
