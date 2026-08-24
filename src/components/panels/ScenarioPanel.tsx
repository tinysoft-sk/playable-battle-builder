import { useState } from 'react';
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
  const gridCols = config.grid?.cols ?? 5;
  const gridRows = config.grid?.rows ?? 4;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    firstTurn: true,
    playerTurns: true,
    enemyTurns: true,
    reactions: true,
  });
  function toggleSection(key: string) {
    setOpenSections(s => ({ ...s, [key]: !s[key] }));
  }

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
        tooltipText: '',
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
        <label htmlFor="scenario-mode">Battle Mode</label>
        <select id="scenario-mode" value={scenario.mode} onChange={e => setScenario({ mode: e.target.value as 'puzzle' | 'alternating' | 'guided' })}>
          <option value="puzzle">Puzzle (one winning path)</option>
          <option value="alternating">Alternating turns</option>
          <option value="guided">Guided (one option per turn)</option>
        </select>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label htmlFor="scenario-intro-speech">Intro Speech</label>
        <input
          id="scenario-intro-speech"
          type="text"
          value={scenario.introSpeech ?? ''}
          placeholder="Defeat the enemies!"
          onChange={e => setScenario({ introSpeech: e.target.value })}
        />
      </div>

      {/* ── PUZZLE MODE ── */}
      {(scenario.mode === 'puzzle' || scenario.mode === 'guided') && (
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
                aria-label="Who acts"
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
                aria-label="Action"
                value={step.action}
                onChange={e => {
                  const action = e.target.value as WinStep['action'];
                  const patch: Partial<WinStep> = { action };
                  if (action === 'cast_spell' && !step.spellId) {
                    patch.spellId = config.spells[0]?.id;
                  }
                  updateStep(i, patch);
                }}
                style={{ flex: '1 1 120px', minWidth: 100 }}
              >
                <option value="cast_spell">Cast Spell</option>
                <option value="melee_attack">Melee Attack</option>
                <option value="ranged_attack">Ranged Attack</option>
                <option value="move">Move</option>
              </select>

              {/* Spell (if cast) */}
              {step.action === 'cast_spell' && (
                <select
                  title="Spell"
                  aria-label="Spell"
                  value={step.spellId ?? ''}
                  onChange={e => updateStep(i, { spellId: e.target.value })}
                  style={{ flex: '1 1 90px', minWidth: 80 }}
                >
                  {config.spells.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
              )}

              {/* Target: enemy select, or move col/row */}
              {step.action === 'move' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>col</span>
                    <input
                      type="number" min={0} max={gridCols - 1} value={step.moveTargetCol ?? 0}
                      onChange={e => updateStep(i, { moveTargetCol: +e.target.value })}
                      style={{ width: 50 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                    <input
                      type="number" min={0} max={gridRows - 1} value={step.moveTargetRow ?? 0}
                      onChange={e => updateStep(i, { moveTargetRow: +e.target.value })}
                      style={{ width: 50 }}
                    />
                  </div>
                </>
              ) : (
                <select
                  title="Target enemy"
                  aria-label="Target enemy"
                  value={step.targetUnitId}
                  onChange={e => updateStep(i, { targetUnitId: e.target.value })}
                  style={{ flex: '1 1 90px', minWidth: 80 }}
                >
                  {config.enemyUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}

              <button className="unit-remove" aria-label={`Remove step ${i + 1}`} onClick={() => removeStep(i)}>✕</button>

              {scenario.mode === 'guided' && (
                <div className="field" style={{ flex: '1 1 100%' }}>
                  <label htmlFor={`scenario-step-tooltip-${i}`}>Tooltip (what &amp; why)</label>
                  <textarea
                    id={`scenario-step-tooltip-${i}`}
                    value={step.tooltipText ?? ''}
                    onChange={e => updateStep(i, { tooltipText: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
          <button className="btn-add" onClick={addStep}>+ Add Step</button>

          {scenario.mode === 'puzzle' && (
            <>
              <div className="section-title">Fail Conditions</div>
              {scenario.failConditions.map(fc => (
                <div key={fc.id} className="fail-card">
                  <div className="fail-card-header">
                    <span className="fail-id">{fc.id}</span>
                    <select
                      value={fc.trigger}
                      onChange={e => updateFailCondition(fc.id, { trigger: e.target.value as FailCondition['trigger'] })}
                      style={{ flex: 1 }}
                      aria-label="Fail trigger"
                    >
                      {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`scenario-hint-lines-${fc.id}`}>Hint Lines (one per line → shown with line breaks)</label>
                    <textarea
                      id={`scenario-hint-lines-${fc.id}`}
                      value={fc.hintLines.join('\n')}
                      onChange={e => updateFailCondition(fc.id, { hintLines: e.target.value.split('\n') })}
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="section-title">Post-Kill Retaliations</div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            When a specific enemy is killed, a surviving enemy retaliates.
          </p>
          {scenario.retaliations.map((ret, i) => (
            <div key={i} className="ret-card">
              <div className="row" style={{ marginBottom: 6 }}>
                <div className="field">
                  <label htmlFor={`scenario-ret-killed-${i}`}>When killed</label>
                  <select id={`scenario-ret-killed-${i}`} value={ret.killedUnitId}
                    onChange={e => updateRetaliation(i, { killedUnitId: e.target.value })}>
                    {config.enemyUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`scenario-ret-retaliator-${i}`}>Retaliator</label>
                  <select id={`scenario-ret-retaliator-${i}`} value={ret.retaliatorUnitId}
                    onChange={e => updateRetaliation(i, { retaliatorUnitId: e.target.value })}>
                    {config.enemyUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ maxWidth: 80 }}>
                  <label htmlFor={`scenario-ret-damage-${i}`}>Damage</label>
                  <input id={`scenario-ret-damage-${i}`} type="number" min={0} value={ret.damage}
                    onChange={e => updateRetaliation(i, { damage: +e.target.value })} />
                </div>
                <button className="unit-remove" style={{ alignSelf: 'flex-end', marginBottom: 2 }}
                  aria-label="Remove retaliation" onClick={() => removeRetaliation(i)}>✕</button>
              </div>
              <div className="field">
                <label htmlFor={`scenario-ret-speech-${i}`}>Speech Text</label>
                <input id={`scenario-ret-speech-${i}`} type="text" value={ret.speechText}
                  onChange={e => updateRetaliation(i, { speechText: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`scenario-ret-followup-${i}`}>Follow-up Speech</label>
                <input id={`scenario-ret-followup-${i}`} type="text" value={ret.followUpSpeech}
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
            <div
              className="popup-section-title"
              role="button"
              tabIndex={0}
              aria-expanded={openSections.firstTurn}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => toggleSection('firstTurn')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  toggleSection('firstTurn');
                }
              }}
            >
              <span>Who starts?</span>
              <span aria-hidden="true">{openSections.firstTurn ? '▾' : '▸'}</span>
            </div>
            {openSections.firstTurn && (
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
            )}
          </div>

          {/* Player Turn Order */}
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div
              className="popup-section-title"
              role="button"
              tabIndex={0}
              aria-expanded={openSections.playerTurns}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => toggleSection('playerTurns')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  toggleSection('playerTurns');
                }
              }}
            >
              <span>Player Turn Order</span>
              <span aria-hidden="true">{openSections.playerTurns ? '▾' : '▸'}</span>
            </div>
            {openSections.playerTurns && (
              <>
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
                      aria-label="Turn unit"
                    >
                      {config.playerUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <button className="unit-remove"
                      disabled={(alt?.playerTurns ?? []).length <= 1}
                      aria-label="Remove turn" onClick={() => removePlayerTurn(pt.id)}>✕</button>
                  </div>
                ))}
                <button className="btn-add" onClick={addPlayerTurn}>+ Add Turn</button>
              </>
            )}
          </div>

          {/* Enemy Turn Sequence */}
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div
              className="popup-section-title"
              role="button"
              tabIndex={0}
              aria-expanded={openSections.enemyTurns}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => toggleSection('enemyTurns')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  toggleSection('enemyTurns');
                }
              }}
            >
              <span>Enemy Turn Sequence</span>
              <span aria-hidden="true">{openSections.enemyTurns ? '▾' : '▸'}</span>
            </div>
            {openSections.enemyTurns && (
              <>
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
                        aria-label="Attacker"
                        value={turn.attackerUnitId}
                        onChange={e => updateEnemyTurn(turn.id, { attackerUnitId: e.target.value })}
                        style={{ flex: '1 1 90px', minWidth: 80 }}
                      >
                        {config.enemyUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <select
                        title="Action"
                        aria-label="Action"
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
                            aria-label="Target player unit"
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
                              type="number" min={0} max={gridCols - 1} value={turn.moveTargetCol ?? 0}
                              onChange={e => updateEnemyTurn(turn.id, { moveTargetCol: +e.target.value })}
                              style={{ width: 50 }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                            <input
                              type="number" min={0} max={gridRows - 1} value={turn.moveTargetRow ?? 0}
                              onChange={e => updateEnemyTurn(turn.id, { moveTargetRow: +e.target.value })}
                              style={{ width: 50 }}
                            />
                          </div>
                        </>
                      )}
                      <button className="unit-remove" aria-label="Remove enemy turn" onClick={() => removeEnemyTurn(turn.id)}>✕</button>
                    </div>
                  );
                })}
                <button className="btn-add" onClick={addEnemyTurn}>+ Add Enemy Turn</button>
              </>
            )}
          </div>

          {/* Attack Reactions */}
          <div className="popup-section">
            <div
              className="popup-section-title"
              role="button"
              tabIndex={0}
              aria-expanded={openSections.reactions}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => toggleSection('reactions')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  toggleSection('reactions');
                }
              }}
            >
              <span>Enemy Reactions (when player attacks)</span>
              <span aria-hidden="true">{openSections.reactions ? '▾' : '▸'}</span>
            </div>
            {openSections.reactions && (
              <>
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
                            <label htmlFor={`scenario-reaction-damage-${reaction.enemyUnitId}`}>Damage</label>
                            <input id={`scenario-reaction-damage-${reaction.enemyUnitId}`} type="number" min={0} value={reaction.retaliationDamage}
                              onChange={e => updateAttackReaction(reaction.enemyUnitId, { retaliationDamage: +e.target.value })} />
                          </div>
                          <div className="field">
                            <label htmlFor={`scenario-reaction-speech-${reaction.enemyUnitId}`}>Retaliation Speech</label>
                            <input id={`scenario-reaction-speech-${reaction.enemyUnitId}`} type="text" value={reaction.retaliationSpeech}
                              onChange={e => updateAttackReaction(reaction.enemyUnitId, { retaliationSpeech: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
