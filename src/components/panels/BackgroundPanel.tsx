import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function BackgroundPanel() {
  const { config, setBackground } = useBattleStore();

  return (
    <div>
      <div className="panel-title">Backgrounds</div>
      <div className="field">
        <label>Landscape Background</label>
        <AssetUpload label="Landscape BG" asset={config.backgrounds.landscape}
          onChange={a => setBackground('landscape', a)} />
      </div>
      <div className="field">
        <label>Portrait Background</label>
        <AssetUpload label="Portrait BG" asset={config.backgrounds.portrait}
          onChange={a => setBackground('portrait', a)} />
      </div>
    </div>
  );
}
