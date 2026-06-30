import { useState, useEffect, useCallback } from 'react';
import SkillList from './SkillList';
import SkillEditor from './SkillEditor';
import SkillVersionPanel from './SkillVersionPanel';
import SkillTestPanel from './SkillTestPanel';
import {
  getSkills, createSkill, updateSkill, deleteSkill,
  getSkillVersions, rollbackSkill, getCompositions,
  reloadSkills,
} from '../../services/api';

/**
 * SkillManager — 技能/提示词管理中心总面板
 * 沿用 Settings.jsx 的 overlay 模式
 */
export default function SkillManager({ onClose }) {
  const [skills, setSkills] = useState([]);
  const [compositions, setCompositions] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'editor' | 'versions' | 'test'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 筛选
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [skillsRes, compsRes] = await Promise.all([
        getSkills(),
        getCompositions().catch(() => ({ compositions: [] })),
      ]);
      setSkills(skillsRes.skills || []);
      setCompositions(compsRes.compositions || []);
      setError('');
    } catch (err) {
      setError('加载技能数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectSkill = (skill) => {
    setSelectedSkill(skill);
    setActiveTab('editor');
  };

  const handleSave = async (id, data) => {
    try {
      const res = await updateSkill(id, {
        content: data.content,
        name: data.name,
        description: data.description,
        tags: data.tags,
        change_summary: data.change_summary || '手动更新',
      });
      setSelectedSkill(res.skill);
      await loadData();
      return true;
    } catch (err) {
      alert('保存失败: ' + err.message);
      return false;
    }
  };

  const handleCreate = async (data) => {
    try {
      await createSkill(data);
      await loadData();
    } catch (err) {
      alert('创建失败: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(`确定删除技能 ${id}？此操作不可恢复。`)) return;
    try {
      await deleteSkill(id);
      setSelectedSkill(null);
      setActiveTab('list');
      await loadData();
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  };

  const handleRollback = async (skillId, version) => {
    try {
      const res = await rollbackSkill(skillId, version);
      setSelectedSkill(res.skill);
      await loadData();
      alert(`已回滚至 v${version}`);
    } catch (err) {
      alert('回滚失败: ' + err.message);
    }
  };

  const handleReloadAll = async () => {
    try {
      await reloadSkills();
      await loadData();
      alert('全部技能已重新加载');
    } catch (err) {
      alert('重载失败: ' + err.message);
    }
  };

  const filteredSkills = skills.filter(s => {
    if (filterType && s.type !== filterType) return false;
    if (filterCategory && s.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="skill-manager-overlay" onClick={onClose}>
      <div className="skill-manager-panel" onClick={e => e.stopPropagation()}>
        <div className="skill-manager-header">
          <h2>🧩 技能/提示词管理中心</h2>
          <div className="skill-manager-header-actions">
            <button className="sm-btn sm-btn-sm" onClick={handleReloadAll} title="全量热重载">
              🔄 热重载
            </button>
            <button className="sm-btn sm-btn-sm" onClick={onClose}>✕ 关闭</button>
          </div>
        </div>

        {loading ? (
          <div className="sm-loading">加载中...</div>
        ) : error ? (
          <div className="sm-error">{error}</div>
        ) : (
          <div className="skill-manager-body">
            <div className="sm-tabs">
              <button
                className={`sm-tab ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
              >📋 技能列表 ({filteredSkills.length})</button>
              {selectedSkill && (
                <button
                  className={`sm-tab ${activeTab === 'editor' ? 'active' : ''}`}
                  onClick={() => setActiveTab('editor')}
                >✏️ 编辑</button>
              )}
              {selectedSkill && (
                <button
                  className={`sm-tab ${activeTab === 'versions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('versions')}
                >📜 版本历史</button>
              )}
              <button
                className={`sm-tab ${activeTab === 'test' ? 'active' : ''}`}
                onClick={() => setActiveTab('test')}
              >🧪 测试</button>
            </div>

            <div className="sm-content">
              {activeTab === 'list' && (
                <SkillList
                  skills={filteredSkills}
                  filterType={filterType}
                  filterCategory={filterCategory}
                  searchQuery={searchQuery}
                  onFilterType={setFilterType}
                  onFilterCategory={setFilterCategory}
                  onSearch={setSearchQuery}
                  onSelect={handleSelectSkill}
                  onDelete={handleDelete}
                  onCreate={handleCreate}
                  compositions={compositions}
                />
              )}
              {activeTab === 'editor' && selectedSkill && (
                <SkillEditor
                  skill={selectedSkill}
                  onSave={(data) => handleSave(selectedSkill.id, data)}
                  onDelete={() => handleDelete(selectedSkill.id)}
                  onBack={() => setActiveTab('list')}
                />
              )}
              {activeTab === 'versions' && selectedSkill && (
                <SkillVersionPanel
                  skillId={selectedSkill.id}
                  currentVersion={selectedSkill.current_version}
                  onRollback={handleRollback}
                  onBack={() => setActiveTab('list')}
                />
              )}
              {activeTab === 'test' && (
                <SkillTestPanel
                  skills={skills}
                  compositions={compositions}
                  onBack={() => setActiveTab('list')}
                />
              )}
            </div>
          </div>
        )}

        <div className="sm-statusbar">
          共 {skills.length} 个技能 · {compositions.length} 个组合 · 已启用 {skills.filter(s => s.enabled).length}/{skills.length}
        </div>
      </div>
    </div>
  );
}
