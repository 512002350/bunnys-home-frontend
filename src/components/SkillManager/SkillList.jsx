import { useState } from 'react';

const TYPE_LABELS = {
  character: '👤 角色',
  tool: '🔧 工具',
  style: '🎨 风格',
  instruction: '📋 指令',
  template: '📄 模板',
  variable: '🔤 变量',
};

export default function SkillList({
  skills, filterType, filterCategory, searchQuery,
  onFilterType, onFilterCategory, onSearch,
  onSelect, onDelete, onCreate, compositions,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newSkill, setNewSkill] = useState({ id: '', name: '', type: 'tool', content: '' });

  const categories = [...new Set(skills.map(s => s.category).filter(Boolean))];

  const handleCreate = () => {
    if (!newSkill.id || !newSkill.name || !newSkill.content) {
      alert('请填写 id、名称和内容');
      return;
    }
    onCreate(newSkill);
    setNewSkill({ id: '', name: '', type: 'tool', content: '' });
    setShowCreate(false);
  };

  return (
    <div className="sm-list">
      <div className="sm-filters">
        <input
          type="text"
          className="sm-search"
          placeholder="🔍 搜索技能..."
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
        <select className="sm-select" value={filterType} onChange={e => onFilterType(e.target.value)}>
          <option value="">全部类型</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="sm-select" value={filterCategory} onChange={e => onFilterCategory(e.target.value)}>
          <option value="">全部分类</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="sm-btn sm-btn-primary" onClick={() => setShowCreate(!showCreate)}>
          ＋ 新建
        </button>
      </div>

      {showCreate && (
        <div className="sm-create-form">
          <input className="sm-input" placeholder="ID (e.g. my-skill)" value={newSkill.id}
            onChange={e => setNewSkill({ ...newSkill, id: e.target.value })} />
          <input className="sm-input" placeholder="名称" value={newSkill.name}
            onChange={e => setNewSkill({ ...newSkill, name: e.target.value })} />
          <select className="sm-select" value={newSkill.type}
            onChange={e => setNewSkill({ ...newSkill, type: e.target.value })}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <textarea className="sm-textarea" placeholder="Prompt 内容..." rows={4}
            value={newSkill.content}
            onChange={e => setNewSkill({ ...newSkill, content: e.target.value })} />
          <button className="sm-btn sm-btn-primary" onClick={handleCreate}>创建</button>
        </div>
      )}

      <div className="sm-skill-grid">
        {skills.map(skill => (
          <div
            key={skill.id}
            className={`sm-skill-card ${!skill.enabled ? 'disabled' : ''}`}
            onClick={() => onSelect(skill)}
          >
            <div className="sm-card-header">
              <span className="sm-card-type">{TYPE_LABELS[skill.type] || skill.type}</span>
              <span className="sm-card-version">v{skill.current_version}</span>
              {skill.is_builtin && <span className="sm-badge-builtin">内置</span>}
              {!skill.enabled && <span className="sm-badge-disabled">已禁用</span>}
            </div>
            <div className="sm-card-name">{skill.name}</div>
            <div className="sm-card-id">{skill.id}</div>
            {skill.description && <div className="sm-card-desc">{skill.description}</div>}
            {skill.tags && skill.tags.length > 0 && (
              <div className="sm-card-tags">
                {skill.tags.slice(0, 4).map(t => <span key={t} className="sm-tag">{t}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
