import { useState } from 'react';
import { useBattleStore } from '../../store/battleStore';
import { generateHTML } from '../../utils/htmlGenerator';
import type { NetworkTarget } from '../../types/battle';
import { estimateSize, formatBytes } from '../../utils/assetEncoder';

interface NetworkInfo {
  id: NetworkTarget;
  label: string;
  limitBytes: number;
  format: string;
}

const NETWORKS: NetworkInfo[] = [
  { id: 'facebook',   label: 'Facebook',      limitBytes: 2 * 1024 * 1024, format: '.html' },
  { id: 'google',     label: 'Google Ads',    limitBytes: 5 * 1024 * 1024, format: '.zip'  },
  { id: 'unity',      label: 'Unity/AppLovin',limitBytes: 5 * 1024 * 1024, format: '.html' },
  { id: 'mintegral',  label: 'Mintegral',     limitBytes: 5 * 1024 * 1024, format: '.zip'  },
];

interface Props { onClose: () => void; }

export default function ExportDialog({ onClose }: Props) {
  const config = useBattleStore(s => s.config);
  const [working, setWorking] = useState(false);

  const sizes = NETWORKS.map(n => {
    try {
      const html = generateHTML(config, n.id);
      const bytes = estimateSize(html);
      return { ...n, bytes, ok: bytes <= n.limitBytes };
    } catch {
      return { ...n, bytes: 0, ok: false };
    }
  });

  async function downloadAll() {
    setWorking(true);
    const slug = config.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'battle';
    for (const n of NETWORKS) {
      try {
        const html = generateHTML(config, n.id);
        if (n.id === 'google' || n.id === 'mintegral') {
          await downloadZip(n.id, slug, html);
        } else {
          downloadHtml(slug + '-' + n.id + '.html', html);
        }
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error('Export error', n.id, e);
      }
    }
    setWorking(false);
  }

  function downloadSingle(n: NetworkInfo) {
    const slug = config.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'battle';
    const html = generateHTML(config, n.id);
    if (n.id === 'google' || n.id === 'mintegral') {
      downloadZip(n.id, slug, html);
    } else {
      downloadHtml(slug + '-' + n.id + '.html', html);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog">
        <h2>Export</h2>

        {sizes.map(n => (
          <div key={n.id} className="network-row">
            <span className="network-name">{n.label}</span>
            <span className={`network-size ${n.ok ? 'size-ok' : 'size-bad'}`}>
              {formatBytes(n.bytes)} / {formatBytes(n.limitBytes)} {n.ok ? '✓' : '⚠ OVER'}
            </span>
            <span style={{ fontSize: 11, color: '#666' }}>{n.format}</span>
            <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => downloadSingle(n)}>
              Download
            </button>
          </div>
        ))}

        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={working} onClick={downloadAll}>
            {working ? 'Exporting…' : '⬇ Download All'}
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip(network: NetworkTarget, slug: string, html: string) {
  // dynamic import fflate (installed as dep)
  const { zipSync, strToU8 } = await import('fflate');
  let files: Record<string, Uint8Array>;
  if (network === 'google') {
    files = { 'index.html': strToU8(html) };
  } else {
    // mintegral: split at first <script> tag that has inline code
    const splitIdx = html.lastIndexOf('<script>');
    const htmlPart  = html.slice(0, splitIdx) + '<script defer src="main.js"></script>\n</body>\n</html>';
    const scriptPart = html.slice(splitIdx + '<script>'.length, html.lastIndexOf('</script>'));
    const folder = slug + '-mintegral';
    files = {
      [`${folder}/index.html`]: strToU8(htmlPart),
      [`${folder}/main.js`]:    strToU8(scriptPart),
    };
  }
  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slug + '-' + network + '.zip';
  a.click();
  URL.revokeObjectURL(url);
}
