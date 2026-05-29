import { useRef, useState } from 'react';
import type { AssetData } from '../types/battle';
import { encodeFile } from '../utils/assetEncoder';
import { useBattleStore } from '../store/battleStore';
import LibraryPickerModal from './LibraryPickerModal';

interface Props {
  label: string;
  asset: AssetData | null;
  accept?: string;
  onChange: (a: AssetData | null) => void;
}

export default function AssetUpload({ label, asset, accept = 'image/*', onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const { addToLibrary } = useBattleStore();
  const isAudio = accept.includes('audio');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(await encodeFile(file));
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
            <img className="asset-thumb" src={asset.dataUri} alt="" />
          )
        ) : (
          <div className="asset-thumb-audio" style={{ color: '#666', fontSize: 22 }}>
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
              title="Save to library"
              onClick={e => { e.preventDefault(); addToLibrary(asset); }}
            >
              💾
            </button>
            <button
              className="asset-clear"
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
          onSelect={a => { onChange(a); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
