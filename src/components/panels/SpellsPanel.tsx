import { useBattleStore } from '../../store/battleStore';
import type { SpellConfig } from '../../types/battle';
import AssetUpload from '../AssetUpload';

export default function SpellsPanel() {
  const { config, updateSpell, setUiAsset, setSpellbookEnabled } = useBattleStore();
  const sbEnabled = config.spellbookEnabled !== false;

  return (
    <div>
      <div className="panel-title">Spells</div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={sbEnabled}
            onChange={e => setSpellbookEnabled(e.target.checked)}
          />
          Include Spellbook (show spell UI in playable)
        </label>
      </div>

      {sbEnabled && (
        <>
          <div className="popup-section" style={{ marginBottom: 14 }}>
            <div className="popup-section-title">Spellbook Icon</div>
            <div className="row">
              <div className="field">
                <label>Closed (default state)</label>
                <AssetUpload label="Spellbook closed" asset={config.uiAssets?.spellbookClosed ?? null}
                  onChange={a => setUiAsset('spellbookClosed', a)} />
              </div>
              <div className="field">
                <label>Open (when spells shown)</label>
                <AssetUpload label="Spellbook open" asset={config.uiAssets?.spellbookOpen ?? null}
                  onChange={a => setUiAsset('spellbookOpen', a)} />
              </div>
            </div>
          </div>

          {config.spells.map((spell, i) => (
            <SpellCard key={spell.id} spell={spell} index={i} onUpdate={p => updateSpell(spell.id, p)} />
          ))}
        </>
      )}
    </div>
  );
}

function SpellCard({
  spell,
  index,
  onUpdate,
}: {
  spell: SpellConfig;
  index: number;
  onUpdate: (p: Partial<SpellConfig>) => void;
}) {
  return (
    <div className="popup-section" style={{ marginBottom: 14 }}>
      <div className="popup-section-title">Spell {index + 1}</div>
      <div className="row">
        <div className="field">
          <label>Name</label>
          <input type="text" value={spell.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>Element</label>
          <select value={spell.element} onChange={e => onUpdate({ element: e.target.value as SpellConfig['element'] })}>
            <option value="fire">Fire</option>
            <option value="ice">Ice</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Spell Icon</label>
        <AssetUpload label="Spell icon" asset={spell.asset} onChange={a => onUpdate({ asset: a })} />
      </div>
      <div className="field">
        <label>SFX – Shoot</label>
        <AssetUpload label="Shoot sound" asset={spell.sfxShoot} accept="audio/*" onChange={a => onUpdate({ sfxShoot: a })} />
      </div>
      <div className="field">
        <label>SFX – Hit</label>
        <AssetUpload label="Hit sound" asset={spell.sfxHit} accept="audio/*" onChange={a => onUpdate({ sfxHit: a })} />
      </div>
    </div>
  );
}
