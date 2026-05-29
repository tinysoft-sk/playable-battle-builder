import { useBattleStore } from '../store/battleStore';

export default function LibraryPanel() {
  const { library, removeFromLibrary } = useBattleStore();

  return (
    <div>
      <div className="panel-title">Asset Library</div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Upload an asset anywhere, then click 💾 to save it here. Pick it later from any upload slot via "📚 Library".
      </p>
      {library.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Library is empty.</div>
      ) : (
        <div className="library-grid">
          {library.map(a => (
            <div key={a.id} className="library-item library-item-manage">
              {a.mimeType.startsWith('image/') ? (
                <img src={a.dataUri} alt={a.fileName} />
              ) : (
                <div className="lib-audio-icon">🔊</div>
              )}
              <span className="lib-item-name">{a.fileName}</span>
              <button
                className="lib-del-btn"
                title="Remove from library"
                onClick={() => removeFromLibrary(a.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
