export function getPostLoginPath() {
  const candidate = new URLSearchParams(window.location.search).get('next');
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/';

  const destination = new URL(candidate, window.location.origin);
  return destination.origin === window.location.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : '/';
}
