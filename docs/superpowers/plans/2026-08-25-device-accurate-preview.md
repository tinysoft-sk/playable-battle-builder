# Device-Accurate Live Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor's Live Preview panel size its iframe to real device pixel dimensions (selectable via a dropdown), so the exported playable's own resize logic computes against true device numbers instead of an arbitrary percentage of the editor's layout — while still visually fitting on screen via an outer scale-to-fit transform.

**Architecture:** Single-file change to `src/components/preview/LivePreview.tsx`. The iframe gets fixed CSS-pixel `width`/`height` matching a selected device preset (swapped by orientation); a `ResizeObserver` on the existing `.preview-wrap` container computes a display-only `transform: scale()` so the true-sized iframe still fits the visible pane. No changes to `htmlGenerator.ts`, the exported playable's own layout/scaling code, or any other component.

**Tech Stack:** React 18, TypeScript, the browser's native `ResizeObserver` API (no new dependency).

## Global Constraints

- No change to what HTML is generated (`generateHTML` call, its args, the debounced-refresh-on-config-change behavior, or the Restart button's behavior) — this plan only changes how the iframe is *sized* on screen.
- Default device selection must be "Design (563×1000)" so the preview's default appearance is unchanged from today unless a user actively picks a different device from the dropdown.
- The iframe's actual `width`/`height` (which determine what its own internal JS reads as `window.innerWidth`/`innerHeight`) must be the device's true pixel dimensions — never scaled down in the DOM. Only the wrapping `<div>`'s CSS `transform: scale()` may shrink the *visual* size for display.

---

### Task 1: Device-accurate preview sizing

**Files:**
- Modify: `src/components/preview/LivePreview.tsx`

**Interfaces:**
- Consumes: nothing new — same `useBattleStore`, `generateHTML` as before.
- Produces: nothing new for other files to consume — this component's external usage (`<LivePreview />` in `App.tsx`, no props) is unchanged.

- [ ] **Step 1: Replace the file's contents**

Replace the entire contents of `src/components/preview/LivePreview.tsx` with:

```tsx
import { useRef, useEffect, useState, useCallback } from 'react';
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
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function computeScale() {
      const availW = wrap!.clientWidth;
      const availH = wrap!.clientHeight;
      setFitScale(Math.min(availW / frameW, availH / frameH, 1));
    }
    computeScale();
    const observer = new ResizeObserver(computeScale);
    observer.observe(wrap);
    return () => observer.disconnect();
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
```

Note: `.preview-wrap` in `src/App.css` already has `position: relative` (needed for the wrapper div's `position: absolute` centering to work) and `overflow: hidden` (needed so a not-yet-scaled-down frame never visually spills out during the first render before `ResizeObserver`'s first callback fires) — no CSS changes are needed for this task.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both must be green (no test coverage exists for this component — this is a live-browser-verified change, not a test-driven one, consistent with how this codebase handles all UI components).

Manually: start the dev server, confirm the Live Preview still renders at its default "Design (563×1000)" selection with no visible change from before. Switch the device dropdown to "iPhone 14" — confirm the preview visibly shrinks/reflows to a taller, narrower aspect ratio, and (open the browser's own dev tools inside the iframe if convenient, or trust the architecture) that the game content now shows letterboxing (empty bars) rather than distortion. Toggle Landscape/Portrait with a phone preset selected — confirm width/height swap correctly. Resize the browser window and confirm the preview scales down/up smoothly via the `ResizeObserver`. Click Restart with a device selected — confirm it still restarts the same scenario at the same device size.

- [ ] **Step 3: Commit**

```bash
git add src/components/preview/LivePreview.tsx
git commit -m "app: size the live preview iframe to real device dimensions with a device picker"
```

---

### Task 2: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check and test suite**

Run: `npx tsc --noEmit` and `npm test -- --run`.
Expected: no errors, all existing tests passing.

- [ ] **Step 2: Live-browser regression pass**

Start the dev server. For each of at least 3 different device presets (including "Design" as the baseline and at least one notably taller phone like "iPhone 14" or "Pixel 7"):
- Confirm the preview renders without console errors.
- Confirm switching between Landscape/Portrait correctly swaps the frame's width/height for that device.
- Confirm the visual scale-to-fit behaves sensibly as the browser window is resized (the preview shrinks/grows smoothly, never overflows `.preview-wrap`).
- Confirm editing a field elsewhere in the editor (e.g. a unit's HP) still triggers the debounced preview refresh at the currently-selected device size — the device/orientation selection must persist across a config-driven refresh, not reset to the default.
- Confirm Restart still works.

Report the outcome of each check. If anything regressed, fix it before considering the plan complete.

No commit for this task — it's verification only.
