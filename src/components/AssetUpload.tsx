import { useRef, useState } from 'react';
import type { AssetData } from '../types/battle';
import { encodeFile } from '../utils/assetEncoder';
import { useBattleStore } from '../store/battleStore';
import LibraryPickerModal from './LibraryPickerModal';

interface Props {
  label: string;
  asset: AssetData | null;
  accept?: string;
  roleKey?: string | null;
  onChange: (a: AssetData | null) => void;
}

export default function AssetUpload({ label, asset, accept = 'image/*', roleKey = null, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const { addToLibrary, recordUpload, setRoleDefault } = useBattleStore();
  const isAudio = accept.includes('audio');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const encoded = await encodeFile(file);
    const data: AssetData = { ...encoded, libraryAssetId: crypto.randomUUID() };
    onChange(data);
    if (roleKey) recordUpload(roleKey, data);
    e.target.value = '';
  }

  return (
    <div className="asset-upload-wrap">
      <label className={`asset-upload${asset ? ' has-asset' : ''}`}>
        <input ref={inputRef} type="file" accept={accept} onChange={onFile} />
        {asset ? (
          isAudio ? (
            <div className="asset-thumb-audio">🔊</div>
          ) : (
            <img className="asset-thumb" src={asset.dataUri} alt={asset.fileName} />
          )
        ) : (
          <div className="asset-thumb-audio" style={{ color: 'var(--text-muted)', fontSize: 22 }}>
            {isAudio ? '🔊' : '🖼'}
          </div>
        )}
        <div className="asset-info">
          <div className="name">{asset ? asset.fileName : label}</div>
          <div className="hint">{asset ? '' : 'Click to upload'}</div>
        </div>
        {asset && (
          <>
            <button
              className="asset-action-btn"
              aria-label="Save to library"
              title="Save to library"
              onClick={e => { e.preventDefault(); addToLibrary(asset); }}
            >
              💾
            </button>
            <button
              className="asset-clear"
              aria-label={`Remove ${asset.fileName}`}
              title="Remove"
              onClick={e => { e.preventDefault(); onChange(null); }}
            >
              ✕
            </button>
          </>
        )}
      </label>
      <button className="asset-lib-btn" onClick={() => setShowPicker(true)}>
        📚 Library
      </button>
      {showPicker && (
        <LibraryPickerModal
          accept={accept}
          onSelect={a => {
            onChange({ dataUri: a.dataUri, mimeType: a.mimeType, fileName: a.fileName, libraryAssetId: a.id });
            if (roleKey) setRoleDefault(roleKey, a.id);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
