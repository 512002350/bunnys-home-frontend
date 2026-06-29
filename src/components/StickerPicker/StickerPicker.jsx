import { useRef } from 'react';

export default function StickerPicker({ stickers, onSelect, onUpload, onClose }) {
  const fileRef = useRef(null);

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

  return (
    <div className="sticker-panel">
      <div className="sticker-panel-header">
        <span className="sticker-panel-title">表情包</span>
        <button className="sticker-panel-close" onClick={onClose} title="关闭">✕</button>
      </div>
      <div className="sticker-panel-grid">
        {stickers.map(s => (
          <img
            key={s.id}
            src={s.url.startsWith('data:') ? s.url : s.url}
            alt={s.name}
            title={`${s.name}: ${s.descr}`}
            className="sticker-panel-item"
            onClick={() => onSelect(s)}
          />
        ))}
        <div
          className="sticker-upload-area"
          onClick={() => fileRef.current?.click()}
          title="上传表情包"
        >+</div>
      </div>
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
