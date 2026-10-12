import React from 'react';

export const TYPES_DRIVE = ['Post', 'Video', 'Documentation'] as const;

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

/** Choix du/des type(s) de tache : determine le dossier Drive ou seront deposes les livrables. */
const TypeDrivePicker: React.FC<Props> = ({ value, onChange }) => (
  <div>
    <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
      Type de tâche <span className="text-error-500">*</span>
    </label>
    <div className="flex flex-wrap gap-2">
      {TYPES_DRIVE.map((t) => {
        const active = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(active ? value.filter((x) => x !== t) : [...value, t])}
            className={`rounded-full border px-4 py-1.5 text-theme-sm font-medium transition-colors ${
              active
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-500 dark:border-gray-600'
            }`}
          >
            {t === 'Video' ? '🎬 Vidéo' : t === 'Post' ? '🖼️ Post' : '📄 Documentation'}
          </button>
        );
      })}
    </div>
  </div>
);

export default TypeDrivePicker;
