import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function HeroPanel() {
  const { config, setHeroLeft, setHeroRight } = useBattleStore();
  const { heroLeft, heroRight } = config;

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
    </div>
  );
}
