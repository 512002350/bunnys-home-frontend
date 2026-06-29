import { useRef } from 'react';

export default function StickerPicker({ stickers, onSelect, onUpload }) {
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
