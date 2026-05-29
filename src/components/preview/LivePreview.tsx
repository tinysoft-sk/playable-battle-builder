import { useRef, useEffect, useState, useCallback } from 'react';
import { useBattleStore } from '../../store/battleStore';
import { generateHTML } from '../../utils/htmlGenerator';

type Orientation = 'landscape' | 'portrait';

export default function LivePreview() {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [orient, setOrient] = useState<Orientation>('landscape');
  const [key, setKey] = useState(0);
  const config = useBattleStore(s => s.config);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const html = generateHTML(config, 'facebook');
      iframeRef.current.srcdoc = html;
    } catch (e) {
      console.error('Preview error', e);
    }
  }, [config]);

  // debounced refresh on config change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [refresh]);

  const frameStyle: React.CSSProperties = orient === 'landscape'
    ? { width: '100%', height: '100%' }
    : { width: '56.3%', height: '100%', margin: '0 auto', display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="preview-toolbar">
        <span>Live Preview</span>
        <button
          onClick={() => { setOrient(o => o === 'landscape' ? 'portrait' : 'landscape'); }}
          title="Toggle orientation"
        >
          {orient === 'landscape' ? '📱 Portrait' : '🖥 Landscape'}
        </button>
        <button onClick={() => setKey(k => k + 1)} title="Restart">↺ Restart</button>
      </div>
      <div className="preview-wrap">
        <iframe
          key={key}
          ref={iframeRef}
          className="preview-frame"
          style={frameStyle}
          sandbox="allow-scripts allow-same-origin"
          title="Live Preview"
        />
      </div>
    </div>
  );
}
