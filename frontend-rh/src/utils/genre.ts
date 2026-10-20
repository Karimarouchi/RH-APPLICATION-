export type NormalizedGenre = 'HOMME' | 'FEMME';

const stripAccents = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '');

export function normalizeGenre(genre?: string | null): NormalizedGenre | null {
  if (!genre?.trim()) return null;
  const n = stripAccents(genre.trim()).toUpperCase();
  if (['HOMME', 'MASCULIN', 'MALE', 'M', 'H'].includes(n)) return 'HOMME';
  if (['FEMME', 'FEMININ', 'FEMALE', 'F'].includes(n)) return 'FEMME';
  return null;
}

export function formatGenreLabel(genre?: string | null): string {
  const normalized = normalizeGenre(genre);
  if (normalized === 'HOMME') return 'Homme';
  if (normalized === 'FEMME') return 'Femme';
  if (genre?.trim()) return genre.trim();
  return 'Genre non défini';
}

export function formatGenreIcon(genre?: string | null): string {
  const normalized = normalizeGenre(genre);
  if (normalized === 'HOMME') return '♂';
  if (normalized === 'FEMME') return '♀';
  return '—';
}

export function formatGenreChartLabel(genre: string): string {
  const normalized = normalizeGenre(genre);
  if (normalized === 'HOMME') return 'Hommes';
  if (normalized === 'FEMME') return 'Femmes';
  return genre;
}
