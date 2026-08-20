import { useBattleStore } from '../store/battleStore';

export default function LibraryPanel() {
  const { library, removeFromLibrary, pendingPublishes, retryPublish } = useBattleStore();
  const failed = Object.entries(pendingPublishes).filter(([, p]) => p.status === 'failed');

  return (
    <div>
      <div className="panel-title">Asset Library</div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Upload an asset anywhere, then click 💾 to save it here. Pick it later from any upload slot via "📚 Library".
      </p>
      {failed.length > 0 && (
        <div style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{failed.length} upload{failed.length > 1 ? 's' : ''} not yet synced to the shared library.</span>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => failed.forEach(([id]) => retryPublish(id))}>
            Retry
          </button>
        </div>
      )}
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
