#!/usr/bin/env bash
# Behavioral tests for the release-verification workflow step, run against a fake gh.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/release-verification.yml"
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

awk '
  $0 == "      - name: Run the device suite on the release PR head" { found = 1; next }
  found && $0 == "        run: |" { capture = 1; next }
  capture && ($0 ~ /^      - name:/ || $0 ~ /^  [[:alnum:]_-]+:/) { exit }
  capture { sub(/^          /, ""); print }
' "$WORKFLOW" > "$TMP/verify.sh"

mkdir -p "$TMP/bin"
printf '#!/usr/bin/env bash\n' > "$TMP/bin/sleep"
cat > "$TMP/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  "pr list "*)
    printf '%s\n' "${MOCK_SHA:-}" ;;
  *"/statuses/"*)
    [ "$GH_TOKEN" = repo-token ] || { echo "status written with $GH_TOKEN" >&2; exit 1; }
    state="" description=""
    for arg in "$@"; do
      case "$arg" in state=*) state=${arg#state=} ;; description=*) description=${arg#description=} ;; esac
    done
    printf '%s %s\n' "$state" "$description" >> "$MOCK_DIR/statuses" ;;
  *"/dispatches"*)
    [ "$GH_TOKEN" = dispatch-token ] || { echo "dispatched with $GH_TOKEN" >&2; exit 1; }
    jq -r '[.inputs.platform, .inputs.sdk_ref, .inputs.build_name] | join(" | ")' >> "$MOCK_DIR/dispatches" ;;
  *"/runs?event=workflow_dispatch"*)
    platform=$(tail -1 "$MOCK_DIR/dispatches" | cut -d' ' -f1)
    [ "$platform" = "${MOCK_UNLISTED:-}" ] || printf '%s\n' "$(wc -l < "$MOCK_DIR/dispatches" | tr -d ' ')" ;;
  *"/actions/runs/"*)
    [ -z "${MOCK_POLL_ERROR:-}" ] || exit 1
    run=${2##*/}
    platform=$(sed -n "${run}p" "$MOCK_DIR/dispatches" | cut -d' ' -f1)
    count=$(( $(cat "$MOCK_DIR/polls.$platform" 2>/dev/null || echo 0) + 1 ))
    echo "$count" > "$MOCK_DIR/polls.$platform"
    # The first poll sees the run still in progress.
    if [ "$count" -gt 1 ]; then
      var="MOCK_CONCLUSION_$platform"
      printf '%s\n' "${!var:-success}"
    fi ;;
  "run cancel "*)
    echo "$3" >> "$MOCK_DIR/cancels" ;;
  *) echo "unexpected gh $*" >&2; exit 1 ;;
esac
GH
chmod +x "$TMP/bin/gh" "$TMP/bin/sleep"

SHA=0123456789abcdef0123456789abcdef01234567

run_case() {
  local name="$1" expected_exit="$2" expected_statuses="$3" expected_platforms="$4"
  shift 4
  dir="$TMP/case-$passes-$failures"
  mkdir -p "$dir"
  touch "$dir/statuses" "$dir/dispatches"
  env PATH="$TMP/bin:$PATH" MOCK_DIR="$dir" MOCK_SHA="$SHA" "$@" \
    GH_TOKEN=repo-token DISPATCH_TOKEN=dispatch-token GITHUB_REPOSITORY=youversion/expo \
    GITHUB_SERVER_URL=https://github.com GITHUB_RUN_ID=42 GITHUB_RUN_ATTEMPT=1 \
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
if grep -qx "ios | $SHA | Release verification 0123456 ios 42.1" "$dir/dispatches"; then
  pass "dispatches the exact release PR head under a run-unique build name"
else
  fail "dispatches the exact release PR head under a run-unique build name" "$(cat "$dir/dispatches")"
fi
run_case "fails on iOS and never starts Android" 1 \
  pending,failure ios MOCK_CONCLUSION_ios=failure
run_case "reports a cancelled run as an error, not a test failure" 1 \
  pending,pending,error ios,android MOCK_CONCLUSION_android=cancelled
run_case "reports an error when the dispatched run cannot be found" 1 \
  error ios MOCK_UNLISTED=ios
run_case "an unexpected stop reports an error" 1 pending,error ios MOCK_POLL_ERROR=1
if [ "$(cat "$dir/cancels" 2>/dev/null)" = 1 ]; then
  pass "an unexpected stop cancels the remote run it started"
else
  fail "an unexpected stop cancels the remote run it started" "cancelled: '$(cat "$dir/cancels" 2>/dev/null)'"
fi
run_case "does nothing without an open release PR" 0 "" "" MOCK_SHA=

printf '\n%d passed, %d failed\n' "$passes" "$failures"
[[ "$failures" -eq 0 ]]
