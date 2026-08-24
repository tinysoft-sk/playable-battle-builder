import { useBattleStore } from '../../store/battleStore';

export default function StorePanel() {
  const { config, setStore } = useBattleStore();
  const { store } = config;

  return (
    <div>
      <div className="panel-title">Store / CTA</div>
      <div className="field">
        <label htmlFor="store-ios-url">iOS App Store URL</label>
        <input id="store-ios-url" type="url" placeholder="https://apps.apple.com/…" value={store.iosUrl} onChange={e => setStore({ iosUrl: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="store-android-url">Android Play Store URL</label>
        <input id="store-android-url" type="url" placeholder="https://play.google.com/store/apps/…" value={store.androidUrl} onChange={e => setStore({ androidUrl: e.target.value })} />
      </div>
      <div className="field" style={{ maxWidth: 180 }}>
        <label htmlFor="store-cta-fail-count">Show Store Button After N Fails</label>
        <input
          id="store-cta-fail-count"
          type="number"
          min={1}
          value={store.ctaFailCount}
          onChange={e => setStore({ ctaFailCount: +e.target.value })}
        />
      </div>
    </div>
  );
}
