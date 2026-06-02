// SDK version reported by the runtime (e.g. for HTTP request headers).
//
// On `main` between releases this reads "Dev" so dev/CI builds don't
// report a stale released version. `scripts/stamp-version.sh` overwrites
// it with the chosen semver during a release; `scripts/restore-dev-sdk-on-main.sh`
// puts it back to "Dev" as the follow-up commit Y after publish.
//
// Keep the constant name and the string format ("Dev" vs. semver) stable —
// both scripts grep for them.
export const SDK_VERSION = "Dev";
