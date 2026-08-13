# Offline Scanner Test Mode Design

## Goal

Provide an internal Android test build that lets warehouse users manually validate scanner input, automatic readiness, and blocking error alerts without making any API request or changing production data.

## Scope

- A build-time `EXPO_PUBLIC_SCANNER_TEST_MODE` flag enabled only by a new internal EAS build profile.
- A small local scan-result helper used by Receive and Release when the flag is enabled.
- A fixed local Release customer available only in test mode.
- A visible, persistent test-mode banner on the two scanner screens.
- The existing production scan flow remains unchanged when the flag is absent or false.

No mock server, database, API request, login bypass, production-web switch, or new dependency is included.

## Build and Access

- Add an EAS profile named `scanner-test` with `distribution: internal`, Android APK output, and `EXPO_PUBLIC_SCANNER_TEST_MODE=true`.
- Do not set `EXPO_PUBLIC_API_URL` in this profile because test-mode scans must not contact a backend.
- The team distributes this APK only to internal testers. It is not submitted to an app store and does not replace the production APK or web deployment.
- Test mode does not require authentication. The root route (`app/index.tsx`) must route directly to Receive in test mode rather than calling `getValidAccessToken`.
- Receive and Release must skip their authentication checks on mount, focus, and app-resume lifecycle events in test mode. Release must also skip customer loading in every test-mode lifecycle path.

## Test-mode Presentation

- Receive and Release show a persistent, high-contrast banner: `โหมดทดสอบ — ไม่มีการบันทึกข้อมูล`.
- The banner is visible before any scan, so a tester can confirm they are not using production.
- Release automatically uses the local customer `{ uuid: "scanner-test-customer", code: "TEST", name: "TEST CUSTOMER" }`; the normal customer picker and reload control are hidden in test mode.

## Local Scan Outcomes

- A non-empty scan succeeds by default after the existing auto/manual submission rules.
- The first successful scan of a normalized tracking number adds it to the in-memory session set and visible history, exactly like production.
- Scanning that same number again displays `รายการนี้ถูกสแกนแล้ว` and waits for `ยืนยัน`.
- Any normalized tracking number beginning with `INVALID` displays `เลขนี้ไม่ถูกต้อง` and waits for `ยืนยัน`.
- Any normalized tracking number beginning with `SYSTEM` displays the existing system-error message and waits for `ยืนยัน`.
- On success, clear the field and restore focus. On an error, use the existing blocking modal; after `ยืนยัน`, clear stale text and restore focus.
- The local helper does not call `api`, `getValidAccessToken`, `ensureAuthenticated`, or any network API.

## Production Safety

- Production behavior is protected by a build-time flag and keeps its current API requests, authentication, customer picker, and backend result handling.
- Test mode is not user-toggleable. A production user cannot enable it from the UI, query string, or persisted setting.
- Removing an API URL from a local `.env` file is not the safety mechanism; the scanner-test build's local branch is.

## Verification

- Build the `scanner-test` APK and install it on the target scanning device.
- Confirm the persistent test-mode banner appears and no production login or customer-load request is attempted.
- On Receive and Release, scan five valid arbitrary codes sequentially without Enter; each must clear and return focus after 150 ms submission.
- Scan a successful code again; verify the duplicate modal, `ยืนยัน` requirement, and focus restoration.
- Scan `INVALID001`; verify the invalid-code modal and focus restoration after confirmation.
- Scan `SYSTEM001`; verify the system-error modal and focus restoration after confirmation.
- With Auto disabled, verify a value waits for manual submission.
- In a production build, verify the banner and local customer are absent and normal API behavior is unchanged.
- Run `npx tsc --noEmit` and focused Jest tests for the local result helper and `ScanErrorModal` classification.
