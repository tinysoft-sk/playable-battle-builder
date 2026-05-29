import { useBattleStore } from '../../store/battleStore';

export default function StorePanel() {
  const { config, setStore } = useBattleStore();
  const { store } = config;

  return (
    <div>
      <div className="panel-title">Store / CTA</div>
      <div className="field">
        <label>iOS App Store URL</label>
        <input type="url" value={store.iosUrl} onChange={e => setStore({ iosUrl: e.target.value })} />
      </div>
      <div className="field">
        <label>Android Play Store URL</label>
        <input type="url" value={store.androidUrl} onChange={e => setStore({ androidUrl: e.target.value })} />
      </div>
      <div className="field" style={{ maxWidth: 180 }}>
        <label>Show Store Button After N Fails</label>
        <input
          type="number"
          min={1}
          value={store.ctaFailCount}
          onChange={e => setStore({ ctaFailCount: +e.target.value })}
        />
      </div>
    </div>
  );
}
