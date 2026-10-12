import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';

interface Livrable {
  id: string;
  name: string;
  mimeType?: string;
  size?: number | string;
  webViewLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
}

interface Props {
  tacheId: number;
  /** Types Drive de la tache, separes par des virgules (ex: "Video,Post"). */
  typeDrive?: string;
  canUpload: boolean;
}

const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.mkv,.webm,.m4v,.pdf,.zip';

const displayName = (n: string) => n.replace(/^T\d+_/, '');
const formatSize = (s?: number | string) => {
  const n = Number(s);
  if (!n) return '';
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;
};

/** Depot et liste des fichiers finaux d'une tache : envoyes directement dans Google Drive. */
const LivrablesSection: React.FC<Props> = ({ tacheId, typeDrive, canUpload }) => {
  const types = (typeDrive ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const [files, setFiles] = useState<Livrable[]>([]);
  const [type, setType] = useState(types[0] ?? '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api.get(`/taches/${tacheId}/livrables`)
      .then((r) => setFiles(r.data?.data ?? []))
      .catch(() => setFiles([]));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tacheId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setProgress(0);
    const form = new FormData();
    form.append('file', file);
    if (type) form.append('type', type);
    try {
      await api.post(`/taches/${tacheId}/livrables`, form, {
        timeout: 0,
        onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Échec de l'envoi du fichier");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">🎬 Livrables (envoyés sur Drive)</p>
        {canUpload && (
          <div className="flex items-center gap-2">
            {types.length > 1 && (
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800">
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <button type="button" disabled={progress !== null} onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {progress !== null ? `Envoi ${progress}%` : '+ Ajouter un fichier'}
            </button>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />
          </div>
        )}
      </div>
      {progress !== null && (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {files.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun fichier livré pour le moment.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-theme-sm">
              <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                className="truncate text-brand-600 underline hover:text-brand-700 dark:text-brand-400">
                {displayName(f.name)}
              </a>
              <span className="shrink-0 text-xs text-gray-400">{formatSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LivrablesSection;
