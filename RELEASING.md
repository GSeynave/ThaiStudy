# Releasing

Thai Study is not at `1.0.0` yet. Until then, the repo should follow a pre-v1 semantic versioning policy with Conventional Commits so full semantic-release automation can be added later without rewriting history conventions.

## Current policy

- current release line: `0.x.y`
- pre-v1 rule:
  - `fix:` -> patch bump
  - `feat:` -> minor bump
  - breaking changes -> minor bump while still under `0.x`

This keeps release behavior simple before the product contract is stable enough for `1.0.0`.

## Commit format

Use Conventional Commits:

```text
type(scope): summary
```

Examples:

- `feat(auth): add hosted Supabase sign-in flow`
- `fix(transcript): harden hosted YouTube transcript fetches`
- `docs(hosting): add Vercel and Railway preview guide`
- `chore(repo): ignore generated Supabase temp files`

Allowed commit types in this repo:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `build`
- `ci`
- `perf`
- `revert`

## Breaking changes

Before `1.0.0`, avoid frequent explicit breaking markers unless they matter to a real deployment or operator workflow.

If you need one, use normal Conventional Commit syntax:

- `feat(api)!: change export payload shape`
- or include `BREAKING CHANGE:` in the body

## Release phases

### Now

- follow Conventional Commits
- keep versioning expectations documented
- keep commits machine-readable

### Later

When deployment stabilizes:

- add automated changelog generation
- add Git tag + GitHub release automation
- add semantic-release or equivalent on `main`

## Current enforcement

- local enforcement: `./scripts/install-git-hooks.sh`
- CI enforcement: `.github/workflows/commit-message.yml`

This keeps commit history machine-readable before full semantic-release automation is added.

## First `1.0.0`

Do not move to `1.0.0` until:

- hosted auth is stable
- hosted/local Anki bridge behavior is validated from HTTPS
- deployment and rollback flow are documented
- release automation is at least minimally defined
