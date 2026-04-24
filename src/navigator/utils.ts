export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const COLORS = {
  primary: '#f97316',
  secondary: '#8b5cf6',
  accent: '#06b6d4',
  border: 'rgba(255,255,255,0.1)',
  muted: 'rgba(255,255,255,0.35)',
  card: 'rgba(255,255,255,0.03)',
  bg: '#020208',
};
