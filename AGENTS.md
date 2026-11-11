# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository.
Humans should start with the [README](README.md).

## What this is

`gh-housekeeping` is an interactive CLI, packaged as a GitHub CLI extension (`gh housekeeping`), that deletes old versions of container packages (GitHub Container Registry, `ghcr.io`) in a GitHub organization. Versions tagged `latest` are always kept. It is a single Bash script with no build step and depends on `gh` and `jq`, plus [`gum`](https://github.com/charmbracelet/gum) for interactive mode only.

History: until 2026 the project was a Deno/TypeScript script. Those files were removed on purpose. Do not add them back, and do not introduce a new runtime (Deno, Node, Python, Go) unless explicitly asked.

## ⚠️ Safety rules (read first)

The CLI makes **real, destructive API calls** against whatever organization it is pointed at (`--org` / `GITHUB_ORG_NAME`). There is no default organization.

1. **Never run `gh-housekeeping` / `gh housekeeping` against GitHub without `--dry-run`**, unless the user explicitly asks for a real deletion in the current conversation. Never pass `--yes` on your own.
2. Without `--days` the age defaults to `0`: **every** version not tagged `latest` is deleted, in **all** packages.
3. Test changes with `test/run.sh`, which uses fake `gh` and `gum`. Never test against the real organization.
4. Do not change or extend token scopes yourself (`gh auth refresh …`). That requires an interactive login by the user.
5. Do not run `gh extension install` or `remove` in the user's real `gh` setup without asking. To try the extension mechanism, isolate it with `XDG_DATA_HOME=$(mktemp -d)`.
6. GitHub can usually restore deleted versions for 30 days (`POST /orgs/{org}/packages/container/{name}/versions/{id}/restore`). Treat deletions as irreversible anyway.

## Repository layout

| Path              | Purpose                                                     |
| ----------------- | ----------------------------------------------------------- |
| `gh-housekeeping` | The whole program (executable, extension entry point)       |
| `test/run.sh`     | End-to-end tests (non-interactive and interactive)          |
| `test/unit.sh`    | Unit tests: sources the CLI and calls its functions         |
| `test/stubs/gh`   | Fake `gh`: fixed packages and versions, logs DELETE calls   |
| `test/stubs/gum`  | Fake `gum`: answers prompts from a queue file               |
| `README.md`       | Documentation for humans                                    |
| `AGENTS.md`       | This file                                                   |
| `CLAUDE.md`       | Points Claude Code to `AGENTS.md`                           |
| `assets/logo.png` | AI-generated logo used in the README                        |
| `LICENSE`         | MIT license                                                 |
| `.github/workflows/ci.yml` | CI on Blacksmith runners: ShellCheck and tests on Ubuntu, tests on macOS Bash 3.2 |
| `CODEOWNERS`      | `* @gruselhaus`                                              |

The executable must stay at the repo root and be named `gh-housekeeping`, matching the repository name `pegasusspiele/gh-housekeeping`. `gh` requires that for extensions: it installs via `gh extension install pegasusspiele/gh-housekeeping`, and a local install (`gh extension install .`) only works from a folder whose name starts with `gh-`. The repository was called `package-housekeeping` until 2026-11-10. GitHub redirects the old name, but use the new one everywhere.

## How the CLI works

`gh-housekeeping` first defines its helper functions. A guard after them returns when the file is sourced instead of executed, which is how `test/unit.sh` gets at the functions. Keep everything that executes below that guard. The rest runs top to bottom in five commented sections:

1. **Options and mode.** Parses `-o/--org`, `-d/--days`, `-n/--dry-run`, `-y/--yes`, `-h/--help` and package names. It falls back to the legacy env vars `GITHUB_ORG_NAME`, `DAYS_TO_DELETE` and `DRY_RUN`.
   - `INTERACTIVE=1` when stdin and stdout are TTYs and `--yes` is not set.
   - Without a TTY it refuses to run unless `--yes` or `--dry-run` is given.
   - Without a TTY it also refuses to run without an organization (`--org` or `GITHUB_ORG_NAME`). There is no default.
   - `gum` is required only when `INTERACTIVE=1`.
2. **Organization, packages and age.** If no organization is set, interactive mode asks with `gum input` until it gets a non-empty answer. Package names come from the arguments, or else from `gh api --paginate /orgs/$ORG/packages?package_type=container`. If `--days` is not set, interactive mode asks with `gum input` and non-interactive mode uses `0`. The cutoff is `now − days × 86400`.
3. **Versions.** For each package it fetches `…/versions` (paginated) into `$TMP/versions.<i>` as JSON lines `{id, created_at, tags}`. `compute_deletable` writes the deletable ids to `$TMP/delete.<i>` and `i, name, total, deletable` to `$TMP/summary`. A version is deletable if its tags do not contain `latest` **and** `created_at < cutoff`.
4. **Selection.** This produces `$TMP/plan` (`i, name, count`).
   - Interactive without package arguments: `gum choose --no-limit` over the packages that have deletable versions. Each label starts with the package name, followed by a space. A status line above the list says how many of the fetched packages are listed, because the rest are hidden. The header names `x` as the select key, because space does not toggle in gum 2.
   - Otherwise: every package with deletable versions.
5. **Preview, confirmation, deletion.**
   - Interactive: a `gum style` summary box, then a `gum choose` loop of *Show versions* (in `gum pager`), *Delete N versions* or *Cancel*.
   - `--dry-run` stops before deleting.
   - Deletion calls `gh api -X DELETE …/versions/{id}` for each version and counts successes and failures.

Details worth knowing:

- Package names are URL-encoded (`jq @uri`) because they can contain `/` (`team/web` → `team%2Fweb`).
- All state lives in a `mktemp -d` directory that is removed on exit. There are no arrays of package data, because macOS Bash 3.2 errors on empty arrays under `set -u`.
- `with_spinner` runs a function in the background and shows `gum spin` until it finishes, because `gum spin` can only run external commands. Functions run this way must write their results to files, not stdout.
- All `gh` calls read from `</dev/null`, so they can't consume the input of the surrounding `while read` loops.
- Non-interactive output keeps the wording of the old script (`Found … versions of package (…)`, `[dry-run] would delete …`, `successfully deleted …`, `error during deletion …`), so existing log parsing keeps working.

### Error handling and exit codes

- `set -euo pipefail`. Failing to list packages or versions (missing scope, 404 from a misspelled name) stops the run before anything is deleted.
- A single failed deletion is reported and the run continues. The exit code is then `1`.
- `0`: success, nothing to delete, dry run, or cancelled via the menu. `130`: Ctrl-C in a gum prompt.
- Beware `cond && cmd` as the last statement in a loop body. Under `set -e` it can make the whole loop return non-zero and end the script. Use `if …; then …; fi`.

## Configuration

| Option / variable                  | Default         | Meaning                                                   |
| ---------------------------------- | --------------- | --------------------------------------------------------- |
| `-o, --org` / `GITHUB_ORG_NAME`    | ask, else error | Organization                                              |
| `-d, --days` / `DAYS_TO_DELETE`    | ask, else `0`   | Minimum age (whole days) before a version may be deleted  |
| `-n, --dry-run` / `DRY_RUN=1`      | off             | Only show, never delete                                   |
| `-y, --yes`                        | off             | Non-interactive, delete without confirmation              |
| `GH_TOKEN`                         | –               | Optional, overrides the `gh` login (e.g. in CI)           |

Required token scopes: `read:packages` (listing) and `delete:packages` (deleting). The error `gh: You need at least read:packages scope to list packages. (HTTP 403)` means a scope is missing. Point the user to `gh auth refresh -h github.com -s read:packages,delete:packages` instead of running it yourself.

## Testing

Run after every change:

```bash
test/unit.sh                                         # both must end with "N passed, 0 failed"
test/run.sh
shellcheck gh-housekeeping test/run.sh test/unit.sh test/stubs/*
```

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`, on Blacksmith runners. The job `Lint and test` runs the same three commands on Ubuntu. The job `Test (macOS, Bash 3.2)` runs both test suites with `/bin/bash` on macOS. Both jobs are required checks for `main`, so update the `protect main` ruleset when you rename a job.

`test/unit.sh` sources the CLI and calls single functions (`package_path`, `compute_deletable`, `show_details`, `fetch_*`, `with_spinner`) with prepared files in `$TMP`. Put rules about which versions are deletable there. `test/run.sh` runs the whole CLI:

- `test/stubs` is put first on `PATH`.
- The **gh stub** returns the packages `app` and `team/web`. Each has version `1` (10 days old, tagged `latest`), `2` (10 days, `v1`), `999` (10 days, untagged, DELETE fails) and `4` (1 hour, untagged). A third package, `only-latest`, has just version `1` and never has anything to delete. DELETE calls are appended to `$STUB_LOG` and never executed.
- The **gum stub** reads one answer per prompt from `$GUM_QUEUE`.
  - For `choose`, an answer selects the options that equal it or start with `"<answer> "`. Separate several answers with `;`.
  - The answer `CANCEL` simulates Ctrl-C (exit 130).
  - Prompts and options are logged to `$GUM_LOG`.
- Interactive tests run the CLI inside a pseudo terminal with `script` (BSD and util-linux syntax are both handled), so the TTY check passes.
- Every test also asserts that version `1` (`latest`) was never deleted.

When you add behavior, add a `test_case` to `test/run.sh`, and an `expect` to `test/unit.sh` if it changes a function. Real gum rendering can't be tested automatically. If you change gum calls, check them against `gum <command> --help` and ask the user to try the interactive flow.

## Known limitations

- **Multi-arch images and attestations:** GHCR lists the platform manifests and attestations of a multi-arch image as separate, **untagged** versions. The CLI only protects the version tagged `latest` itself. It may delete the child manifests that version references, which breaks `latest`. Fixing this means resolving manifest references (e.g. with `docker buildx imagetools inspect` or the OCI registry API), because the Packages API does not return them.
- Only packages of type `container` are handled (not npm, maven, etc.).

## Conventions for changes

- Stick to Bash, `gh`, `jq` and `gum`. Add new dependencies only after asking. Non-interactive mode must keep working without `gum`.
- Stay compatible with macOS Bash 3.2 and Linux. That means:
  - no `mapfile`, associative arrays or `${var,,}`
  - no expanding possibly empty arrays under `set -u`
  - no GNU-only `date -d` or `sed -i` without a fallback
- Every destructive path must have a confirmation in interactive mode and require `--yes` in non-interactive mode.
- All documentation, comments and CLI output are in English.
- The project is MIT-licensed (`LICENSE`). Keep the copyright and SPDX header in `gh-housekeeping`.
- When adding an option, update `usage()`, the tables in `README.md` **and** this file, and `test/run.sh`.
- Only commit, push or open a PR when the user asks. Commits in this repo are signed.
