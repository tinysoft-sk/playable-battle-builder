import { useBattleStore } from '../store/battleStore';
import type { AssetData } from '../types/battle';

interface Props {
  accept: string;
  onSelect: (a: AssetData) => void;
  onClose: () => void;
}

export default function LibraryPickerModal({ accept, onSelect, onClose }: Props) {
  const { library } = useBattleStore();
  const isAudio = accept.includes('audio');
  const filtered = library.filter(a =>
    isAudio ? a.mimeType.startsWith('audio/') : a.mimeType.startsWith('image/')
  );

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog lib-picker-dialog" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2>Library — pick {isAudio ? 'audio' : 'image'}</h2>
          <button className="asset-clear" style={{ fontSize: 18 }} onClick={onClose}>✕</button>
        </div>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            No {isAudio ? 'audio' : 'images'} saved yet. Upload an asset then click 💾 to save it.
          </p>
        ) : (
          <div className="library-grid">
            {filtered.map(a => (
              <button key={a.id} className="library-item" title={a.fileName} onClick={() => onSelect(a)}>
                {a.mimeType.startsWith('image/') ? (
                  <img src={a.dataUri} alt={a.fileName} />
                ) : (
                  <div className="lib-audio-icon">🔊</div>
                )}
                <span className="lib-item-name">{a.fileName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
