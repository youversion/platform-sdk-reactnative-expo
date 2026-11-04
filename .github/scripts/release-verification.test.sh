#!/usr/bin/env bash
# Behavioral tests for the release-verification workflow steps, run against a fake gh.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/release-verification.yml"
TRIGGER="$ROOT/.github/workflows/release-verification-trigger.yml"
TMP=$(mktemp -d)
passes=0
failures=0
trap 'rm -rf "$TMP"' EXIT

pass() {
  printf 'ok   %s\n' "$1"
  passes=$((passes + 1))
}

fail() {
  printf 'FAIL %s\n       %s\n' "$1" "$2"
  failures=$((failures + 1))
}

# The run: block of the named step, dedented.
extract_step() {
  awk -v step="      - name: $1" '
    $0 == step { found = 1; next }
    found && $0 == "        run: |" { capture = 1; next }
    capture && ($0 ~ /^      - name:/ || $0 ~ /^  [[:alnum:]_-]+:/) { exit }
    capture { sub(/^          /, ""); print }
  ' "$WORKFLOW"
}
extract_step "Find the release PR head" > "$TMP/resolve.sh"
extract_step "Run the device suite on the release PR head" > "$TMP/verify.sh"

mkdir -p "$TMP/bin"
printf '#!/usr/bin/env bash\n' > "$TMP/bin/sleep"
cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
# The value after a flag, e.g. `arg_after --jq "$@"`.
arg_after() {
  local flag=$1 previous="" value=""
  shift
  for arg in "$@"; do
    [ "$previous" = "$flag" ] && value=$arg
    previous=$arg
  done
  printf '%s' "$value"
}
# Applies the caller's --jq filter, as gh does.
filter() { jq -r "$(arg_after --jq "$@")"; }
case "$*" in
  *"/pulls?state=open&base=main&head="*)
    filter "$@" < "$MOCK_DIR/pulls.json" ;;
  *"/pulls/"*"/commits"*)
    filter "$@" < "$MOCK_DIR/commits.json" ;;
  *"/commits/"*"/statuses"*)
    # Newest first, as the API lists them. MOCK_FOREIGN_STATUS stands for a newer run's write.
    cat "$MOCK_DIR/status-records" 2>/dev/null | jq -s --arg foreign "${MOCK_FOREIGN_STATUS:-}" \
      'reverse | if $foreign == "" then . else
        [{context: "release-verification", target_url: "https://github.com/youversion/expo/actions/runs/43"}] + . end' |
      filter "$@" ;;
  *"/statuses/"*)
    [ "$GH_TOKEN" = repo-token ] || { echo "status written with $GH_TOKEN" >&2; exit 1; }
    state="" description="" url="" sha=""
    for arg in "$@"; do
      case "$arg" in
        state=*) state=${arg#state=} ;;
        description=*) description=${arg#description=} ;;
        target_url=*) url=${arg#target_url=} ;;
        */statuses/*) sha=${arg##*/} ;;
      esac
    done
    printf '%s %s\n' "$state" "$description" >> "$MOCK_DIR/statuses"
    printf '%s\n' "$sha" >> "$MOCK_DIR/status-shas"
    jq -nc --arg url "$url" '{context: "release-verification", target_url: $url}' >> "$MOCK_DIR/status-records" ;;
  *"/dispatches"*)
    [ "$GH_TOKEN" = dispatch-token ] || { echo "dispatched with $GH_TOKEN" >&2; exit 1; }
    jq -r '[.inputs.platform, .inputs.sdk_ref, .inputs.build_name] | join(" | ")' "$(arg_after --input "$@")" \
      >> "$MOCK_DIR/dispatches" ;;
  *"/runs?event=workflow_dispatch"*)
    # Listed first: an earlier attempt's run, which only the exact build name tells apart.
    runs='{"id": 999, "display_title": "Release verification 0123456 ios 41.1.1 #3"}'
    n=0
    while IFS= read -r line; do
      n=$((n + 1))
      [ "${line%% *}" = "${MOCK_UNLISTED:-}" ] && continue
      # The automation repo's run-name: "<build_name> #<run_number>".
      runs="$runs, {\"id\": $n, \"display_title\": \"${line##* | } #$((n + 100))\"}"
    done < "$MOCK_DIR/dispatches"
    filter "$@" <<< "{\"workflow_runs\": [$runs]}" ;;
  *"/actions/runs/"*)
    [ -z "${MOCK_POLL_ERROR:-}" ] || exit 1
    if [ -n "${MOCK_FLAKY_POLL:-}" ] && [ ! -e "$MOCK_DIR/flaked" ]; then touch "$MOCK_DIR/flaked"; exit 1; fi
    run=${2##*/}
    platform=$(sed -n "${run}p" "$MOCK_DIR/dispatches" | cut -d' ' -f1)
    [ -n "$platform" ] || { echo "polled run $run, which was never dispatched" >&2; exit 1; }
    [ "$platform" != "${MOCK_NEVER_DONE:-}" ] || exit 0
    # Which try of this platform the run is: its conclusion is that word of MOCK_CONCLUSIONS_<platform>.
    try=$(head -n "$run" "$MOCK_DIR/dispatches" | grep -c "^$platform ")
    var="MOCK_CONCLUSIONS_$platform"
    read -r -a conclusions <<< "${!var:-}"
    count=$(( $(cat "$MOCK_DIR/polls.$run" 2>/dev/null || echo 0) + 1 ))
    echo "$count" > "$MOCK_DIR/polls.$run"
    # The first poll sees the run still in progress.
    if [ "$count" -gt 1 ]; then
      printf '%s\n' "${conclusions[$((try - 1))]:-success}"
    fi ;;
  "run cancel "*)
    echo "$3" >> "$MOCK_DIR/cancels" ;;
  *) echo "unexpected gh $*" >&2; exit 1 ;;
esac
GH
chmod +x "$TMP/bin/gh" "$TMP/bin/sleep"

SHA=0123456789abcdef0123456789abcdef01234567
MAIN_SHA=fedcba9876543210fedcba9876543210fedcba98
RUN_URL=https://github.com/youversion/expo/actions/runs/42

# ── Trust boundary ────────────────────────────────────────────────────────

# A pull_request run executes the PR's own copy of its workflow, so that file must hold no
# scopes and no secrets, and the dispatch token must only be reachable from workflow_run,
# which always runs main's copy.
if grep -q '^permissions: {}$' "$TRIGGER" && ! grep -qE '^ +(statuses|pull-requests|contents|actions):' "$TRIGGER" \
  && ! grep -q 'secrets\.' "$TRIGGER" && ! grep -q 'uses:' "$TRIGGER"; then
  pass "the pull_request trigger holds no scopes or secrets and runs nothing"
else
  fail "the pull_request trigger holds no scopes or secrets and runs nothing" \
    "a PR could rewrite whatever this file runs and keep what it declares"
fi
if ! grep -qE '^  (pull_request|pull_request_target):' "$WORKFLOW" && grep -q '^  workflow_run:' "$WORKFLOW"; then
  pass "the dispatch token and status writes only run from the default branch"
else
  fail "the dispatch token and status writes only run from the default branch" \
    "release-verification.yml is reachable from a PR-authored run"
fi
if grep -q '^permissions: {}$' "$WORKFLOW" && ! grep -qE '^ +contents:' "$WORKFLOW" \
  && ! grep -q '^concurrency:' "$WORKFLOW"; then
  pass "scopes and the concurrency group live on the jobs, not the workflow"
else
  fail "scopes and the concurrency group live on the jobs, not the workflow" \
    "a workflow-level grant or group reaches every run, including ones that verify nothing"
fi
missing=$(awk '
  FNR == 1 { if (job && !timed) print job; job = ""; in_jobs = 0 }
  /^jobs:/ { in_jobs = 1; next }
  in_jobs && /^  [[:alnum:]_-]+:$/ { if (job && !timed) print job; job = $1; timed = 0; next }
  in_jobs && /^    timeout-minutes:/ { timed = 1 }
  END { if (job && !timed) print job }
' "$WORKFLOW" "$TRIGGER")
if [ -z "$missing" ]; then
  pass "every job has a timeout"
else
  fail "every job has a timeout" "no timeout-minutes on: $missing"
fi

# ── Resolve: which head, if any, to verify ────────────────────────────────

release_pr() {
  printf '[{"number": 252, "head": {"sha": "%s", "repo": {"full_name": "%s"}}}]' "$1" "${2:-youversion/expo}"
}

run_resolve_case() {
  local name="$1" event="$2" trigger_sha="$3" pulls="$4" parent="$5" expected_sha="$6" expected_statuses="$7"
  dir="$TMP/resolve-$passes-$failures"
  mkdir -p "$dir"
  touch "$dir/statuses" "$dir/output" "$dir/status-records"
  printf '%s\n' "$pulls" > "$dir/pulls.json"
  printf '[{"sha": "%s", "parents": [{"sha": "%s"}]}]\n' "$SHA" "$parent" > "$dir/commits.json"
  env PATH="$TMP/bin:$PATH" MOCK_DIR="$dir" GH_TOKEN=repo-token GITHUB_OUTPUT="$dir/output" \
    EVENT="$event" TRIGGER_SHA="$trigger_sha" REPOSITORY=youversion/expo RUN_URL="$RUN_URL" \
    bash "$TMP/resolve.sh" > "$dir/out" 2>&1
  local code=$? got statuses
  got=$(sed -n 's/^sha=//p' "$dir/output")
  statuses=$(cut -d' ' -f1 "$dir/statuses" | paste -sd, -)
  if [ "$code" = 0 ] && [ "$got" = "$expected_sha" ] && [ "$statuses" = "$expected_statuses" ]; then
    pass "$name"
  else
    fail "$name" "exit $code, sha '$got', statuses '$statuses'; $(tr '\n' ' ' < "$dir/out")"
  fi
}

run_resolve_case "verifies the release PR head when Release just rebuilt it" \
  push "$MAIN_SHA" "$(release_pr "$SHA")" "$MAIN_SHA" "$SHA" ""
run_resolve_case "leaves the suite alone when Release did not touch the release PR" \
  push "$MAIN_SHA" "$(release_pr "$SHA")" 1111111111111111111111111111111111111111 "" ""
run_resolve_case "does nothing after Release when no release PR is open" \
  push "$MAIN_SHA" '[]' "$MAIN_SHA" "" ""
run_resolve_case "verifies a fix pushed straight to the release PR" \
  pull_request "$SHA" "$(release_pr "$SHA")" "$MAIN_SHA" "$SHA" ""
run_resolve_case "marks any other PR head as not a release, so the status can be required" \
  pull_request 2222222222222222222222222222222222222222 "$(release_pr "$SHA")" "$MAIN_SHA" "" success
if [ "$(cat "$dir/status-shas")" = 2222222222222222222222222222222222222222 ]; then
  pass "the not-a-release status lands on the triggering head only"
else
  fail "the not-a-release status lands on the triggering head only" "wrote to: $(cat "$dir/status-shas")"
fi
run_resolve_case "never marks the release head itself as not a release" \
  pull_request "$SHA" "$(release_pr "$SHA")" 1111111111111111111111111111111111111111 "$SHA" ""
run_resolve_case "ignores a changeset-release/main branch from a fork" \
  pull_request "$SHA" "$(release_pr "$SHA" someone/expo)" "$MAIN_SHA" "" success

# ── Verify: the device suites on that head ────────────────────────────────

run_case() {
  local name="$1" expected_exit="$2" expected_statuses="$3" expected_platforms="$4"
  shift 4
  dir="$TMP/case-$passes-$failures"
  mkdir -p "$dir"
  touch "$dir/statuses" "$dir/dispatches" "$dir/summary" "$dir/status-records"
  env PATH="$TMP/bin:$PATH" MOCK_DIR="$dir" POLL_MINUTES=60 "$@" \
    SHA="$SHA" GH_TOKEN=repo-token DISPATCH_TOKEN=dispatch-token GITHUB_REPOSITORY=youversion/expo \
    GITHUB_RUN_ID=42 GITHUB_RUN_ATTEMPT=1 \
    GITHUB_STEP_SUMMARY="$dir/summary" RUN_URL="$RUN_URL" \
    AUTOMATION_REPO=youversion/automation WORKFLOW_FILE=browserstack-manual.yml \
    bash "$TMP/verify.sh" > "$dir/out" 2>&1
  local code=$?
  local statuses platforms
  statuses=$(cut -d' ' -f1 "$dir/statuses" | paste -sd, -)
  platforms=$(cut -d' ' -f1 "$dir/dispatches" | paste -sd, -)
  if [ "$code" = "$expected_exit" ] && [ "$statuses" = "$expected_statuses" ] \
    && [ "$platforms" = "$expected_platforms" ]; then
    pass "$name"
  else
    fail "$name" "exit $code, statuses '$statuses', dispatched '$platforms'; $(tr '\n' ' ' < "$dir/out")"
  fi
}

run_case "passes when both platforms pass, testing them one at a time" 0 \
  pending,pending,success ios,android
if grep -qx "ios | $SHA | Release verification 0123456 ios 42.1.1" "$dir/dispatches"; then
  pass "dispatches the exact release PR head under a run-unique build name"
else
  fail "dispatches the exact release PR head under a run-unique build name" "$(cat "$dir/dispatches")"
fi
if grep -q "runs/1$" "$dir/summary" && grep -q "runs/2$" "$dir/summary"; then
  pass "logs both automation run URLs in the step summary"
else
  fail "logs both automation run URLs in the step summary" "$(cat "$dir/summary")"
fi
run_case "fails on iOS and never starts Android" 1 \
  pending,failure ios MOCK_CONCLUSIONS_ios=failure
run_case "retries a cancelled run once, then reports the retry's result" 0 \
  pending,pending,pending,success ios,android,android MOCK_CONCLUSIONS_android="cancelled success"
run_case "reports a run cancelled twice as an error, not a test failure" 1 \
  pending,pending,pending,error ios,android,android MOCK_CONCLUSIONS_android="cancelled cancelled"
run_case "reports an error when the dispatched run cannot be found" 1 \
  error ios MOCK_UNLISTED=ios
run_case "rides out a transient gh error while polling" 0 \
  pending,pending,success ios,android MOCK_FLAKY_POLL=1
run_case "gives up on a run that never finishes and cancels it" 1 \
  pending,error ios MOCK_NEVER_DONE=ios POLL_MINUTES=1
if [ "$(cat "$dir/cancels" 2>/dev/null)" = 1 ]; then
  pass "a run that times out is cancelled in the automation repo"
else
  fail "a run that times out is cancelled in the automation repo" "cancelled: '$(cat "$dir/cancels" 2>/dev/null)'"
fi
run_case "an unexpected stop reports an error" 1 pending,error ios MOCK_POLL_ERROR=1
if [ "$(cat "$dir/cancels" 2>/dev/null)" = 1 ]; then
  pass "an unexpected stop cancels the remote run it started"
else
  fail "an unexpected stop cancels the remote run it started" "cancelled: '$(cat "$dir/cancels" 2>/dev/null)'"
fi
run_case "a stopped run never writes over a newer run's status" 1 pending ios \
  MOCK_POLL_ERROR=1 MOCK_FOREIGN_STATUS=1

printf '\n%d passed, %d failed\n' "$passes" "$failures"
[[ "$failures" -eq 0 ]]
