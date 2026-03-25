/**
 * Post a package size report comment on a PR.
 * Called by the pkg-size GitHub Actions workflow via actions/github-script.
 *
 * @param {object} params
 * @param {import('@octokit/rest').Octokit} params.github
 * @param {object} params.context
 * @param {number} params.size - packed size in bytes
 * @param {number} params.unpackSize - unpacked size in bytes
 * @param {number} params.baseSize - base branch packed size in bytes
 * @param {number} params.baseUnpackSize - base branch unpacked size in bytes
 */
module.exports = async ({ github, context, size, unpackSize, baseSize, baseUnpackSize }) => {
  function formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(2) + ' KB';
  }

  function formatDiff(current, base) {
    const diff = current - base;
    if (diff === 0) return '±0';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${formatBytes(Math.abs(diff))} (${sign}${((diff / base) * 100).toFixed(1)}%)`;
  }

  const body = [
    '## 📦 Package Size Report',
    '',
    '| Metric | Size | Diff |',
    '| --- | --- | --- |',
    `| Packed | ${formatBytes(size)} | ${formatDiff(size, baseSize)} |`,
    `| Unpacked | ${formatBytes(unpackSize)} | ${formatDiff(unpackSize, baseUnpackSize)} |`,
  ].join('\n');

  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });
  const existing = comments.find((c) => c.body.includes('📦 Package Size Report'));

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body,
    });
  }
};
