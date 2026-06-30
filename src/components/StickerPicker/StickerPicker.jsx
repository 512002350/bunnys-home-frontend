import { useState, useRef, useCallback } from 'react';
import { searchStickers, searchExternalStickers, addExternalSticker as apiAddExternal } from '../../services/api';

export default function StickerPicker({ stickers, onSelect, onUpload, onClose }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('local'); // 'local' | 'search'
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const fileRef = useRef(null);
  const searchTimerRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.replace(/^data:image\/\w+;base64,/, '');
      onUpload(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 本地搜索（输完停 300ms 后触发）
  const handleSearchInput = useCallback((value) => {
    setQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!value.trim()) {
      setTab('local');
      setSearchResults([]);
      setSearchDone(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchDone(false);
      try {
        // 同时搜索本地 + 外源
        const [localRes, extRes] = await Promise.all([
          searchStickers(value).catch(() => ({ stickers: [] })),
          searchExternalStickers(value).catch(() => ({ stickers: [] })),
        ]);
        const combined = [
          ...(localRes.stickers || []).map(s => ({ ...s, source: 'local' })),
          ...(extRes.stickers || []).map(s => ({ ...s, source: 'external' })),
        ];
        setSearchResults(combined);
      } catch (_) {
        setSearchResults([]);
      } finally {
        setSearching(false);
        setSearchDone(true);
      }
    }, 300);
  }, []);

  // 添加外部表情到本地
  const handleAddExternal = async (sticker) => {
    try {
      await apiAddExternal(sticker.url, sticker.name, sticker.descr || '');
      // 标记为已添加
      setSearchResults(prev =>
        prev.map(s => s.id === sticker.id ? { ...s, added: true } : s)
      );
    } catch (err) {
      alert('添加失败: ' + err.message);
    }
  };

  // 本地表情列表
  const localStickers = tab === 'local'
    ? stickers
    : searchResults.filter(s => s.source === 'local');

  // 外源搜索结果
  const externalResults = tab === 'search' ? searchResults.filter(s => s.source === 'external') : [];

  return (
    <div className="sticker-panel">
      <div className="sticker-panel-header">
        <span className="sticker-panel-title">表情包</span>
        <button className="sticker-panel-close" onClick={onClose} title="关闭">✕</button>
      </div>

      {/* 搜索栏 */}
      <div className="sticker-search-bar">
        <input
          className="sticker-search-input"
          type="text"
          placeholder="搜索表情..."
          value={query}
          onChange={e => handleSearchInput(e.target.value)}
        />
        {query && (
          <button
            className="sticker-search-clear"
            onClick={() => { setQuery(''); setTab('local'); setSearchResults([]); setSearchDone(false); }}
          >✕</button>
        )}
      </div>

      {/* Tab 切换 */}
      {query && (
        <div className="sticker-tabs">
          <button
            className={`sticker-tab ${tab === 'local' ? 'active' : ''}`}
            onClick={() => setTab('local')}
          >
            本地 ({searchResults.filter(s => s.source === 'local').length})
          </button>
          <button
            className={`sticker-tab ${tab === 'search' ? 'active' : ''}`}
            onClick={() => setTab('search')}
          >
            在线 ({searchResults.filter(s => s.source === 'external').length})
          </button>
        </div>
      )}

      {/* 内容区 */}
      {searching ? (
        <div className="sticker-search-status">搜索中...</div>
      ) : (
        <>
          {/* 本地表情 / 本地搜索结果 */}
          <div className="sticker-panel-grid">
            {localStickers.map(s => (
              <img
                key={s.id}
                src={s.url}
                alt={s.name}
                title={`${s.name}: ${s.descr || ''}`}
                className="sticker-panel-item"
                onClick={() => onSelect(s)}
                loading="lazy"
              />
            ))}
            {/* 上传按钮（仅本地模式显示） */}
            {tab === 'local' && !query && (
              <div
                className="sticker-upload-area"
                onClick={() => fileRef.current?.click()}
                title="上传表情包"
              >+</div>
            )}
          </div>

          {/* 外源搜索结果 */}
          {tab === 'search' && externalResults.length > 0 && (
            <div className="sticker-panel-grid">
              {externalResults.map(s => (
                <div key={s.id} className="sticker-external-item">
                  <img
                    src={s.url}
                    alt={s.name}
                    className="sticker-panel-item"
                    loading="lazy"
                    onClick={() => s.added ? onSelect(s) : handleAddExternal(s)}
                  />
                  <button
                    className={`sticker-add-btn ${s.added ? 'added' : ''}`}
                    onClick={() => s.added ? onSelect(s) : handleAddExternal(s)}
                    title={s.added ? '已添加，点击发送' : '添加到本地'}
                  >
                    {s.added ? '✓' : '+'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 无结果 */}
          {tab === 'search' && searchDone && searchResults.length === 0 && (
            <div className="sticker-search-status">没有找到相关表情</div>
          )}

          {/* 外源有结果但未切换到该 tab */}
          {tab === 'local' && externalResults.length > 0 && (
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                还有 {externalResults.length} 个在线表情，切换 tab 查看
              </span>
            </div>
          )}
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
