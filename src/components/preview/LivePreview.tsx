import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useBattleStore } from '../../store/battleStore';
import { generateHTML } from '../../utils/htmlGenerator';

type Orientation = 'landscape' | 'portrait';

interface DevicePreset { label: string; w: number; h: number; }

const DEVICE_PRESETS: DevicePreset[] = [
  { label: 'Design (563×1000)', w: 563, h: 1000 },
  { label: 'iPhone SE (375×667)', w: 375, h: 667 },
  { label: 'iPhone 14 (390×844)', w: 390, h: 844 },
  { label: 'iPhone 14 Pro Max (430×932)', w: 430, h: 932 },
  { label: 'Pixel 7 (412×915)', w: 412, h: 915 },
  { label: 'Galaxy S21 (360×800)', w: 360, h: 800 },
  { label: 'Ultra-tall 21:9 (360×840)', w: 360, h: 840 },
];

export default function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [orient, setOrient] = useState<Orientation>('landscape');
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  const config = useBattleStore(s => s.config);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to the latest HTML so restart can access it without stale closure
  const htmlRef = useRef('');

  const device = DEVICE_PRESETS[deviceIdx];
  const frameW = orient === 'landscape' ? device.h : device.w;
  const frameH = orient === 'landscape' ? device.w : device.h;

  const refresh = useCallback(() => {
    if (!iframeRef.current) return;
    try {
      const html = generateHTML(config, 'unity', { showUnitNames: true });
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

  // Recompute the display-only fit scale whenever the selected device/orientation
  // or the available pane size changes. This never touches the iframe's own
  // width/height — only a wrapping div's CSS transform — so the iframe's own
  // window.innerWidth/innerHeight (read by the exported playable's own resize
  // logic) always reflects the true selected device size.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function computeScale() {
      const availW = wrap!.clientWidth;
      const availH = wrap!.clientHeight;
      if (availW === 0 || availH === 0) return;
      setFitScale(Math.min(availW / frameW, availH / frameH, 1));
    }
    computeScale();
    const raf = requestAnimationFrame(computeScale);
    const observer = new ResizeObserver(computeScale);
    observer.observe(wrap);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [frameW, frameH]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="preview-toolbar">
        <span>Live Preview</span>
        <select
          value={deviceIdx}
          onChange={e => setDeviceIdx(+e.target.value)}
          aria-label="Preview device"
        >
          {DEVICE_PRESETS.map((d, i) => (
            <option key={d.label} value={i}>{d.label}</option>
          ))}
        </select>
        <button
          onClick={() => { setOrient(o => o === 'landscape' ? 'portrait' : 'landscape'); }}
          title="Toggle orientation"
        >
          {orient === 'landscape' ? '📱 Portrait' : '🖥 Landscape'}
        </button>
        <button onClick={handleRestart} title="Restart">↺ Restart</button>
      </div>
      <div className="preview-wrap" ref={wrapRef}>
        <div
          style={{
            width: frameW,
            height: frameH,
            transform: `scale(${fitScale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -(frameW * fitScale) / 2,
            marginTop: -(frameH * fitScale) / 2,
          }}
        >
          <iframe
            ref={iframeRef}
            className="preview-frame"
            style={{ width: frameW, height: frameH, display: 'block' }}
            sandbox="allow-scripts allow-same-origin"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
}
