# Changelogs & Package Releases

A GitHub Action for automated release pipeline including monorepo package versioning, changelog generation, PR preview comments, Git tagging, GitHub Releases, and package publishing.

## Features

- **Automated Version Bumping**: Uses conventional commits to detect and apply version bumps (major, minor, patch)
- **Release Strategies**: Support for `auto`, `major`, `minor`, `patch`, `beta`, and `canary` releases
- **Changelog Generation**: Automatically generates `CHANGELOG.md` using git-cliff for each package
- **PR Preview Comments**: Posts beta release previews on pull requests with package details and installation commands
- **Git Tags & Commits**: Creates git tags and commits for released versions
- **GitHub Releases**: Creates releases on GitHub with changelog excerpts
- **Package Publishing**: Publishes packages to npm with appropriate distribution tags
- **Monorepo Support**: Processes multiple packages with individual version management

## Usage

Add this action to your GitHub workflow:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      packages: write

    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # Fetch full history for git-cliff

      - uses: actions/setup-node@v7
        with:
          node-version: 24

      - name: Install git-cliff
        uses: taiki-e/install-action@git-cliff

      - name: Release
        uses: abhisin98/avivox-action-changelogs-and-package-releases@v1
        with:
          release-type: auto
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `release-type` | Release strategy: `auto`, `major`, `minor`, `patch`, `beta`, `canary` | `auto` | No |
| `pr-number` | Pull request number for beta metadata and preview comment | `github.event.pull_request.number` | No |
| `head-sha` | HEAD commit SHA for prerelease metadata | `github.event.pull_request.head.sha` | No |
| `commit-and-push` | Commit version bumps, create tags, and push | `true` | No |
| `create-release` | Create GitHub Releases with changelog notes | `true` | No |
| `commit-message` | Commit message template | `chore(release): publish package versions and changelogs [skip ci]` | No |
| `github-token` | GitHub token for API operations | `github.token` | No |
| `publish-packages` | Publish packages to registry | `true` | No |
| `package-manager` | Package manager: `pnpm`, `npm`, or `yarn` | `npm` | No |
| `package-access` | Package access level: `public` or `restricted` | `public` | No |
| `publish-package-tag` | Custom npm distribution tag | auto-detected from version | No |
| `publish-extra-args` | Additional publish command arguments | - | No |

## Outputs

| Output | Description |
|--------|-------------|
| `packages` | JSON array of packages with updated versions. Each entry contains `dir` (relative path to package directory) |

Example output:
```json
[
  { "dir": "packages/core" },
  { "dir": "packages/cli" }
]
```

## Release Types

- **`auto`**: Detects version bump from conventional commits using git-cliff
- **`major`**: Increments major version (X.0.0)
- **`minor`**: Increments minor version (X.Y.0)
- **`patch`**: Increments patch version (X.Y.Z)
- **`beta`**: Creates beta prerelease version with format `X.Y.Z-beta.<pr>.<sha>.<timestamp>`
- **`canary`**: Creates canary prerelease version with format `X.Y.Z-canary.<sha>.<timestamp>`

## Version Metadata

### Beta Releases
- Format: `<version>-beta.<pr>.<short-sha>.<timestamp>`
- Example: `1.2.3-beta.42.abc1234.1630000000`
- Includes PR number for easy cross-referencing

### Canary Releases
- Format: `<version>-canary.<short-sha>.<timestamp>`
- Example: `1.2.3-canary.abc1234.1630000000`
- Includes short SHA (7 chars) and Unix timestamp for uniqueness

## How It Works

1. **Parse Inputs**: Reads and validates all action inputs
2. **Process Packages**: For each package.json found:
   - Runs git-cliff to generate changelog
   - Detects suggested version bump
   - Applies release-type strategy to determine final version
   - Updates package.json
3. **Post PR Comment** (beta only): Comments on PR with release preview
4. **Commit & Tag** (stable only): Commits changes, creates git tags, pushes
5. **Create Releases** (stable only): Creates GitHub Releases with changelog
6. **Publish**: Publishes public packages with appropriate dist-tags

## File Structure

```
src/
├── index.ts           # Main entry point and orchestration
├── inputs.ts          # Input parsing and validation
├── types.ts           # TypeScript interfaces
├── git.ts             # Git operations (commit, tag, push)
├── changelog.ts       # Changelog generation and version bumping
├── github-api.ts      # GitHub API operations (PR comments, releases)
├── publish.ts         # Package publishing logic
└── utils.ts           # Utility functions
```

## Installation

### Prerequisites

- Node.js 24 or later
- git-cliff installed in the environment

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the action:
   ```bash
   npm run build
   ```

3. When you make changes in this repo:
   ```bash
   git add .
   git commit -m "fix: update setup action caching"
   git push origin main
   ```
4. Then create a new tag for consumers:

   ```bash
   git tag v1
   git push origin v1
   ```

5. Then update the consuming repo workflow to the new tag:

   ```yaml
   - uses: abhisin98/avivox-action-changelogs-and-package-releases@v1
   ```

## Development

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Type Check
```bash
npm run type-check
```

### Clean
```bash
npm run clean
```

## Versioning

Use semantic version tags like:

- `v1`
- `v1.0.0`

This keeps the action repo versioned separately from the app repos that consume it.

## Notes

- **git-cliff must be installed** in the GitHub Actions environment (use `taiki-e/install-action@git-cliff`)
- **Requires elevated permissions** for creating commits, tags, and releases
- **Private packages** are automatically skipped during publishing
- **Beta/Canary releases** skip git commits and GitHub releases to avoid cluttering history
- **Tag format**: `<package-name>@<version>` (e.g., `my-package@1.2.3`)

## License

MIT