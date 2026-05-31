import { useBattleStore } from '../../store/battleStore';
import type { FailCondition, WinStep, PostKillRetaliation } from '../../types/battle';

const TRIGGERS: FailCondition['trigger'][] = [
  'move_to_flying',
  'kill_ranged_first',
  'wrong_spell_on_flying',
  'wasted_spell',
];

export default function ScenarioPanel() {
  const {
    config, setScenario,
    addEnemyTurn, removeEnemyTurn, updateEnemyTurn, updateAttackReaction,
    addPlayerTurn, removePlayerTurn, updatePlayerTurn,
  } = useBattleStore();
  const { scenario } = config;
  const alt = scenario.alternating;

  // ── puzzle helpers ──────────────────────────────────────────────────

  function updateFailCondition(id: FailCondition['id'], patch: Partial<FailCondition>) {
    setScenario({ failConditions: scenario.failConditions.map(fc => fc.id === id ? { ...fc, ...patch } : fc) });
  }

  function updateRetaliation(idx: number, patch: Partial<PostKillRetaliation>) {
    setScenario({ retaliations: scenario.retaliations.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  }

  function addRetaliation() {
    setScenario({
      retaliations: [...scenario.retaliations, {
        killedUnitId: config.enemyUnits[0]?.id ?? '',
        retaliatorUnitId: config.enemyUnits[1]?.id ?? config.enemyUnits[0]?.id ?? '',
        damage: 0, speechText: '', followUpSpeech: '',
      }],
    });
  }

  function removeRetaliation(idx: number) {
    setScenario({ retaliations: scenario.retaliations.filter((_, i) => i !== idx) });
  }

  function updateStep(idx: number, patch: Partial<WinStep>) {
    setScenario({ winningSequence: scenario.winningSequence.map((s, i) => i === idx ? { ...s, ...patch } : s) });
  }

  function addStep() {
    const order = scenario.winningSequence.length;
    setScenario({
      winningSequence: [...scenario.winningSequence, {
        order,
        actorUnitId: config.playerUnits[0]?.id ?? '',
        action: 'melee_attack',
        targetUnitId: config.enemyUnits[0]?.id ?? '',
      }],
    });
  }

  function removeStep(idx: number) {
    setScenario({ winningSequence: scenario.winningSequence.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })) });
  }

  // ── alternating helpers ─────────────────────────────────────────────

  // Ensure every enemy has a reaction entry (fill gaps from config)
  const allReactions = config.enemyUnits.map(eu => {
    const existing = alt?.attackReactions?.find(r => r.enemyUnitId === eu.id);
    return existing ?? { enemyUnitId: eu.id, retaliates: false, retaliationDamage: 0, retaliationSpeech: '' };
  });

  return (
    <div>
      <div className="panel-title">Scenario</div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Battle Mode</label>
        <select value={scenario.mode} onChange={e => setScenario({ mode: e.target.value as 'puzzle' | 'alternating' })}>
          <option value="puzzle">Puzzle (one winning path)</option>
          <option value="alternating">Alternating turns</option>
        </select>
      </div>

      {/* ── PUZZLE MODE ── */}
      {scenario.mode === 'puzzle' && (
        <>
          <div className="section-title">Winning Sequence</div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            Ordered steps the player must take to win. Each step: actor → action → target.
          </p>
          {scenario.winningSequence.map((step, i) => (
            <div key={i} className="step-card" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className="step-order">{i + 1}.</span>

              {/* Actor */}
              <select
                title="Who acts"
                value={step.actorUnitId ?? config.playerUnits[0]?.id ?? ''}
                onChange={e => updateStep(i, { actorUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
                {config.playerUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Action */}
              <select
                title="Action"
                value={step.action}
                onChange={e => updateStep(i, { action: e.target.value as WinStep['action'] })}
                style={{ flex: '1 1 120px', minWidth: 100 }}
              >
                <option value="cast_spell">Cast Spell</option>
                <option value="melee_attack">Melee Attack</option>
                <option value="ranged_attack">Ranged Attack</option>
              </select>

              {/* Spell (if cast) */}
              {step.action === 'cast_spell' && (
                <select
                  title="Spell"
                  value={step.spellId ?? ''}
                  onChange={e => updateStep(i, { spellId: e.target.value })}
                  style={{ flex: '1 1 90px', minWidth: 80 }}
                >
                  {config.spells.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
              )}

              {/* Target */}
              <select
                title="Target enemy"
                value={step.targetUnitId}
                onChange={e => updateStep(i, { targetUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
                {config.enemyUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <button className="unit-remove" onClick={() => removeStep(i)}>✕</button>
            </div>
          ))}
          <button className="btn-add" onClick={addStep}>+ Add Step</button>

          <div className="section-title">Fail Conditions</div>
          {scenario.failConditions.map(fc => (
            <div key={fc.id} className="fail-card">
              <div className="fail-card-header">
                <span className="fail-id">{fc.id}</span>
                <select
                  value={fc.trigger}
                  onChange={e => updateFailCondition(fc.id, { trigger: e.target.value as FailCondition['trigger'] })}
                  style={{ flex: 1 }}
                >
                  {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Hint Lines (one per line → shown with line breaks)</label>
                <textarea
                  value={fc.hintLines.join('\n')}
                  onChange={e => updateFailCondition(fc.id, { hintLines: e.target.value.split('\n') })}
                />
              </div>
            </div>
          ))}

          <div className="section-title">Post-Kill Retaliations</div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            When a specific enemy is killed, a surviving enemy retaliates.
          </p>
          {scenario.retaliations.map((ret, i) => (
            <div key={i} className="ret-card">
              <div className="row" style={{ marginBottom: 6 }}>
                <div className="field">
                  <label>When killed</label>
                  <select value={ret.killedUnitId}
                    onChange={e => updateRetaliation(i, { killedUnitId: e.target.value })}>
                    {config.enemyUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Retaliator</label>
                  <select value={ret.retaliatorUnitId}
                    onChange={e => updateRetaliation(i, { retaliatorUnitId: e.target.value })}>
                    {config.enemyUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ maxWidth: 80 }}>
                  <label>Damage</label>
                  <input type="number" min={0} value={ret.damage}
                    onChange={e => updateRetaliation(i, { damage: +e.target.value })} />
                </div>
                <button className="unit-remove" style={{ alignSelf: 'flex-end', marginBottom: 2 }}
                  onClick={() => removeRetaliation(i)}>✕</button>
              </div>
              <div className="field">
                <label>Speech Text</label>
                <input type="text" value={ret.speechText}
                  onChange={e => updateRetaliation(i, { speechText: e.target.value })} />
              </div>
              <div className="field">
                <label>Follow-up Speech</label>
                <input type="text" value={ret.followUpSpeech}
                  onChange={e => updateRetaliation(i, { followUpSpeech: e.target.value })} />
              </div>
            </div>
          ))}
          <button className="btn-add" onClick={addRetaliation}>+ Add Retaliation</button>
        </>
      )}

      {/* ── ALTERNATING MODE ── */}
      {scenario.mode === 'alternating' && (
        <>
          {/* Who starts */}
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div className="popup-section-title">Who starts?</div>
            <div className="resist-row">
              <label>
                <input type="radio" name="firstTurn" value="player"
                  checked={(alt?.firstTurn ?? 'player') === 'player'}
                  onChange={() => setScenario({ alternating: { ...alt, firstTurn: 'player' } })} />
                &nbsp;Player
              </label>
              <label>
                <input type="radio" name="firstTurn" value="enemy"
                  checked={(alt?.firstTurn ?? 'player') === 'enemy'}
                  onChange={() => setScenario({ alternating: { ...alt, firstTurn: 'enemy' } })} />
                &nbsp;Enemy
              </label>
            </div>
          </div>

          {/* Player Turn Order */}
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div className="popup-section-title">Player Turn Order</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Which player units attack and in what order. Cycles after each enemy turn.
            </p>
            {(alt?.playerTurns ?? []).map((pt, i) => (
              <div key={pt.id} className="step-card" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                <span className="step-order">{i + 1}.</span>
                <select
                  value={pt.unitId}
                  onChange={e => updatePlayerTurn(pt.id, { unitId: e.target.value })}
                  style={{ flex: '1 1 120px', minWidth: 100 }}
                >
                  {config.playerUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button className="unit-remove"
                  disabled={(alt?.playerTurns ?? []).length <= 1}
                  onClick={() => removePlayerTurn(pt.id)}>✕</button>
              </div>
            ))}
            <button className="btn-add" onClick={addPlayerTurn}>+ Add Turn</button>
          </div>

          {/* Enemy Turn Sequence */}
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div className="popup-section-title">Enemy Turn Sequence</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Enemies attack in this order (dead enemies are skipped). Cycles until fight ends.
            </p>
            {(alt?.enemyTurns ?? []).map((turn, i) => {
              const turnAction = turn.action ?? 'attack';
              return (
                <div key={turn.id} className="step-card" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <span className="step-order">{i + 1}.</span>
                  <select
                    title="Attacker"
                    value={turn.attackerUnitId}
                    onChange={e => updateEnemyTurn(turn.id, { attackerUnitId: e.target.value })}
                    style={{ flex: '1 1 90px', minWidth: 80 }}
                  >
                    {config.enemyUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <select
                    title="Action"
                    value={turnAction}
                    onChange={e => updateEnemyTurn(turn.id, { action: e.target.value as 'attack' | 'move' })}
                    style={{ flex: '0 0 80px' }}
                  >
                    <option value="attack">Attack</option>
                    <option value="move">Move</option>
                  </select>
                  {turnAction === 'attack' ? (
                    <>
                      <select
                        title="Target player unit"
                        value={turn.targetUnitId ?? ''}
                        onChange={e => updateEnemyTurn(turn.id, { targetUnitId: e.target.value })}
                        style={{ flex: '1 1 90px', minWidth: 80 }}
                      >
                        <option value="">Active player</option>
                        {config.playerUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>dmg</span>
                        <input
                          type="number" min={0} value={turn.damage}
                          onChange={e => updateEnemyTurn(turn.id, { damage: +e.target.value })}
                          style={{ width: 60 }}
                        />
                      </div>
                      <input
                        type="text" placeholder="Speech text"
                        value={turn.speechText}
                        onChange={e => updateEnemyTurn(turn.id, { speechText: e.target.value })}
                        style={{ flex: '2 1 140px', minWidth: 100 }}
                      />
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>col</span>
                        <input
                          type="number" min={0} max={4} value={turn.moveTargetCol ?? 0}
                          onChange={e => updateEnemyTurn(turn.id, { moveTargetCol: +e.target.value })}
                          style={{ width: 50 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                        <input
                          type="number" min={0} max={3} value={turn.moveTargetRow ?? 0}
                          onChange={e => updateEnemyTurn(turn.id, { moveTargetRow: +e.target.value })}
                          style={{ width: 50 }}
                        />
                      </div>
                    </>
                  )}
                  <button className="unit-remove" onClick={() => removeEnemyTurn(turn.id)}>✕</button>
                </div>
              );
            })}
            <button className="btn-add" onClick={addEnemyTurn}>+ Add Enemy Turn</button>
          </div>

          {/* Attack Reactions */}
          <div className="popup-section">
            <div className="popup-section-title">Enemy Reactions (when player attacks)</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              For each enemy: does it retaliate when the player hits it?
            </p>
            {allReactions.map(reaction => {
              const enemy = config.enemyUnits.find(u => u.id === reaction.enemyUnitId);
              if (!enemy) return null;
              return (
                <div key={reaction.enemyUnitId} className="ret-card" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{enemy.name}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={reaction.retaliates}
                        onChange={e => updateAttackReaction(reaction.enemyUnitId, { retaliates: e.target.checked })}
                      />
                      Retaliates
                    </label>
                  </div>
                  {reaction.retaliates && (
                    <div className="row">
                      <div className="field" style={{ maxWidth: 90 }}>
                        <label>Damage</label>
                        <input type="number" min={0} value={reaction.retaliationDamage}
                          onChange={e => updateAttackReaction(reaction.enemyUnitId, { retaliationDamage: +e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Retaliation Speech</label>
                        <input type="text" value={reaction.retaliationSpeech}
                          onChange={e => updateAttackReaction(reaction.enemyUnitId, { retaliationSpeech: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
