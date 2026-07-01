# Bug report: YouVersion Platform auth page + id_token issues

**Reported from:** `platform-sdk-reactnative-expo` (Expo/React Native SDK)
**Related ticket:** YPE-3445
**Affected surface:** the hosted auth page at `https://<apiHost>/auth/authorize` and the id_token returned by the token endpoint.

These two issues live in the **auth website / backend**, not in the SDK. The SDK has shipped defensive workarounds for both (see "SDK-side mitigation" under each), but those do not remove the need for the upstream fix — other platform clients (web, iOS, Android) hit the same root causes.

---

## Bug A — `profile_picture` claim is set to a placeholder URL when the user has no photo

### Observed
The id_token returned after sign-in contains a `profile_picture` claim of `https://none/` (and the bare string `None` has also been seen) for users who have no profile photo. This looks like a null/`None` value being serialized into a URL string instead of being omitted.

### Expected
When a user has no profile photo, **omit the `profile_picture` claim entirely**. A JSON `null` is also acceptable. Never emit a placeholder host such as `none`, `null`, `undefined`, or `false`.

### Impact
Every downstream consumer of the id_token receives a valid-looking but meaningless URL. Naive avatar rendering (`<img src={profile_picture}>`) shows a broken image; some clients attempt a network request to `https://none/`.

### SDK-side mitigation (already shipped)
`sanitizeAvatarUrl` in `packages/core/src/auth/id-token.ts` drops the claim when it is a sentinel value (bare or as the URL host) or is not an `http(s)` URL. Defensive only.

---

## Bug B — The Cancel button on the auth page does nothing

### Observed
On `https://<apiHost>/auth/authorize`, clicking **Cancel** has no effect. On native/mobile clients the auth page is opened in a system browser session (iOS `ASWebAuthenticationSession` / Android Custom Tab); because Cancel does not navigate anywhere, the user is stranded on the auth page and can only escape by manually dismissing the OS browser chrome.

### Expected
The Cancel button should redirect the browser to the request's `redirect_uri` with an OAuth cancellation signal, per **RFC 6749 §4.1.2.1**:

```
<redirect_uri>?error=access_denied&state=<the original state value>
```

- `error=access_denied` is the standard signal for user-initiated cancellation.
- **`state` must be echoed** with the exact value from the authorization request. Native clients validate `state` before acting on the redirect (CSRF protection); a cancel redirect that omits or changes `state` is rejected as a possible attack and the cancel is not honored.

### Impact
Native SDK clients cannot detect an in-page cancel. The only current escape is the OS-level browser dismiss, which is not discoverable and reads as the app being stuck.

### SDK-side mitigation (already shipped)
`signInWithPKCE` in `packages/core/src/auth/pkce-flow.ts` now treats a redirect with a valid `state` and `error=access_denied` as a clean cancel (`{ kind: 'cancel' }`) instead of a thrown error. This only works once the auth page actually performs the redirect above.

---

## Suggested priority
- **Bug A**: low effort, high blast radius (affects all clients rendering avatars). Fix at the token/backend layer.
- **Bug B**: small front-end change on the auth page (wire Cancel to the redirect), unblocks proper cancel UX on all native clients.
