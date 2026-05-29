import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function PopupsPanel() {
  const { config, setPopups, setAppIcon } = useBattleStore();
  const { popups } = config;

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
      </div>
    </div>
  );
}
