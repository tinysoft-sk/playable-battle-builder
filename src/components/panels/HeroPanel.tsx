import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function HeroPanel() {
  const { config, setHeroLeft, setHeroRight, setGridOffset } = useBattleStore();
  const { heroLeft, heroRight } = config;
  const gridOffset = config.gridOffset ?? { landscape: 0, portrait: 0 };

  return (
    <div>
      <div className="panel-title">Heroes</div>

      <div className="section-title">Left Hero</div>
      <div className="field">
        <label>Portrait</label>
        <AssetUpload label="Left hero" asset={heroLeft.asset} onChange={a => setHeroLeft({ asset: a })} />
      </div>
      <div className="row">
        <div className="field">
          <label>Pos X (from left edge)</label>
          <input type="number" value={heroLeft.posX} onChange={e => setHeroLeft({ posX: +e.target.value })} />
        </div>
        <div className="field">
          <label>Pos Y (from top)</label>
          <input type="number" value={heroLeft.posY} onChange={e => setHeroLeft({ posY: +e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>
          <input type="checkbox" checked={heroLeft.flipped} onChange={e => setHeroLeft({ flipped: e.target.checked })} />
          {' '}Flipped horizontally
        </label>
      </div>

      <div className="section-title">Right Hero</div>
      <div className="field">
        <label>Portrait</label>
        <AssetUpload label="Right hero" asset={heroRight.asset} onChange={a => setHeroRight({ asset: a })} />
      </div>
      <div className="row">
        <div className="field">
          <label>Pos X (from right edge)</label>
          <input type="number" value={heroRight.posX} onChange={e => setHeroRight({ posX: +e.target.value })} />
        </div>
        <div className="field">
          <label>Pos Y (from top)</label>
          <input type="number" value={heroRight.posY} onChange={e => setHeroRight({ posY: +e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>
          <input type="checkbox" checked={heroRight.flipped} onChange={e => setHeroRight({ flipped: e.target.checked })} />
          {' '}Flipped horizontally
        </label>
      </div>

      <div className="section-title">Grid Position</div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        Shift the battle grid up (negative) or down (positive) in pixels.
      </p>
      <div className="row">
        <div className="field">
          <label>Landscape offset Y</label>
          <input type="number" step={10} value={gridOffset.landscape}
            onChange={e => setGridOffset('landscape', +e.target.value)} />
        </div>
        <div className="field">
          <label>Portrait offset Y</label>
          <input type="number" step={10} value={gridOffset.portrait}
            onChange={e => setGridOffset('portrait', +e.target.value)} />
        </div>
      </div>
    </div>
  );
}
