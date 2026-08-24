import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';
import { FIXED_ROLE_KEYS } from '../../utils/roleKeys';

export default function BackgroundPanel() {
  const { config, setBackground } = useBattleStore();

  return (
    <div>
      <div className="panel-title">Backgrounds</div>
      <div className="field">
        <div className="field-label">Landscape Background</div>
        <AssetUpload label="Landscape BG" asset={config.backgrounds.landscape}
          roleKey={FIXED_ROLE_KEYS.backgroundLandscape}
          onChange={a => setBackground('landscape', a)} />
      </div>
      <div className="field">
        <div className="field-label">Portrait Background</div>
        <AssetUpload label="Portrait BG" asset={config.backgrounds.portrait}
          roleKey={FIXED_ROLE_KEYS.backgroundPortrait}
          onChange={a => setBackground('portrait', a)} />
      </div>
    </div>
  );
}
