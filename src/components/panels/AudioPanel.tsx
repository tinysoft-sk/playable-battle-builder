import { useBattleStore } from '../../store/battleStore';
import type { AudioEvent } from '../../types/battle';
import AssetUpload from '../AssetUpload';
import { FIXED_ROLE_KEYS, audioRoleKey } from '../../utils/roleKeys';

const SFX_GROUPS: { label: string; events: AudioEvent[] }[] = [
  { label: 'UI Sounds', events: ['spellbook_open', 'spell_select', 'grid_select'] },
  { label: 'Movement', events: ['walk'] },
  { label: 'Spells', events: ['spell1_shoot', 'spell1_hit', 'spell2_shoot', 'spell2_hit'] },
  { label: 'Player Combat', events: ['player_attack', 'player_ranged_attack', 'player_flying_attack', 'player_death'] },
  { label: 'Enemy Combat', events: ['flying_attack', 'flying_death', 'ranged_attack', 'ranged_death', 'melee_attack', 'melee_death'] },
  { label: 'Other', events: ['fail'] },
];

const EVENT_LABELS: Record<string, string> = {
  spellbook_open:  'Spellbook Open',
  spell_select:    'Spell Select',
  walk:            'Walk',
  grid_select:     'Grid Select',
  spell1_shoot:    'Spell 1 – Shoot',
  spell1_hit:      'Spell 1 – Hit',
  spell2_shoot:    'Spell 2 – Shoot',
  spell2_hit:      'Spell 2 – Hit',
  player_attack:         'Player Attack (Melee)',
  player_ranged_attack:  'Player Attack (Ranged)',
  player_flying_attack:  'Player Attack (Flying)',
  player_death:          'Player Death',
  flying_attack:         'Flying Enemy Attack',
  flying_death:          'Flying Enemy Death',
  ranged_attack:         'Ranged Enemy Attack',
  ranged_death:          'Ranged Enemy Death',
  melee_attack:          'Melee Enemy Attack',
  melee_death:           'Melee Enemy Death',
  fail:                  'Fail',
};

export default function AudioPanel() {
  const { config, setMusic, setSfx } = useBattleStore();

  return (
    <div>
      <div className="panel-title">Audio</div>
      <div className="field">
        <div className="field-label">Background Music</div>
        <AssetUpload
          label="Music track"
          asset={config.audio.music}
          accept="audio/*"
          roleKey={FIXED_ROLE_KEYS.audioMusic}
          onChange={setMusic}
        />
      </div>
      {SFX_GROUPS.map(group => (
        <div key={group.label}>
          <div className="section-title">{group.label}</div>
          <div className="audio-grid">
            {group.events.map(ev => (
              <div key={ev} className="field">
                <div className="field-label">{EVENT_LABELS[ev] ?? ev}</div>
                <AssetUpload
                  label={EVENT_LABELS[ev] ?? ev}
                  asset={config.audio.sfxMap[ev] ?? null}
                  accept="audio/*"
                  roleKey={audioRoleKey(ev)}
                  onChange={a => setSfx(ev, a)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
