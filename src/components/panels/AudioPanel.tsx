import { useBattleStore } from '../../store/battleStore';
import { AUDIO_EVENTS } from '../../types/battle';
import AssetUpload from '../AssetUpload';

const EVENT_LABELS: Record<string, string> = {
  spellbook_open:  'Spellbook Open',
  spell_select:    'Spell Select',
  walk:            'Walk',
  grid_select:     'Grid Select',
  spell1_shoot:    'Spell 1 – Shoot',
  spell1_hit:      'Spell 1 – Hit',
  spell2_shoot:    'Spell 2 – Shoot',
  spell2_hit:      'Spell 2 – Hit',
  player_attack:   'Player Attack',
  player_death:    'Player Death',
  flying_attack:   'Flying Enemy Attack',
  flying_death:    'Flying Enemy Death',
  ranged_attack:   'Ranged Enemy Attack',
  ranged_death:    'Ranged Enemy Death',
  fail:            'Fail',
};

export default function AudioPanel() {
  const { config, setMusic, setSfx } = useBattleStore();

  return (
    <div>
      <div className="panel-title">Audio</div>
      <div className="field">
        <label>Background Music</label>
        <AssetUpload
          label="Music track"
          asset={config.audio.music}
          accept="audio/*"
          onChange={setMusic}
        />
      </div>
      <div className="section-title">Sound Effects</div>
      <div className="audio-grid">
        {AUDIO_EVENTS.map(ev => (
          <div key={ev} className="field">
            <label>{EVENT_LABELS[ev] ?? ev}</label>
            <AssetUpload
              label={EVENT_LABELS[ev] ?? ev}
              asset={config.audio.sfxMap[ev] ?? null}
              accept="audio/*"
              onChange={a => setSfx(ev, a)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
