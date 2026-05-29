import type { AssetData } from '../types/battle';

export function encodeFile(file: File): Promise<AssetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        dataUri: reader.result as string,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function estimateSize(html: string): number {
  return new Blob([html]).size;
}
