import { useBattleStore } from '../../store/battleStore';
import type { SpellConfig } from '../../types/battle';
import AssetUpload from '../AssetUpload';
import { FIXED_ROLE_KEYS, spellRoleKey } from '../../utils/roleKeys';

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

      <div className="popup-section" style={{ marginBottom: 14 }}>
        <div className="popup-section-title">Attack Type Icons</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          Shown briefly when a unit attacks. Optional — leave empty for no icon.
        </p>
        <div className="row">
          <div className="field">
            <div className="field-label">Melee</div>
            <AssetUpload label="Melee icon" asset={config.uiAssets?.meleeIcon ?? null}
              roleKey={FIXED_ROLE_KEYS.uiMeleeIcon}
              onChange={a => setUiAsset('meleeIcon', a)} />
          </div>
          <div className="field">
            <div className="field-label">Ranged</div>
            <AssetUpload label="Ranged icon" asset={config.uiAssets?.rangedIcon ?? null}
              roleKey={FIXED_ROLE_KEYS.uiRangedIcon}
              onChange={a => setUiAsset('rangedIcon', a)} />
          </div>
          <div className="field">
            <div className="field-label">Flying</div>
            <AssetUpload label="Flying icon" asset={config.uiAssets?.flyingIcon ?? null}
              roleKey={FIXED_ROLE_KEYS.uiFlyingIcon}
              onChange={a => setUiAsset('flyingIcon', a)} />
          </div>
        </div>
      </div>

      <div className="popup-section" style={{ marginBottom: 14 }}>
        <div className="popup-section-title">Ranged Projectile</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          The image that travels from attacker to target during a ranged attack (player or enemy). Optional — leave empty for a plain glowing shot.
        </p>
        <div className="field">
          <div className="field-label">Projectile Image</div>
          <AssetUpload label="Ranged projectile" asset={config.uiAssets?.rangedProjectile ?? null}
            roleKey={FIXED_ROLE_KEYS.uiRangedProjectile}
            onChange={a => setUiAsset('rangedProjectile', a)} />
        </div>
      </div>

      {sbEnabled && (
        <>
          <div className="popup-section" style={{ marginBottom: 14 }}>
            <div className="popup-section-title">Spellbook Icon</div>
            <div className="row">
              <div className="field">
                <div className="field-label">Closed (default state)</div>
                <AssetUpload label="Spellbook closed" asset={config.uiAssets?.spellbookClosed ?? null}
                  roleKey={FIXED_ROLE_KEYS.uiSpellbookClosed}
                  onChange={a => setUiAsset('spellbookClosed', a)} />
              </div>
              <div className="field">
                <div className="field-label">Open (when spells shown)</div>
                <AssetUpload label="Spellbook open" asset={config.uiAssets?.spellbookOpen ?? null}
                  roleKey={FIXED_ROLE_KEYS.uiSpellbookOpen}
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
          <label htmlFor={`spell-name-${spell.id}`}>Name</label>
          <input id={`spell-name-${spell.id}`} type="text" value={spell.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`spell-element-${spell.id}`}>Element</label>
          <select id={`spell-element-${spell.id}`} value={spell.element} onChange={e => onUpdate({ element: e.target.value as SpellConfig['element'] })}>
            <option value="fire">Fire</option>
            <option value="ice">Ice</option>
          </select>
        </div>
      </div>
      <div className="field">
        <div className="field-label">Spell Icon</div>
        <AssetUpload label="Spell icon" asset={spell.asset}
          roleKey={spellRoleKey('asset', spell.name)}
          onChange={a => onUpdate({ asset: a })} />
      </div>
      <div className="field">
        <div className="field-label">Projectile Image (optional — falls back to the Spell Icon above if empty)</div>
        <AssetUpload label="Spell projectile" asset={spell.projectileAsset ?? null}
          roleKey={spellRoleKey('projectileAsset', spell.name)}
          onChange={a => onUpdate({ projectileAsset: a })} />
      </div>
      <div className="field" style={{ maxWidth: 120 }}>
        <label htmlFor={`spell-projsize-${spell.id}`}>Projectile Size</label>
        <input id={`spell-projsize-${spell.id}`} type="number" min={16} max={200} value={spell.projectileSize ?? 60}
          onChange={e => onUpdate({ projectileSize: +e.target.value })} />
      </div>
      <div className="field">
        <div className="field-label">SFX – Shoot</div>
        <AssetUpload label="Shoot sound" asset={spell.sfxShoot} accept="audio/*" onChange={a => onUpdate({ sfxShoot: a })} />
      </div>
      <div className="field">
        <div className="field-label">SFX – Hit</div>
        <AssetUpload label="Hit sound" asset={spell.sfxHit} accept="audio/*" onChange={a => onUpdate({ sfxHit: a })} />
      </div>
    </div>
  );
}
