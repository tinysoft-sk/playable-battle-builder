import { useState } from 'react';
import { useBattleStore } from './store/battleStore';
import UnitsPanel from './components/panels/UnitsPanel';
import HeroPanel from './components/panels/HeroPanel';
import SpellsPanel from './components/panels/SpellsPanel';
import ScenarioPanel from './components/panels/ScenarioPanel';
import PopupsPanel from './components/panels/PopupsPanel';
import StorePanel from './components/panels/StorePanel';
import AudioPanel from './components/panels/AudioPanel';
import BackgroundPanel from './components/panels/BackgroundPanel';
import LibraryPanel from './components/LibraryPanel';
import LivePreview from './components/preview/LivePreview';
import ExportDialog from './components/export/ExportDialog';
import TemplatesModal from './components/TemplatesModal';
import './App.css';

type NavItem = 'units' | 'heroes' | 'spells' | 'scenario' | 'popups' | 'backgrounds' | 'store' | 'audio' | 'library';

const NAV_ITEMS: { id: NavItem; label: string }[] = [
  { id: 'units',       label: 'Units' },
  { id: 'heroes',      label: 'Heroes' },
  { id: 'spells',      label: 'Spells' },
  { id: 'scenario',    label: 'Scenario' },
  { id: 'popups',      label: 'Popups' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'store',       label: 'Store' },
  { id: 'audio',       label: 'Audio' },
  { id: 'library',     label: '📚 Library' },
];

export default function App() {
  const [section, setSection] = useState<NavItem>('units');
  const [showExport, setShowExport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { config, setName, undo, redo, undoStack, redoStack } = useBattleStore();

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">⚔ Battle Editor</span>
        <input
          className="project-name"
          value={config.name}
          onChange={e => setName(e.target.value)}
        />
        <div className="header-actions">
          <button onClick={undo}  disabled={!undoStack.length} title="Undo (Ctrl+Z)">↩ Undo</button>
          <button onClick={redo}  disabled={!redoStack.length} title="Redo (Ctrl+Y)">↪ Redo</button>
          <button onClick={() => setShowTemplates(true)}>📋 Templates</button>
          <button className="btn-export" onClick={() => setShowExport(true)}>⬇ Export</button>
        </div>
      </header>

      <div className="app-body">
        <nav className="app-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="app-config">
          {section === 'units'       && <UnitsPanel />}
          {section === 'heroes'      && <HeroPanel />}
          {section === 'spells'      && <SpellsPanel />}
          {section === 'scenario'    && <ScenarioPanel />}
          {section === 'popups'      && <PopupsPanel />}
          {section === 'backgrounds' && <BackgroundPanel />}
          {section === 'store'       && <StorePanel />}
          {section === 'audio'       && <AudioPanel />}
          {section === 'library'     && <LibraryPanel />}
        </main>

        <aside className="app-preview">
          <LivePreview />
        </aside>
      </div>

      {showExport    && <ExportDialog    onClose={() => setShowExport(false)} />}
      {showTemplates && <TemplatesModal  onClose={() => setShowTemplates(false)} />}
    </div>
  );
}
