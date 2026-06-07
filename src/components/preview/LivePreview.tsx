import { useRef, useEffect, useState, useCallback } from 'react';
import { useBattleStore } from '../../store/battleStore';
import { generateHTML } from '../../utils/htmlGenerator';

type Orientation = 'landscape' | 'portrait';

export default function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [orient, setOrient] = useState<Orientation>('landscape');
  const config = useBattleStore(s => s.config);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to the latest HTML so restart can access it without stale closure
  const htmlRef = useRef('');

  const refresh = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const html = generateHTML(config, 'unity');
      htmlRef.current = html;
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

  // Restart: clear srcdoc then re-inject on the same iframe element
  const handleRestart = useCallback(() => {
    if (!iframeRef.current) return;
    iframeRef.current.srcdoc = '';
    requestAnimationFrame(() => {
      if (iframeRef.current) iframeRef.current.srcdoc = htmlRef.current;
    });
  }, []);

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
        <button onClick={handleRestart} title="Restart">↺ Restart</button>
      </div>
      <div className="preview-wrap">
        <iframe
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
