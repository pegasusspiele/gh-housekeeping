#!/usr/bin/env bash
# Unit tests for the functions of gh-housekeeping. Never talks to GitHub.
#
#   test/unit.sh
#
# Sources the CLI, which then only defines its functions, and calls them with prepared
# files in $TMP. End-to-end behavior is covered by test/run.sh.

cd "$(dirname "$0")/.." || exit 1
# shellcheck source=gh-housekeeping
. "$PWD/gh-housekeeping"
set +e # the CLI enables errexit; a failing expectation must not end the tests

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export PATH="$PWD/test/stubs:$PATH" STUB_LOG="$TMP/gh.log"

# Globals the functions read. They are used in the sourced file.
# shellcheck disable=SC2034
ORG=acme INTERACTIVE=0
CUTOFF=$(jq -n '"2026-01-10T00:00:00Z" | fromdateiso8601')

pass=0
fail=0

# expect NAME EXPECTED ACTUAL
expect() {
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    printf '  \033[32m✓\033[0m %s\n' "$1"
  else
    fail=$((fail + 1))
    printf '  \033[31m✗ %s\033[0m\n      expected: %s\n      got:      %s\n' "$1" "$2" "$3"
  fi
}

# version ID CREATED_AT [TAG ...]: prints one JSON line as fetch_versions stores it
version() {
  local id=$1 created=$2
  shift 2
  jq -cn --argjson id "$id" --arg created "$created" '{id: $id, created_at: $created, tags: $ARGS.positional}' --args "$@"
}

printf '\npackage_path\n'
expect "plain name" "/orgs/acme/packages/container/app" "$(package_path app)"
expect "slash is URL-encoded" "/orgs/acme/packages/container/team%2Fweb" "$(package_path team/web)"
expect "nested name" "/orgs/acme/packages/container/a%2Fb%2Fc" "$(package_path a/b/c)"

printf '\ncompute_deletable\n'
printf '%s\n' app empty >"$TMP/packages"
{
  version 1 2026-01-01T00:00:00Z latest         # old, latest               -> kept
  version 2 2026-01-01T00:00:00Z v1 latest      # old, latest among others  -> kept
  version 3 2026-01-01T00:00:00Z v1             # old, other tag            -> deleted
  version 4 2026-01-01T00:00:00Z                # old, untagged             -> deleted
  version 5 2026-01-01T00:00:00Z latest-arm64   # old, only the exact tag "latest" protects -> deleted
  version 6 2026-01-09T23:59:59Z                # one second before cutoff  -> deleted
  version 7 2026-01-10T00:00:00Z                # exactly at the cutoff     -> kept
  version 8 2026-01-20T00:00:00Z v2             # newer than the cutoff     -> kept
} >"$TMP/versions.1"
: >"$TMP/versions.2"
compute_deletable
expect "exit code" 0 $?
expect "deletable ids" "3 4 5 6" "$(tr '\n' ' ' <"$TMP/delete.1" | sed 's/ $//')"
expect "package without versions has nothing to delete" "" "$(cat "$TMP/delete.2")"
expect "summary lines" "$(printf '1\tapp\t8\t4\n2\tempty\t0\t0')" "$(cat "$TMP/summary")"

CUTOFF=$(jq -n '"2020-01-01T00:00:00Z" | fromdateiso8601')
compute_deletable
expect "nothing is old enough for an early cutoff" "$(printf '1\tapp\t8\t0\n2\tempty\t0\t0')" "$(cat "$TMP/summary")"

CUTOFF=$(jq -n '"2030-01-01T00:00:00Z" | fromdateiso8601')
compute_deletable
expect "latest survives even when everything is old enough" "3 4 5 6 7 8" "$(tr '\n' ' ' <"$TMP/delete.1" | sed 's/ $//')"

printf '\nshow_details\n'
CUTOFF=$(jq -n '"2026-01-10T00:00:00Z" | fromdateiso8601')
printf '1\tapp\t4\n' >"$TMP/plan"
expect "lists exactly the deletable versions" "app (4 versions)
  3  2026-01-01T00:00:00Z  v1
  4  2026-01-01T00:00:00Z  <untagged>
  5  2026-01-01T00:00:00Z  latest-arm64
  6  2026-01-09T23:59:59Z  <untagged>" "$(show_details)"

printf '\nfetch_packages and fetch_versions (gh stub)\n'
fetch_packages
expect "package names, one per line" "app team/web only-latest" "$(tr '\n' ' ' <"$TMP/packages" | sed 's/ $//')"
fetch_versions >/dev/null
expect "one versions file per package" "4 4 1" "$(wc -l <"$TMP/versions.1" | tr -d ' ') $(wc -l <"$TMP/versions.2" | tr -d ' ') $(wc -l <"$TMP/versions.3" | tr -d ' ')"
expect "versions keep id and tags" '{"id":1,"tags":["latest"]}' "$(jq -c '{id, tags}' "$TMP/versions.3")"
expect "untagged versions get an empty tag list" '[]' "$(jq -c 'select(.id == 4) | .tags' "$TMP/versions.1")"

printf '\nwith_spinner (non-interactive)\n'
with_spinner "title" true
expect "passes success through" 0 $?
with_spinner "title" false
expect "passes failure through" 1 $?
expect "runs the command with its arguments" "a b" "$(with_spinner "title" echo a b)"

printf '\n%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
