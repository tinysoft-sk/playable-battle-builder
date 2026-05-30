import { useState } from 'react';
import { useBattleStore } from '../../store/battleStore';
import type { UnitConfig, SpellElement } from '../../types/battle';
import AssetUpload from '../AssetUpload';

function UnitCard({
  unit,
  onUpdate,
  onRemove,
  canRemove,
}: {
  unit: UnitConfig;
  onUpdate: (patch: Partial<UnitConfig>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="unit-card">
      <div className="unit-card-header" onClick={() => setOpen(o => !o)}>
        <span className="unit-card-title">{unit.name || '(unnamed)'}</span>
        <span className="unit-card-type">{unit.type}</span>
        {canRemove && (
          <button className="unit-remove" onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
        )}
      </div>
      <div className={`unit-card-body${open ? ' open' : ''}`}>
        <div className="field">
          <label>Name</label>
          <input type="text" value={unit.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={unit.type} onChange={e => onUpdate({ type: e.target.value as UnitConfig['type'] })}>
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="flying">Flying</option>
          </select>
        </div>

        <div className="row">
          <div className="field">
            <label>HP</label>
            <input type="number" min={1} value={unit.hp} onChange={e => onUpdate({ hp: +e.target.value })} />
          </div>
          <div className="field">
            <label>Base Damage</label>
            <input type="number" min={0} value={unit.baseDamage} onChange={e => onUpdate({ baseDamage: +e.target.value })} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Defense</label>
            <input type="number" min={0} value={unit.defense} onChange={e => onUpdate({ defense: +e.target.value })} />
          </div>
          <div className="field">
            <label>Dmg Multiplier</label>
            <input type="number" min={0} step={0.1} value={unit.damageMultiplier} onChange={e => onUpdate({ damageMultiplier: +e.target.value })} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Grid Col</label>
            <input type="number" min={0} max={4} value={unit.gridCol} onChange={e => onUpdate({ gridCol: +e.target.value })} />
          </div>
          <div className="field">
            <label>Grid Row</label>
            <input type="number" min={0} max={3} value={unit.gridRow} onChange={e => onUpdate({ gridRow: +e.target.value })} />
          </div>
          <div className="field">
            <label>Display Width</label>
            <input type="number" min={40} max={300} value={unit.displayWidth} onChange={e => onUpdate({ displayWidth: +e.target.value })} />
          </div>
          <div className="field">
            <label>Move Range</label>
            <input type="number" min={1} max={8} value={unit.moveRange ?? 2} onChange={e => onUpdate({ moveRange: +e.target.value })} title="Max hexes per turn" />
          </div>
        </div>

        <div className="field">
          <label>Resist To</label>
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

        <div className="field">
          <label>Idle Image</label>
          <AssetUpload
            label="Idle sprite"
            asset={unit.assets.idle}
            onChange={a => onUpdate({ assets: { ...unit.assets, idle: a } })}
          />
        </div>
        <div className="field">
          <label>Attack Image</label>
          <AssetUpload
            label="Attack sprite"
            asset={unit.assets.attack}
            onChange={a => onUpdate({ assets: { ...unit.assets, attack: a } })}
          />
        </div>
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
