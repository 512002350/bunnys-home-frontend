import { useState, useEffect } from 'react';

/**
 * SkillEditor — 编辑技能内容
 * 支持 {{变量}} 语法高亮和实时预览
 */
export default function SkillEditor({ skill, onSave, onDelete, onBack }) {
  const [content, setContent] = useState(skill.content || '');
  const [name, setName] = useState(skill.name || '');
  const [description, setDescription] = useState(skill.description || '');
  const [tags, setTags] = useState((skill.tags || []).join(', '));
  const [changeSummary, setChangeSummary] = useState('');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(skill.content || '');
    setName(skill.name || '');
    setDescription(skill.description || '');
    setTags((skill.tags || []).join(', '));
  }, [skill]);

  const handlePreview = () => {
    // 高亮 {{变量}}
    const highlighted = content.replace(
      /{{([^}]+)}}/g,
      '<mark class="sm-var">{{$1}}</mark>'
    );
    setPreview(highlighted);
  };

  const handleSave = async () => {
    setSaving(true);
    const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);
    const success = await onSave({
      content,
      name,
      description,
      tags: tagsArr,
      change_summary: changeSummary || '编辑内容',
    });
    setSaving(false);
    if (success) setChangeSummary('');
  };

  const variableCount = (content.match(/{{[^}]+}}/g) || []).length;

  return (
    <div className="sm-editor">
      <div className="sm-editor-top">
        <button className="sm-btn sm-btn-sm" onClick={onBack}>← 返回列表</button>
        <div className="sm-editor-meta">
          <span className="sm-editor-id">{skill.id}</span>
          <span className="sm-editor-type">{skill.type}</span>
          <span className="sm-editor-version">v{skill.current_version}</span>
          {skill.is_builtin && <span className="sm-badge-builtin">内置</span>}
        </div>
      </div>

      <div className="sm-editor-fields">
        <div className="sm-field">
          <label>名称</label>
          <input className="sm-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="sm-field">
          <label>描述</label>
          <input className="sm-input" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="sm-field">
          <label>标签 (逗号分隔)</label>
          <input className="sm-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. character, BDSM, shenye" />
        </div>
      </div>

      <div className="sm-editor-content">
        <div className="sm-editor-toolbar">
          <span>内容 {variableCount > 0 && `· ${variableCount} 个变量`}</span>
          <button className="sm-btn sm-btn-sm" onClick={handlePreview}>👁 预览变量</button>
        </div>
        <textarea
          className="sm-content-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={20}
          spellCheck={false}
          placeholder="在此输入 Prompt 内容，支持 {{变量名}} 语法..."
        />
        {preview && (
          <div className="sm-preview-box">
            <div className="sm-preview-header">
              变量预览
              <button className="sm-btn sm-btn-sm" onClick={() => setPreview('')}>关闭</button>
            </div>
            <div className="sm-preview-content">
              {content.split(/({{[^}]+}})/g).map((part, i) =>
                part.startsWith('{{') && part.endsWith('}}')
                  ? <mark key={i} className="sm-var">{part}</mark>
                  : part
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sm-editor-actions">
        <div className="sm-field" style={{ flex: 1 }}>
          <input
            className="sm-input"
            placeholder="变更说明 (e.g. 调整了追问机制的措辞)"
            value={changeSummary}
            onChange={e => setChangeSummary(e.target.value)}
          />
        </div>
        <button className="sm-btn sm-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '💾 保存为新版本'}
        </button>
        <button className="sm-btn sm-btn-danger" onClick={onDelete}>
          🗑 删除
        </button>
      </div>
    </div>
  );
}
