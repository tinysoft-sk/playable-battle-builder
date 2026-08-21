export interface BuiltInTemplate {
  id: string;
  name: string;
  file: string;
}

// Bundled with the app (served from public/templates/) so these stay
// available to anyone who opens the editor, on any machine, regardless of
// browser storage — independent of the shared template list, which requires
// the Worker to be reachable.
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  { id: 'ham_battle_alt_02', name: 'HAM Battle Alt 02', file: 'HAM_Battle_alt_02.json' },
  { id: 'ham_domino_effect', name: 'HAM Domino Effect', file: 'HAM_DominoEffect.json' },
  { id: 'ham_snipers_dilemma', name: 'HAM Snipers Dilemma', file: 'HAM_SnipersDilema.json' },
  { id: 'ham_swarm_v1', name: 'HAM Swarm V1', file: 'HAM_Swarm_V1.json' },
];
