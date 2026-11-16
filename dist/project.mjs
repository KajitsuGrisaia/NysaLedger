// Public destinations approved by the project owner.
export const project = Object.freeze({
  name: 'NysaLedger',
  version: '0.2.0',
  repositoryUrl: 'https://github.com/KajitsuGrisaia/NysaLedger',
  supportUrl: 'https://ko-fi.com/nysasoft',
  websiteUrl: 'https://nysasoft.io',
});

export function externalUrl(value) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
