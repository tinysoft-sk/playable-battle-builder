import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function PopupsPanel() {
  const { config, setPopups, setAppIcon, setHintLayout, setSpeechLayout } = useBattleStore();
  const { popups } = config;
  const hintLayout = config.hintLayout ?? { landscapeY: 265, portraitY: 265, landscapeFontSize: 13.5, portraitFontSize: 13.5 };
  const speechLayout = config.speechLayout ?? { landscapeX: 160, landscapeY: 14, landscapeFontSize: 13, portraitX: 14, portraitY: 14, portraitFontSize: 13 };

  return (
    <div>
      <div className="panel-title">Popups</div>

      <div className="popup-section" style={{ marginBottom: 14 }}>
        <div className="popup-section-title">App Icon</div>
        <div className="field">
          <label>Icon shown in win/defeat screens</label>
          <AssetUpload label="App icon" asset={config.appIcon ?? null}
            onChange={a => setAppIcon(a)} />
        </div>
      </div>

      <div className="popup-section">
        <div className="popup-section-title">Victory Popup</div>
        <div className="field">
          <label>Banner Image</label>
          <AssetUpload label="Victory banner" asset={popups.victory.bannerAsset}
            onChange={a => setPopups({ victory: { ...popups.victory, bannerAsset: a } })} />
        </div>
        <div className="field">
          <label>Board Image</label>
          <AssetUpload label="Victory board" asset={popups.victory.boardAsset}
            onChange={a => setPopups({ victory: { ...popups.victory, boardAsset: a } })} />
        </div>
        <div className="field">
          <label>CTA Button Image</label>
          <AssetUpload label="CTA button" asset={popups.victory.ctaButtonAsset}
            onChange={a => setPopups({ victory: { ...popups.victory, ctaButtonAsset: a } })} />
        </div>
      </div>

      <div className="popup-section">
        <div className="popup-section-title">Defeat Popup</div>
        <div className="field">
          <label>Banner Image</label>
          <AssetUpload label="Defeat banner" asset={popups.defeat.bannerAsset}
            onChange={a => setPopups({ defeat: { ...popups.defeat, bannerAsset: a } })} />
        </div>
        <div className="field">
          <label>Board Image</label>
          <AssetUpload label="Defeat board" asset={popups.defeat.boardAsset}
            onChange={a => setPopups({ defeat: { ...popups.defeat, boardAsset: a } })} />
        </div>
        <div className="field">
          <label>Retry Button Image</label>
          <AssetUpload label="Retry button" asset={popups.defeat.retryButtonAsset}
            onChange={a => setPopups({ defeat: { ...popups.defeat, retryButtonAsset: a } })} />
        </div>
        <div className="field">
          <label>Store Button Image</label>
          <AssetUpload label="Store button" asset={popups.defeat.storeButtonAsset}
            onChange={a => setPopups({ defeat: { ...popups.defeat, storeButtonAsset: a } })} />
        </div>
        <div className="field">
          <label>Hint Text Color</label>
          <input
            type="color"
            value={popups.defeat.hintTextColor}
            onChange={e => setPopups({ defeat: { ...popups.defeat, hintTextColor: e.target.value } })}
          />
        </div>
        <div className="section-title" style={{ marginTop: 10 }}>Hint Text Position &amp; Size</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          Y position is from the top of the popup board. Adjust per orientation.
        </p>
        <div className="row">
          <div className="field">
            <label>Landscape Y</label>
            <input type="number" step={5} value={hintLayout.landscapeY}
              onChange={e => setHintLayout({ landscapeY: +e.target.value })} />
          </div>
          <div className="field">
            <label>Portrait Y</label>
            <input type="number" step={5} value={hintLayout.portraitY}
              onChange={e => setHintLayout({ portraitY: +e.target.value })} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Landscape font size</label>
            <input type="number" step={0.5} min={8} max={32} value={hintLayout.landscapeFontSize}
              onChange={e => setHintLayout({ landscapeFontSize: +e.target.value })} />
          </div>
          <div className="field">
            <label>Portrait font size</label>
            <input type="number" step={0.5} min={8} max={32} value={hintLayout.portraitFontSize}
              onChange={e => setHintLayout({ portraitFontSize: +e.target.value })} />
          </div>
        </div>
      </div>

      <div className="popup-section">
        <div className="popup-section-title">Speech Bubble</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          Position and font size of the in-game speech bubble (enemy speech &amp; follow-up messages).
        </p>
        <div className="section-title" style={{ marginTop: 4 }}>Landscape</div>
        <div className="row">
          <div className="field">
            <label>X (left)</label>
            <input type="number" step={5} value={speechLayout.landscapeX}
              onChange={e => setSpeechLayout({ landscapeX: +e.target.value })} />
          </div>
          <div className="field">
            <label>Y (top)</label>
            <input type="number" step={5} value={speechLayout.landscapeY}
              onChange={e => setSpeechLayout({ landscapeY: +e.target.value })} />
          </div>
          <div className="field">
            <label>Font size</label>
            <input type="number" step={0.5} min={8} max={32} value={speechLayout.landscapeFontSize}
              onChange={e => setSpeechLayout({ landscapeFontSize: +e.target.value })} />
          </div>
        </div>
        <div className="section-title" style={{ marginTop: 8 }}>Portrait</div>
        <div className="row">
          <div className="field">
            <label>X (left)</label>
            <input type="number" step={5} value={speechLayout.portraitX}
              onChange={e => setSpeechLayout({ portraitX: +e.target.value })} />
          </div>
          <div className="field">
            <label>Y (top)</label>
            <input type="number" step={5} value={speechLayout.portraitY}
              onChange={e => setSpeechLayout({ portraitY: +e.target.value })} />
          </div>
          <div className="field">
            <label>Font size</label>
            <input type="number" step={0.5} min={8} max={32} value={speechLayout.portraitFontSize}
              onChange={e => setSpeechLayout({ portraitFontSize: +e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}
