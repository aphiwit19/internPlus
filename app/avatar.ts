export function getDefaultAvatarUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#F1F5F9"/>
  <circle cx="50" cy="40" r="16" fill="#94A3B8"/>
  <path d="M20 88c0-16 14-28 30-28s30 12 30 28" fill="#94A3B8"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function normalizeAvatarUrl(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return getDefaultAvatarUrl();
  if (v.startsWith('https://picsum.photos/')) return getDefaultAvatarUrl();
  return v;
}
