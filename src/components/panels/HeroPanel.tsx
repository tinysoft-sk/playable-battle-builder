import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';
import { FIXED_ROLE_KEYS } from '../../utils/roleKeys';

export default function HeroPanel() {
  const { config, setHeroLeft, setHeroRight } = useBattleStore();
  const { heroLeft, heroRight } = config;

  return (
    <div>
      <div className="panel-title">Heroes</div>

      <div className="section-title">Left Hero</div>
      <div className="field">
        <div className="field-label">Portrait</div>
        <AssetUpload label="Left hero" asset={heroLeft.asset} roleKey={FIXED_ROLE_KEYS.heroLeft} onChange={a => setHeroLeft({ asset: a })} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="hero-left-posx">Pos X (from left edge)</label>
          <input id="hero-left-posx" type="number" value={heroLeft.posX} onChange={e => setHeroLeft({ posX: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="hero-left-posy">Pos Y (from top)</label>
          <input id="hero-left-posy" type="number" value={heroLeft.posY} onChange={e => setHeroLeft({ posY: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="hero-left-displaywidth">Display Width</label>
          <input id="hero-left-displaywidth" type="number" min={40} max={300} value={heroLeft.displayWidth} onChange={e => setHeroLeft({ displayWidth: +e.target.value })} />
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
        <div className="field-label">Portrait</div>
        <AssetUpload label="Right hero" asset={heroRight.asset} roleKey={FIXED_ROLE_KEYS.heroRight} onChange={a => setHeroRight({ asset: a })} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="hero-right-posx">Pos X (from right edge)</label>
          <input id="hero-right-posx" type="number" value={heroRight.posX} onChange={e => setHeroRight({ posX: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="hero-right-posy">Pos Y (from top)</label>
          <input id="hero-right-posy" type="number" value={heroRight.posY} onChange={e => setHeroRight({ posY: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="hero-right-displaywidth">Display Width</label>
          <input id="hero-right-displaywidth" type="number" min={40} max={300} value={heroRight.displayWidth} onChange={e => setHeroRight({ displayWidth: +e.target.value })} />
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
