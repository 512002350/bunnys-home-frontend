import { useState } from 'react';
import { testSkill } from '../../services/api';

/**
 * SkillTestPanel — 测试技能组合效果
 * 选择组合蓝图 + 填入 context → 查看组装结果 + AI 模型回复
 */
export default function SkillTestPanel({ skills, compositions, onBack }) {
  const [compositionId, setCompositionId] = useState('');
  const [contextJson, setContextJson] = useState('{}');
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    setTesting(true);
    setError('');
    try {
      let context;
      try {
        context = JSON.parse(contextJson);
      } catch {
        setError('JSON 格式错误，请检查 context 输入');
        setTesting(false);
        return;
      }

      const res = await testSkill({
        compositionId,
        context,
        model: 'deepseek-chat',
      });
      setResult(res);
    } catch (err) {
      setError('测试失败: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="sm-test">
      <div className="sm-editor-top">
        <button className="sm-btn sm-btn-sm" onClick={onBack}>← 返回</button>
        <span>🧪 Prompt 测试</span>
      </div>

      <div className="sm-test-form">
        <div className="sm-field">
          <label>组合蓝图</label>
          <select className="sm-select" value={compositionId} onChange={e => setCompositionId(e.target.value)}>
            <option value="">-- 选择组合 --</option>
            {compositions.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>
        </div>

        <div className="sm-field">
          <label>Context (JSON)</label>
          <textarea
            className="sm-textarea"
            rows={6}
            value={contextJson}
            onChange={e => setContextJson(e.target.value)}
            placeholder='{"characterPrompt": "...", "healthSummary": "..."}'
          />
        </div>

        <button
          className="sm-btn sm-btn-primary"
          onClick={handleTest}
          disabled={testing || !compositionId}
        >
          {testing ? '测试中...' : '🚀 运行测试'}
        </button>
      </div>

      {error && <div className="sm-error">{error}</div>}

      {result && (
        <div className="sm-test-result">
          <div className="sm-test-section">
            <h4>📝 组装后的 System Prompt</h4>
            <pre className="sm-test-prompt">{result.system_prompt}</pre>
            <span className="sm-test-tokens">≈ {result.token_estimate || Math.round(result.system_prompt.length / 2)} tokens</span>
          </div>
          <div className="sm-test-section">
            <h4>🤖 AI 回复</h4>
            <div className="sm-test-response">{result.response}</div>
            <span className="sm-test-meta">模型: {result.model} | usage: {JSON.stringify(result.usage)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
