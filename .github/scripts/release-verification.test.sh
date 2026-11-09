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
# The first call of the kind MOCK_FLAKY names fails, as a transient API error would; every call
# of the kind MOCK_BROKEN names fails.
flaky() {
  [ "${MOCK_BROKEN:-}" != "$1" ] || exit 1
  if [ "${MOCK_FLAKY:-}" = "$1" ] && [ ! -e "$MOCK_DIR/flaked" ]; then touch "$MOCK_DIR/flaked"; exit 1; fi
}
case "$*" in
  *"/pulls?state=open&base=main&head="*)
    flaky pr-lookup
    filter "$@" < "$MOCK_DIR/pulls.json" ;;
  *"/pulls/"*"/commits"*)
    filter "$@" < "$MOCK_DIR/commits.json" ;;
  *"/commits/"*"/statuses"*)
    # Newest first, as the API lists them. Another run's "<state> <description>": MOCK_FOREIGN_STATUS
    # wrote it after this run's writes, MOCK_PRIOR_STATUS before them.
    cat "$MOCK_DIR/status-records" 2>/dev/null |
      jq -s --arg foreign "${MOCK_FOREIGN_STATUS:-}" --arg prior "${MOCK_PRIOR_STATUS:-}" '
        def other: {context: "release-verification", state: (split(" ")[0]), description: sub("^[^ ]* "; ""),
          target_url: "https://github.com/youversion/expo/actions/runs/43"};
        reverse | (if $foreign == "" then . else [$foreign | other] + . end)
          | (if $prior == "" then . else . + [$prior | other] end)' |
      filter "$@" ;;
  *"/statuses/"*)
    flaky status
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
    jq -nc --arg state "$state" --arg description "$description" --arg url "$url" \
      '{context: "release-verification", state: $state, description: $description, target_url: $url}' \
      >> "$MOCK_DIR/status-records" ;;
  *"/dispatches"*)
    [ "$GH_TOKEN" = dispatch-token ] || { echo "dispatched with $GH_TOKEN" >&2; exit 1; }
    jq -r '[.inputs.platform, .inputs.sdk_ref, .inputs.build_name] | join(" | ")' "$(arg_after --input "$@")" \
      >> "$MOCK_DIR/dispatches"
    # After the dispatch is recorded: GitHub took it, but the response was lost.
    flaky dispatch ;;
  *"/runs?event=workflow_dispatch"*)
    flaky lookup
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
    flaky poll
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

# ── Wiring: what starts the workflow and what it cancels ──────────────────

# The YAML block of the named job.
job_block() { awk -v job="  $1:" '$0 == job { in_job = 1; next } in_job && /^  [[:alnum:]_-]+:$/ { exit } in_job' "$WORKFLOW"; }

# Both Release and the trigger must be listed by their workflows' names, or that event never starts
# a run: without the trigger, ordinary PRs never get their status and a required check hangs.
listed=$(sed -n 's/^    workflows: \[\(.*\)\]$/\1/p' "$WORKFLOW")
unmatched=""
for name in Release "$(sed -n 's/^name: //p' "$TRIGGER")"; do
  grep -qxF "name: $name" "$ROOT"/.github/workflows/*.yml && [[ ", $listed, " == *", $name, "* ]] \
    || unmatched="$unmatched '$name'"
done
if [ -z "$unmatched" ]; then
  pass "runs after both Release and the PR trigger, named as those workflows are"
else
  fail "runs after both Release and the PR trigger, named as those workflows are" \
    "workflows: [$listed] does not name:$unmatched"
fi
if grep -qF "if: github.event.workflow_run.conclusion == 'success'" <<< "$(job_block resolve)"; then
  pass "resolves nothing after a failed or skipped trigger run"
else
  fail "resolves nothing after a failed or skipped trigger run" \
    "a skipped trigger (a PR title edit) would restart the suite on the release head"
fi
if grep -qx '      group: release-verification' <<< "$(job_block verify)" \
  && grep -qx '      cancel-in-progress: true' <<< "$(job_block verify)"; then
  pass "a newer release head cancels the verification of an older one"
else
  fail "a newer release head cancels the verification of an older one" \
    "the verify job has no cancelling release-verification concurrency group"
fi
types=$(sed -n 's/^    types: \[\(.*\)\]$/\1/p' "$TRIGGER")
missing_types=""
for type in opened synchronize reopened edited; do
  [[ ", $types, " == *", $type, "* ]] || missing_types="$missing_types $type"
done
if grep -qx '    branches: \[main\]' "$TRIGGER" && [ -z "$missing_types" ] \
  && grep -q '^    if: .*github\.event\.changes\.base' "$TRIGGER"; then
  pass "requests the check for every PR head into main, and for a PR retargeted to main"
else
  fail "requests the check for every PR head into main, and for a PR retargeted to main" \
    "branches not [main], missing types:${missing_types:- none}, or the edited filter ignores retargets"
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
    HEAD_REPO="${HEAD_REPO:-youversion/expo}" HEAD_BRANCH="${HEAD_BRANCH:-changeset-release/main}"\
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
HEAD_REPO=someone/expo run_resolve_case "never starts the suite for a fork PR that shares the release head" \
  pull_request "$SHA" "$(release_pr "$SHA")" "$MAIN_SHA" "" ""
HEAD_BRANCH=feature run_resolve_case "never starts the suite for another branch at the release head" \
  pull_request "$SHA" "$(release_pr "$SHA")" "$MAIN_SHA" "" ""
MOCK_FLAKY=pr-lookup run_resolve_case "rides out a transient gh error while finding the release PR" \
  push "$MAIN_SHA" "$(release_pr "$SHA")" "$MAIN_SHA" "$SHA" ""
NOT_RELEASE="success Not a Version Packages PR; nothing to verify."
# The release PR event again, with the head's latest status from an earlier run.
reopened() {
  MOCK_PRIOR_STATUS="$1" run_resolve_case "$2" pull_request "$SHA" "$(release_pr "$SHA")" "$MAIN_SHA" "$3" ""
}
reopened "success The iOS and Android device suites passed." "a reopened release PR keeps the pass on its head" ""
reopened "pending Running the ios device suite (try 1)." "a reopened release PR leaves the running suite alone" ""
reopened "error Stopped before finishing; see the run log." "a reopened release PR reruns a suite that errored" "$SHA"
reopened "$NOT_RELEASE" "verifies a release head that another PR marked not a release" "$SHA"

# ── Verify: the device suites on that head ────────────────────────────────

# The verify step's environment, apart from what names the case dir.
VERIFY_ENV=(SHA="$SHA" GH_TOKEN=repo-token DISPATCH_TOKEN=dispatch-token GITHUB_REPOSITORY=youversion/expo
  GITHUB_RUN_ID=42 GITHUB_RUN_ATTEMPT=1 RUN_URL="$RUN_URL"
  AUTOMATION_REPO=youversion/automation WORKFLOW_FILE=browserstack-manual.yml)

new_verify_dir() {
  dir="$TMP/$1"
  mkdir -p "$dir"
  touch "$dir/statuses" "$dir/dispatches" "$dir/summary" "$dir/status-records"
}

run_case() {
  local name="$1" expected_exit="$2" expected_statuses="$3" expected_platforms="$4"
  shift 4
  new_verify_dir "case-$passes-$failures"
  env PATH="$TMP/bin:$PATH" MOCK_DIR="$dir" POLL_MINUTES=60 GITHUB_STEP_SUMMARY="$dir/summary" "$@" \
    "${VERIFY_ENV[@]}" bash "$TMP/verify.sh" > "$dir/out" 2>&1
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
  pending,error ios MOCK_UNLISTED=ios
run_case "rides out a transient gh error while polling" 0 \
  pending,pending,success ios,android MOCK_FLAKY=poll
run_case "rides out a transient gh error while finding the dispatched run" 0 \
  pending,pending,success ios,android MOCK_FLAKY=lookup
run_case "rides out a transient gh error while writing a status" 0 \
  pending,pending,success ios,android MOCK_FLAKY=status
run_case "finds a dispatch that went through despite a gh error, without dispatching again" 0 \
  pending,pending,success ios,android MOCK_FLAKY=dispatch
run_case "a stop before the run is found reports an error over another PR's not-a-release success" 1 \
  pending,error ios MOCK_BROKEN=lookup MOCK_PRIOR_STATUS="$NOT_RELEASE"
run_case "gives up on a run that never finishes and cancels it" 1 \
  pending,error ios MOCK_NEVER_DONE=ios POLL_MINUTES=1
if [ "$(cat "$dir/cancels" 2>/dev/null)" = 1 ]; then
  pass "a run that times out is cancelled in the automation repo"
else
  fail "a run that times out is cancelled in the automation repo" "cancelled: '$(cat "$dir/cancels" 2>/dev/null)'"
fi
run_case "an unexpected stop reports an error" 1 pending,error ios MOCK_BROKEN=poll
if [ "$(cat "$dir/cancels" 2>/dev/null)" = 1 ]; then
  pass "an unexpected stop cancels the remote run it started"
else
  fail "an unexpected stop cancels the remote run it started" "cancelled: '$(cat "$dir/cancels" 2>/dev/null)'"
fi
run_case "a stopped run never writes over a newer run's status" 1 pending ios \
  MOCK_BROKEN=poll MOCK_FOREIGN_STATUS="pending Running the ios device suite (try 1)."

# A cancel or job timeout sends SIGINT to the step's shell, SIGTERM 7.5s later, and kills the
# tree 2.5s after that, so the trap has to run while the step is mid-poll, not after its sleep.
name="a cancelled job reports an error and cancels its remote run before SIGTERM"
new_verify_dir signal
mkdir -p "$TMP/real-sleep"
ln -s /bin/sleep "$TMP/real-sleep/sleep"
# perl restores the default SIGINT that a background job would otherwise ignore, as the runner's shell has,
# and starts a process group so the sleep the stopped step leaves behind can be cleaned up.
# shellcheck disable=SC2016
env PATH="$TMP/real-sleep:$TMP/bin:$PATH" MOCK_DIR="$dir" POLL_MINUTES=60 GITHUB_STEP_SUMMARY="$dir/summary" \
  "${VERIFY_ENV[@]}" perl -e 'setpgrp; $SIG{INT} = "DEFAULT"; exec @ARGV' bash "$TMP/verify.sh" > "$dir/out" 2>&1 &
pid=$!
for _ in $(seq 1 50); do grep -q 'try 1' "$dir/summary" && break; /bin/sleep 0.1; done
kill -INT "$pid"
for _ in $(seq 1 70); do kill -0 "$pid" 2>/dev/null || break; /bin/sleep 0.1; done
statuses=$(cut -d' ' -f1 "$dir/statuses" | paste -sd, -)
if kill -0 "$pid" 2>/dev/null; then
  kill -KILL "$pid"
  fail "$name" "still running 7s after SIGINT"
elif [ "$statuses" = pending,error ] && [ "$(cat "$dir/cancels" 2>/dev/null)" = 1 ]; then
  pass "$name"
else
  fail "$name" "statuses '$statuses', cancelled '$(cat "$dir/cancels" 2>/dev/null)'"
fi
kill -- -"$pid" 2>/dev/null

printf '\n%d passed, %d failed\n' "$passes" "$failures"
[[ "$failures" -eq 0 ]]
