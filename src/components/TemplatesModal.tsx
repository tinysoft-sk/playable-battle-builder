import { useRef, useState } from 'react';
import { useBattleStore } from '../store/battleStore';
import type { BattleConfig } from '../types/battle';

interface Props { onClose: () => void; }

export default function TemplatesModal({ onClose }: Props) {
  const { config, templates, saveTemplate, loadTemplate, deleteTemplate, loadConfig } = useBattleStore();
  const [saveName, setSaveName] = useState(config.name);
  const importRef = useRef<HTMLInputElement>(null);

  function doSave() {
    const name = saveName.trim();
    if (!name) return;
    saveTemplate(name);
    setSaveName('');
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as BattleConfig;
        loadConfig(parsed);
        onClose();
      } catch {
        alert('Invalid config JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2>Templates</h2>
          <button className="asset-clear" style={{ fontSize: 18 }} onClick={onClose}>✕</button>
        </div>

        {/* Save current */}
        <div className="popup-section" style={{ marginBottom: 14 }}>
          <div className="popup-section-title">Save current as template</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="project-name"
              style={{ flex: 1, maxWidth: 'none' }}
              value={saveName}
              placeholder="Template name"
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSave()}
            />
            <button className="btn-primary" onClick={doSave}>Save</button>
          </div>
        </div>

        {/* Saved list */}
        {templates.length > 0 && (
          <div className="popup-section" style={{ marginBottom: 14 }}>
            <div className="popup-section-title">Saved templates (this session)</div>
            {templates.map(t => (
              <div key={t.id} className="template-item">
                <span className="template-name">{t.name}</span>
                <span className="template-date">{new Date(t.savedAt).toLocaleTimeString()}</span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { loadTemplate(t.id); onClose(); }}>Load</button>
                <button className="asset-clear" onClick={() => deleteTemplate(t.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* JSON export / import */}
        <div className="popup-section">
          <div className="popup-section-title">JSON config file</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={exportJSON}>⬇ Export JSON</button>
            <button className="btn-secondary" onClick={() => importRef.current?.click()}>⬆ Import JSON</button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
          </div>
        </div>
      </div>
    </div>
  );
}
