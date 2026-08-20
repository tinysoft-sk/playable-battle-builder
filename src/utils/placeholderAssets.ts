import type { AssetData } from '../types/battle';

function svgAsset(fileName: string, svg: string): AssetData {
  return {
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    mimeType: 'image/svg+xml',
    fileName,
  };
}

export const PLACEHOLDER_UNIT_IDLE: AssetData = svgAsset(
  'placeholder-unit-idle.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#3a3a4a"/>
    <circle cx="64" cy="48" r="24" fill="#6a6a80"/>
    <rect x="32" y="76" width="64" height="44" rx="10" fill="#6a6a80"/>
    <text x="64" y="122" font-size="10" fill="#ffffff" text-anchor="middle" font-family="sans-serif">no sprite</text>
  </svg>`
);

export const PLACEHOLDER_UNIT_ATTACK: AssetData = svgAsset(
  'placeholder-unit-attack.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#4a3a3a"/>
    <circle cx="64" cy="48" r="24" fill="#a06a6a"/>
    <rect x="32" y="76" width="64" height="44" rx="10" fill="#a06a6a"/>
    <text x="64" y="122" font-size="10" fill="#ffffff" text-anchor="middle" font-family="sans-serif">no sprite</text>
  </svg>`
);

export const PLACEHOLDER_PROJECTILE: AssetData = svgAsset(
  'placeholder-projectile.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="12" fill="#ffcc55"/>
  </svg>`
);

export const PLACEHOLDER_ICON: AssetData = svgAsset(
  'placeholder-icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" rx="8" fill="#555566"/>
    <text x="24" y="30" font-size="22" fill="#ffffff" text-anchor="middle" font-family="sans-serif">?</text>
  </svg>`
);
