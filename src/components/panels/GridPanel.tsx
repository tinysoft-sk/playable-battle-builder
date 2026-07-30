import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function GridPanel() {
  const { config, setGridSize, setGridOffset, setGridTile } = useBattleStore();
  const grid = config.grid ?? { cols: 5, rows: 4 };
  const gridOffset = config.gridOffset ?? { landscape: 0, portrait: 0 };

  return (
    <div>
      <div className="panel-title">Grid</div>

      <div className="section-title">Grid Size</div>
      <div className="row">
        <div className="field">
          <label>Columns</label>
          <input type="number" min={2} max={10} value={grid.cols}
            onChange={e => setGridSize({ cols: +e.target.value })} />
        </div>
        <div className="field">
          <label>Rows</label>
          <input type="number" min={2} max={8} value={grid.rows}
            onChange={e => setGridSize({ rows: +e.target.value })} />
        </div>
      </div>

      <div className="section-title">Grid Position</div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        Shift the battle grid up (negative) or down (positive) in pixels.
      </p>
      <div className="row">
        <div className="field">
          <label>Landscape offset Y</label>
          <input type="number" step={10} value={gridOffset.landscape}
            onChange={e => setGridOffset('landscape', +e.target.value)} />
        </div>
        <div className="field">
          <label>Portrait offset Y</label>
          <input type="number" step={10} value={gridOffset.portrait}
            onChange={e => setGridOffset('portrait', +e.target.value)} />
        </div>
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
