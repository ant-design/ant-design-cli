export function getErrorText(err: unknown): string {
  const parts: string[] = [];

  if (err instanceof Error) {
    parts.push(err.message);
  }

  if (err && typeof err === 'object' && 'stderr' in err) {
    const stderr = err.stderr;
    parts.push(Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr ?? ''));
  }

  return parts.join('\n').toLowerCase();
}

export function isNpmPackageNotFoundError(err: unknown): boolean {
  const errorText = getErrorText(err);
  return errorText.includes('e404')
    || errorText.includes('404 not found')
    || errorText.includes('not in this registry')
    || errorText.includes('no match found for version');
}
