#!/usr/bin/env bash
# Tests gh-housekeeping against fake `gh` and `gum` (test/stubs). Never talks to GitHub.
#
#   test/run.sh
#
# Interactive tests run the CLI inside a pseudo terminal via `script`, so it sees a TTY,
# while the gum stub answers the prompts from a queue.

cd "$(dirname "$0")/.." || exit 1
CLI="$PWD/gh-housekeeping"
STUBS="$PWD/test/stubs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

export PATH="$STUBS:$PATH" STUB_LOG="$WORK/gh.log" GUM_LOG="$WORK/gum.log" GUM_QUEUE="$WORK/queue"
unset GITHUB_ORG_NAME DAYS_TO_DELETE DRY_RUN GH_TOKEN

pass=0
fail=0
OUT=""
STATUS=0

ok() {
  pass=$((pass + 1))
  printf '  \033[32m✓\033[0m %s\n' "$1"
}
ko() {
  fail=$((fail + 1))
  printf '  \033[31m✗ %s\033[0m\n' "$1"
  printf '%s\n' "$OUT" | sed 's/^/      | /'
}

# test NAME [gum answers...]: resets the stubs and queues answers for the gum stub
test_case() {
  printf '\n%s\n' "$1"
  shift
  : >"$STUB_LOG"
  : >"$GUM_LOG"
  printf '%s\n' "$@" >"$GUM_QUEUE"
}

# Runs the CLI without a terminal.
run() {
  OUT=$("$BASH" "$CLI" "$@" 2>&1 </dev/null)
  STATUS=$?
}

# Runs the CLI inside a pseudo terminal (BSD/macOS and util-linux `script`).
run_tty() {
  local cmd
  if script --version 2>/dev/null | grep -q util-linux; then
    printf -v cmd '%q ' "$BASH" "$CLI" "$@"
    script -qec "$cmd" /dev/null </dev/null >"$WORK/out" 2>&1
  else
    script -q /dev/null "$BASH" "$CLI" "$@" </dev/null >"$WORK/out" 2>&1
  fi
  STATUS=$?
  OUT=$(tr -d '\r' <"$WORK/out" | sed 's/\^D//g')
}

expect_exit() {
  if [ "$STATUS" = "$1" ]; then ok "exit code $1"; else ko "exit code $1 (got $STATUS)"; fi
}
expect_out() {
  if grep -qF -- "$1" <<<"$OUT"; then ok "prints: $1"; else ko "prints: $1"; fi
}
expect_deletes() {
  local got
  got=$(grep -c DELETE "$STUB_LOG")
  if [ "$got" = "$1" ]; then ok "$1 DELETE calls"; else ko "$1 DELETE calls (got $got)"; fi
  if grep -q '/versions/1$' "$STUB_LOG"; then ko "version tagged latest was deleted"; fi
}

# --- non-interactive -------------------------------------------------------------

test_case "refuses to delete without a terminal unless --yes"
run
expect_exit 1
expect_out "pass --yes"
expect_deletes 0

test_case "--dry-run --days 5 lists old versions of all packages"
run --dry-run --days 5
expect_exit 0
expect_out "[dry-run] would delete version (2) of package (team/web)"
expect_out "[dry-run] would delete version (999) of package (app)"
expect_deletes 0

test_case "--yes deletes one package, keeps latest, reports failures"
run --yes team/web
expect_exit 1
expect_out "successfully deleted version (4) of package (team/web)"
expect_out "error during deletion of version (999) of package (team/web): gh: Package version not deletable"
expect_out "Deleted 2 versions, 1 failed."
expect_deletes 3
if grep -q 'team%2Fweb/versions/2' "$STUB_LOG"; then ok "package name is URL-encoded"; else ko "package name is URL-encoded"; fi

test_case "legacy environment variables still work"
OUT=$(DRY_RUN=1 DAYS_TO_DELETE=5 GITHUB_ORG_NAME=other "$BASH" "$CLI" app 2>&1 </dev/null)
STATUS=$?
expect_exit 0
expect_out "[dry-run] would delete version (2) of package (app)"
expect_deletes 0

test_case "invalid input"
run --yes --days abc
expect_exit 1
expect_out "--days must be a whole number"
run --frob
expect_exit 1
expect_out "unknown option: --frob"
run --help
expect_exit 0
expect_out "Usage:"

# --- interactive -----------------------------------------------------------------

test_case "interactive: choose package, show versions, delete" 0 app "Show versions" Delete
run_tty
expect_exit 1
expect_out "✓ deleted app version 2"
expect_out "Deleted 2 versions, 1 failed."
expect_deletes 3
if grep -q "option: team/web" "$GUM_LOG"; then ok "offers all packages with deletable versions"; else ko "offers all packages with deletable versions"; fi
if grep -q "option: only-latest" "$GUM_LOG"; then ko "hides packages without deletable versions"; else ok "hides packages without deletable versions"; fi
expect_out "Found deletable versions in 2 of 3 packages"
if grep -qF "option: app       delete    3 of    4 versions" "$GUM_LOG"; then ok "labels say what a selection deletes"; else ko "labels say what a selection deletes"; fi

test_case "interactive: cancel at confirmation" 5 "app;team/web" Cancel
run_tty
expect_exit 0
expect_out "4 versions in 2 packages"
expect_out "Cancelled. Nothing was deleted."
expect_deletes 0

test_case "interactive: invalid age is asked again, nothing old enough" abc 999
run_tty
expect_exit 0
expect_out "Please enter a whole number."
expect_out "Nothing to delete"
expect_deletes 0

test_case "interactive: Ctrl-C at package selection" 0 CANCEL
run_tty
expect_exit 130
expect_deletes 0

test_case "interactive: --dry-run with package argument skips selection"
run_tty --dry-run --days 0 team/web
expect_exit 0
expect_out "Dry run: nothing was deleted."
expect_deletes 0

test_case "interactive without gum installed"
mkdir -p "$WORK/nogum"
ln -s "$STUBS/gh" "$WORK/nogum/gh"
ln -s "$(command -v jq)" "$WORK/nogum/jq"
PATH="$WORK/nogum:/usr/bin:/bin" run_tty
expect_exit 1
expect_out "gum is required"
expect_deletes 0

printf '\n%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
