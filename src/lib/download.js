/**
 * Open a signed download returned by an export endpoint.
 *
 * Previously lived in the Stage 1 page, which no longer exists — the
 * Company Profile replaced it. Moved here so the export consumers
 * (strategy reports, investor materials) don't depend on a page module.
 */
export function openDownload(res) {
  const url = res?.downloadUrl;
  if (!url) return;
  // Signed URLs come back either absolute or relative to the API host.
  const absolute = url.startsWith('http')
    ? url
    : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  window.open(absolute, '_blank', 'noopener');
}
