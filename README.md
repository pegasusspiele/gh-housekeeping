<p align="center">
  <img src="assets/logo.png" alt="gh-housekeeping logo" width="160">
  <br>
  <sub>Logo AI-generated with OpenAI <code>gpt-image</code> via Codex (agent model <code>gpt-6.1-sol</code>)</sub>
</p>

<h1 align="center">gh housekeeping</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
</p>

<p align="center">
  An interactive GitHub CLI extension that cleans up old container image versions in a GitHub organization's GitHub Container Registry (<code>ghcr.io</code>).<br>
  Pick packages, preview, confirm. <code>latest</code> is always kept.
</p>

---

## Quick start

```bash
brew install gh jq gum
gh auth refresh -h github.com -s read:packages,delete:packages
gh extension install pegasusspiele/gh-housekeeping

gh housekeeping --org my-org
```

The interactive run walks you through these steps:

1. **Organization:** asks which organization to clean up, unless you pass `--org` or set `GITHUB_ORG_NAME`.
2. **Age:** asks how old a version must be before it may be deleted.
3. **Packages:** lists every container package that has deletable versions, with counts, and says how many packages were checked in total. Packages with nothing to delete are not listed. Select with <kbd>x</kbd> and confirm with <kbd>enter</kbd>.
4. **Preview:** shows a summary of what will be deleted. **Show versions** lists every version (id, date, tags) in a pager.
5. **Confirm:** nothing is deleted until you choose **Delete N versions**. **Cancel** or <kbd>Ctrl</kbd>+<kbd>C</kbd> exits without changes.
6. **Delete:** prints ✓ or ✗ for each version, then a summary.

## Installation

Requirements:

- [GitHub CLI (`gh`)](https://cli.github.com/) and [`jq`](https://jqlang.org/)
- [`gum`](https://github.com/charmbracelet/gum), needed only for interactive mode
- Access to the organization's packages: scopes `read:packages` and `delete:packages`, and admin access to each package you want to clean up

```bash
brew install gh jq gum                                           # macOS
gh auth refresh -h github.com -s read:packages,delete:packages   # add the scopes
gh auth status                                                   # check "Token scopes"
```

### As a `gh` extension (recommended)

```bash
gh extension install pegasusspiele/gh-housekeeping
gh housekeeping --help

gh extension upgrade housekeeping     # update later
gh extension remove housekeeping      # uninstall
```

### From a clone

For development, link your working copy as the extension. The folder name must start with `gh-`, which is the default when cloning:

```bash
gh repo clone pegasusspiele/gh-housekeeping
cd gh-housekeeping
gh extension install .        # links this folder; local changes take effect immediately
```

You can also run it directly without installing: `./gh-housekeeping`.

## Usage

```bash
gh housekeeping [options] [PACKAGE ...]
```

Without `PACKAGE`, all container packages of the organization are considered. When you pass package names, the selection step is skipped.

| Option          | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `-o, --org ORG` | Organization (asked interactively if not set, required in scripts and CI) |
| `-d, --days N`  | Only delete versions at least `N` days old (asked interactively if not set) |
| `-n, --dry-run` | Only show what would be deleted                                        |
| `-y, --yes`     | No prompts: delete everything that matches (for scripts and CI)        |
| `-h, --help`    | Show help                                                              |

| Example                                          | Effect                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `gh housekeeping`                                         | Interactive, asks for the organization                     |
| `gh housekeeping --org my-org --days 30`                  | Interactive, skips the organization and age questions      |
| `gh housekeeping --org my-org --dry-run my-package`       | Preview for a single package                               |
| `gh housekeeping --org my-org --yes --days 30`            | Deletes versions older than 30 days in all packages, no prompts |
| `gh housekeeping --org my-org --yes my-package other-package` | Deletes all non-`latest` versions of two packages, no prompts |

> [!WARNING]
> `--yes` deletes without asking. Without `--days` the age defaults to `0`, which means **every version except `latest`**. Run the same command with `--dry-run` first.

### Scripts and CI

Without a terminal the CLI never prompts. It needs an organization (`--org` or `GITHUB_ORG_NAME`) and refuses to delete unless you pass `--yes` (or `--dry-run`), so a forgotten flag can't wipe packages. Set `GH_TOKEN` to a token with `read:packages` and `delete:packages`. `gh` picks it up automatically.

```bash
GH_TOKEN=… gh housekeeping --org my-org --yes --days 30
```

The environment variables `GITHUB_ORG_NAME`, `DAYS_TO_DELETE` and `DRY_RUN=1` work as well. The options above override them.

### Exit codes

| Code  | Meaning                                                                   |
| ----- | ------------------------------------------------------------------------- |
| `0`   | Done, nothing to delete, dry run, or cancelled via the menu               |
| `1`   | Error (invalid input, missing scope, unknown package) or at least one failed deletion |
| `130` | Cancelled with <kbd>Ctrl</kbd>+<kbd>C</kbd>                               |

## Troubleshooting

| Message                                                              | Cause and fix                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `You need at least read:packages scope to list packages. (HTTP 403)` | Missing scope: `gh auth refresh -h github.com -s read:packages,delete:packages` |
| `Not Found (HTTP 404)`                                               | Misspelled package name, or no access to the organization                      |
| `not running in a terminal: pass --yes …`                            | Running from a script or CI: add `--yes` or `--dry-run`                        |
| `no organization: pass --org ORG …`                                  | Running from a script or CI: add `--org` or set `GITHUB_ORG_NAME`              |
| `gum is required for interactive mode`                               | `brew install gum`, or use `--yes` / `--dry-run`                               |
| `extension name must start with gh-`                                 | Local install from a folder not named `gh-…`: use `gh repo clone pegasusspiele/gh-housekeeping` |
| `failed to delete … version …`                                       | Usually missing `delete:packages` or missing admin access to the package       |

GitHub can usually restore deleted versions for 30 days (package settings → *Deleted versions*, or the REST API).

## Known limitations

- **Multi-arch images:** GHCR lists platform manifests and attestations as separate, untagged versions. The CLI only protects the version tagged `latest` itself and may delete the manifests it references. Check such packages with **Show versions** or `--dry-run` first.
- Only packages of type `container` are handled.

## Contributing

Issues and pull requests are welcome. The whole program is one Bash script (`gh-housekeeping`) with no build step. Keep it compatible with macOS Bash 3.2 and Linux, and run the tests before you open a pull request:

```bash
test/run.sh                                        # tests against fake gh and gum, never touches GitHub
shellcheck gh-housekeeping test/run.sh test/stubs/*
```

## For AI agents

Guidance for coding agents (safety rules, how the CLI works, testing) is in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE) © 2022-2026 Pegasus Spiele Verlags- und Medienvertriebsgesellschaft mbH
