import { useState, useEffect } from 'react';
import { getSkillVersions, getSkillDiff } from '../../services/api';

/**
 * SkillVersionPanel — 版本历史时间线 + Diff 对比
 */
export default function SkillVersionPanel({ skillId, currentVersion, onRollback, onBack }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diffData, setDiffData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getSkillVersions(skillId);
        setVersions(res.versions || []);
      } catch (err) {
        console.error('加载版本历史失败:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [skillId]);

  const handleDiff = async (v1, v2) => {
    try {
      const res = await getSkillDiff(skillId, v1, v2);
      setDiffData(res);
    } catch (err) {
      alert('Diff 加载失败: ' + err.message);
    }
  };

  if (loading) return <div className="sm-loading">加载版本历史...</div>;

  return (
    <div className="sm-versions">
      <div className="sm-editor-top">
        <button className="sm-btn sm-btn-sm" onClick={onBack}>← 返回</button>
        <span className="sm-editor-id">{skillId} · 共 {versions.length} 个版本</span>
      </div>

      {diffData && (
        <div className="sm-diff-container">
          <div className="sm-diff-header">
            <span>v{diffData.v1} → v{diffData.v2}</span>
            <button className="sm-btn sm-btn-sm" onClick={() => setDiffData(null)}>关闭</button>
          </div>
          <pre className="sm-diff-content">{diffData.diff}</pre>
        </div>
      )}

      <div className="sm-version-list">
        {versions.map((v, i) => (
          <div key={v.id || i} className={`sm-version-item ${v.version === currentVersion ? 'current' : ''}`}>
            <div className="sm-version-num">v{v.version}</div>
            <div className="sm-version-info">
              <div className="sm-version-summary">{v.change_summary || '无变更说明'}</div>
              <div className="sm-version-meta">
                <span>{v.change_type}</span> · <span>{v.author}</span> ·{' '}
                <span>{new Date(v.created_at).toLocaleString('zh-CN')}</span>
              </div>
            </div>
            <div className="sm-version-actions">
              {i < versions.length - 1 && (
                <button
                  className="sm-btn sm-btn-sm"
                  onClick={() => handleDiff(v.version, versions[i + 1].version)}
                >对比前版</button>
              )}
              {v.version !== currentVersion && (
                <button
                  className="sm-btn sm-btn-sm sm-btn-warning"
                  onClick={() => {
                    if (confirm(`确定回滚到 v${v.version}？\n这将生成一个新版本，内容与 v${v.version} 相同。`)) {
                      onRollback(skillId, v.version);
                    }
                  }}
                >回滚至此</button>
              )}
              {v.version === currentVersion && <span className="sm-badge-current">当前</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
