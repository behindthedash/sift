# Automatic Sift versioning and release management

Sift has two distinct tokenless GitHub Actions workflows:

1. **Sift Release Manager** (`.github/workflows/release-manager.yml`) turns Conventional Commits on protected `main` into release PRs, `package.json` semver updates and a `CHANGELOG.md`. It starts on main pushes, daily at 10:17 UTC and on manual dispatch.
2. **Publish Sift to npm** (`.github/workflows/npm-stage.yml`) runs TypeScript, unit tests, build, package verification, Playwright and publishes a new version publicly through npm **Trusted Publishing (OIDC)**. It does not need a stored npm token.

## Release sequence

1. Merge ordinary work into `main` using Conventional Commit PR titles or commit messages (examples below). The manager reads changes since the last release baseline.
2. Release Please creates or updates one `chore(main): release X.Y.Z` PR. This PR changes **only** `package.json`, `.release-please-manifest.json`, `CHANGELOG.md` and, if it exists, `package-lock.json`.
3. GitHub's built-in `GITHUB_TOKEN` generally does **not** trigger ordinary `pull_request` workflows for bot-created PRs. Therefore the manager explicitly dispatches `ci.yml` with `workflow_dispatch` against the candidate branch. The existing **test-build** and **e2e** checks must both pass.
4. The manager verifies the GitHub Actions check results, re-reads the PR's head SHA, validates the release version and allowed file changes, and invokes **GitHub's ordinary squash-merge API**. The repository's "PR Required" ruleset and required checks remain enforced; there is no direct push to protected `main` or bypass.
5. A merge performed by `GITHUB_TOKEN` also suppresses ordinary `push` event workflows. The manager explicitly dispatches `npm-stage.yml` from `main` with the exact version and `PUBLISH` input. That workflow verifies its own branch and version, rebuilds and tests, checks npm for duplicate published versions, then publishes with GitHub OIDC.
6. On later scheduled runs, the coordinator checks if the version on main is already public and repairs missed publish dispatches without creating duplicate active jobs.

A failed check, unexpected release-PR file, stale SHA, API denial or GitHub ruleset restriction leaves the candidate PR **unmerged**, never silently bypasses protections. npm publishing never runs inside the release manager's elevated GitHub-token job.

## One-time repository setting

GitHub may prevent its own Actions bot from creating PRs until you enable:

**Repository → Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests.**

This setting is not permission to bypass branch rules. The release manager cannot proceed if it is disabled; its job will fail and report the restriction.

The repository does **not** need "Allow auto-merge" enabled: the release manager uses the GitHub merge API **only after** required checks pass. If future branch rules require human reviewers, release PRs will remain open for that approval.

Existing GitHub `npm-publish` environment and npm Trusted Publisher must remain configured for `behindthedash/sift`, workflow filename `npm-stage.yml`, environment `npm-publish`. Direct publishing must be allowed. No `NPM_TOKEN` or PAT is required.

## Version selection

Release Please follows [Conventional Commits](https://www.conventionalcommits.org/):

| Example | Result |
|---|---|
| `fix: correct CSV escaping` | Patch: `0.1.1` → `0.1.2` |
| `feat: add row grouping` | Minor: `0.1.1` → `0.2.0` |
| `feat!: remove deprecated grid prop` or a `BREAKING CHANGE:` footer | Breaking change; under `0.x`, minor by policy, and major after `1.0.0` |
| `docs:`, `test:`, `ci:`, `chore:` | Recorded in Git history, but no npm release on their own |

Release Please generates and updates the changelog; it is not necessary to manually edit release versions. Its initial baseline is the verified **`0.1.1`** OIDC release at commit `8cbb08a113cf3bd4c0aff3f7c18f6571f3a4373c`. Configuration and manifest are in `release-please-config.json` and `.release-please-manifest.json`.

## Operations

- Open **GitHub → Actions → Sift Release Manager** to review attempts and failures. A manual run can be used to reconcile a pending release.
- The release manager is serialized via Actions concurrency and verifies the release PR head before merge.
- CI failures or version/manifest inconsistencies stop the release. Fix the underlying change with a new PR; rerun the manager afterward.
- The npm publishing job stays separately serialized, has OIDC `id-token: write`, and is restricted to protected `main`.
- Review `CHANGELOG.md`, the generated release PR and the npm provenance as the release history.
- The initial setup PR only introduces automation. It does not change the current `0.1.1` package version or publish an npm release.

For documentation on manually dispatching a direct publication or inspecting npm security, see [releasing.md](releasing.md).
