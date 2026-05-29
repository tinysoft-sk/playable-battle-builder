import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function BackgroundPanel() {
  const { config, setBackground, setGridTile } = useBattleStore();

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
      <div className="section-title">Grid Tiles</div>
      <div className="field">
        <label>Walkable Hex Tile</label>
        <AssetUpload label="Walkable hex" asset={config.gridTiles.walkable}
          onChange={a => setGridTile('walkable', a)} />
      </div>
      <div className="field">
        <label>Active Hex Tile</label>
        <AssetUpload label="Active hex" asset={config.gridTiles.active}
          onChange={a => setGridTile('active', a)} />
      </div>
    </div>
  );
}
