import { useState } from 'react';
import { useBattleStore } from '../../store/battleStore';
import type { UnitConfig, SpellElement } from '../../types/battle';
import { unitRoleKey } from '../../utils/roleKeys';
import AssetUpload from '../AssetUpload';

function UnitCard({
  unit,
  onUpdate,
  onRemove,
  canRemove,
  gridCols,
  gridRows,
}: {
  unit: UnitConfig;
  onUpdate: (patch: Partial<UnitConfig>) => void;
  onRemove: () => void;
  canRemove: boolean;
  gridCols: number;
  gridRows: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="unit-card">
      <div
        className="unit-card-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
      >
        <span className="unit-card-title">{unit.name || '(unnamed)'}</span>
        <span className="unit-card-type">{unit.type}</span>
        {canRemove && (
          <button
            className="unit-remove"
            aria-label={`Remove ${unit.name || 'unit'}`}
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="Remove"
          >
            ✕
          </button>
        )}
      </div>
      <div className={`unit-card-body${open ? ' open' : ''}`}>
        <div className="section-title" style={{ marginTop: 0 }}>Identity</div>
        <div className="field">
          <label htmlFor={`unit-name-${unit.id}`}>Name</label>
          <input id={`unit-name-${unit.id}`} type="text" value={unit.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`unit-type-${unit.id}`}>Type</label>
          <select id={`unit-type-${unit.id}`} value={unit.type} onChange={e => onUpdate({ type: e.target.value as UnitConfig['type'] })}>
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="flying">Flying</option>
          </select>
        </div>

        <div className="section-title">Combat</div>
        <div className="row">
          <div className="field">
            <label htmlFor={`unit-hp-${unit.id}`}>HP</label>
            <input id={`unit-hp-${unit.id}`} type="number" min={1} value={unit.hp} onChange={e => onUpdate({ hp: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-basedamage-${unit.id}`}>Base Damage</label>
            <input id={`unit-basedamage-${unit.id}`} type="number" min={0} value={unit.baseDamage} onChange={e => onUpdate({ baseDamage: +e.target.value })} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor={`unit-defense-${unit.id}`}>Defense</label>
            <input id={`unit-defense-${unit.id}`} type="number" min={0} value={unit.defense} onChange={e => onUpdate({ defense: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-dmgmult-${unit.id}`}>Dmg Multiplier</label>
            <input id={`unit-dmgmult-${unit.id}`} type="number" min={0} step={0.1} value={unit.damageMultiplier} onChange={e => onUpdate({ damageMultiplier: +e.target.value })} />
          </div>
        </div>
        <div className="field">
          <div className="field-label">Resist To</div>
          <div className="resist-row">
            {(['fire', 'ice'] as SpellElement[]).map(el => (
              <label key={el}>
                <input
                  type="checkbox"
                  checked={unit.resistTo.includes(el)}
                  onChange={ev => {
                    const next = ev.target.checked
                      ? [...unit.resistTo, el]
                      : unit.resistTo.filter(r => r !== el);
                    onUpdate({ resistTo: next });
                  }}
                />
                {el.charAt(0).toUpperCase() + el.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="section-title">Position &amp; Size</div>
        <div className="row">
          <div className="field">
            <label htmlFor={`unit-gridcol-${unit.id}`}>Grid Col</label>
            <input id={`unit-gridcol-${unit.id}`} type="number" min={0} max={gridCols - 1} value={unit.gridCol} onChange={e => onUpdate({ gridCol: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-gridrow-${unit.id}`}>Grid Row</label>
            <input id={`unit-gridrow-${unit.id}`} type="number" min={0} max={gridRows - 1} value={unit.gridRow} onChange={e => onUpdate({ gridRow: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-displaywidth-${unit.id}`}>Display Width</label>
            <input id={`unit-displaywidth-${unit.id}`} type="number" min={40} max={300} value={unit.displayWidth} onChange={e => onUpdate({ displayWidth: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-moverange-${unit.id}`}>Move Range</label>
            <input id={`unit-moverange-${unit.id}`} type="number" min={1} max={8} value={unit.moveRange ?? 2} onChange={e => onUpdate({ moveRange: +e.target.value })} title="Max hexes per turn" />
          </div>
        </div>

        <div className="section-title">Art</div>
        <div className="field">
          <div className="field-label">Idle Image</div>
          <AssetUpload
            label="Idle sprite"
            asset={unit.assets.idle}
            roleKey={unitRoleKey('idle', unit.name)}
            onChange={a => onUpdate({ assets: { ...unit.assets, idle: a } })}
          />
        </div>
        <div className="field">
          <div className="field-label">Attack Image</div>
          <AssetUpload
            label="Attack sprite"
            asset={unit.assets.attack}
            roleKey={unitRoleKey('attack', unit.name)}
            onChange={a => onUpdate({ assets: { ...unit.assets, attack: a } })}
          />
        </div>
        {unit.type === 'ranged' && (
          <>
            <div className="field">
              <div className="field-label">Projectile Image</div>
              <AssetUpload
                label="Projectile"
                asset={unit.assets.projectile ?? null}
                roleKey={unitRoleKey('projectile', unit.name)}
                onChange={a => onUpdate({ assets: { ...unit.assets, projectile: a } })}
              />
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor={`unit-projsize-${unit.id}`}>Projectile Size</label>
              <input id={`unit-projsize-${unit.id}`} type="number" min={16} max={200} value={unit.projectileSize ?? 60}
                onChange={e => onUpdate({ projectileSize: +e.target.value })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnitsPanel() {
  const {
    config,
    updatePlayerUnit, addPlayerUnit, removePlayerUnit,
    updateEnemyUnit,  addEnemyUnit,  removeEnemyUnit,
  } = useBattleStore();
  const grid = config.grid ?? { cols: 5, rows: 4 };

  return (
    <div>
      <div className="panel-title">Units</div>
      <div className="units-grid">
        <div>
          <div className="units-col-title">Player Side ({config.playerUnits.length}/6)</div>
          {config.playerUnits.map(u => (
            <UnitCard
              key={u.id}
              unit={u}
              onUpdate={patch => updatePlayerUnit(u.id, patch)}
              onRemove={() => removePlayerUnit(u.id)}
              canRemove={config.playerUnits.length > 1}
              gridCols={grid.cols}
              gridRows={grid.rows}
            />
          ))}
          <button className="btn-add" disabled={config.playerUnits.length >= 6} onClick={addPlayerUnit}>
            + Add Player Unit
          </button>
        </div>
        <div>
          <div className="units-col-title">Enemy Side ({config.enemyUnits.length}/6)</div>
          {config.enemyUnits.map(u => (
            <UnitCard
              key={u.id}
              unit={u}
              onUpdate={patch => updateEnemyUnit(u.id, patch)}
              onRemove={() => removeEnemyUnit(u.id)}
              canRemove={config.enemyUnits.length > 1}
              gridCols={grid.cols}
              gridRows={grid.rows}
            />
          ))}
          <button className="btn-add" disabled={config.enemyUnits.length >= 6} onClick={addEnemyUnit}>
            + Add Enemy Unit
          </button>
        </div>
      </div>
    </div>
  );
}
