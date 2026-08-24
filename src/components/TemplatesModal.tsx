import { useRef, useState } from 'react';
import { useBattleStore } from '../store/battleStore';
import type { BattleConfig } from '../types/battle';
import { BUILT_IN_TEMPLATES } from '../data/builtInTemplates';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface Props { onClose: () => void; }

export default function TemplatesModal({ onClose }: Props) {
  const { config, sharedTemplates, saveTemplate, loadTemplate, deleteTemplate, loadConfig, pendingTemplatePublishes, retryTemplatePublish } = useBattleStore();
  const [saveName, setSaveName] = useState(config.name);
  const [loadingBuiltIn, setLoadingBuiltIn] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogA11y(onClose);
  const failedTemplates = Object.entries(pendingTemplatePublishes).filter(([, p]) => p.status === 'failed');

  function doSave() {
    const name = saveName.trim();
    if (!name) return;
    if (sharedTemplates.some(t => t.name === name) && !confirm(`A shared template named "${name}" already exists. Overwrite it for everyone?`)) {
      return;
    }
    saveTemplate(name);
    setSaveName('');
  }

  async function loadBuiltIn(file: string, id: string) {
    setLoadingBuiltIn(id);
    try {
      const res = await fetch(`templates/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await res.json() as BattleConfig;
      loadConfig(parsed);
      onClose();
    } catch (err) {
      console.error('Failed to load built-in template', err);
      alert(`Could not load built-in template: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingBuiltIn(null);
    }
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
      <div className="dialog" style={{ width: 460 }} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="templates-dialog-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 id="templates-dialog-title">Templates</h2>
          <button className="asset-clear" aria-label="Close" style={{ fontSize: 18 }} onClick={onClose}>✕</button>
        </div>

        {/* Save current */}
        <div className="popup-section" style={{ marginBottom: 14 }}>
          <div className="popup-section-title">Save current as template</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="project-name"
              style={{ flex: 1, maxWidth: 'none' }}
              value={saveName}
              placeholder="e.g. Boss Fight Lv.3…"
              autoComplete="off"
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSave()}
            />
            <button className="btn-primary" onClick={doSave}>Save</button>
          </div>
        </div>

        {/* Built-in templates */}
        {BUILT_IN_TEMPLATES.length > 0 && (
          <div className="popup-section" style={{ marginBottom: 14 }}>
            <div className="popup-section-title">Built-in templates</div>
            {BUILT_IN_TEMPLATES.map(t => (
              <div key={t.id} className="template-item">
                <span className="template-name">{t.name}</span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                  disabled={loadingBuiltIn === t.id}
                  onClick={() => loadBuiltIn(t.file, t.id)}>
                  {loadingBuiltIn === t.id ? 'Loading…' : 'Load'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Shared templates */}
        <div className="popup-section" style={{ marginBottom: 14 }}>
          <div className="popup-section-title">Shared templates</div>
          {failedTemplates.length > 0 && (
            <div role="status" aria-live="polite" style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{failedTemplates.length} template change{failedTemplates.length > 1 ? 's' : ''} not yet synced.</span>
              <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => failedTemplates.forEach(([name]) => retryTemplatePublish(name))}>
                Retry
              </button>
            </div>
          )}
          {sharedTemplates.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No shared templates yet.</div>
          ) : (
            sharedTemplates.map(t => (
              <div key={t.name} className="template-item">
                <span className="template-name">{t.name}</span>
                <span className="template-date">{new Date(t.savedAt).toLocaleTimeString()}</span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { loadTemplate(t.name); onClose(); }}>Load</button>
                <button className="asset-clear" aria-label={`Delete ${t.name}`} onClick={() => { if (confirm(`Delete shared template "${t.name}" for everyone? This can't be undone.`)) deleteTemplate(t.name); }}>✕</button>
              </div>
            ))
          )}
        </div>

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
