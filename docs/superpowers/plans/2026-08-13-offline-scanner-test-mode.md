# Offline Scanner Test Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal Android scanner-test APK that exercises sequential scan handling and blocking alerts without any production request or database write.

**Architecture:** A build-time flag selects a small pure local-outcome helper. The root route and scanner lifecycle guards bypass authentication and customer requests; each scanner screen handles local success or error inside its existing request-lock flow. Production retains the existing API paths when the flag is false.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript, EAS Build, Jest Expo.

## Global Constraints

- Only the `scanner-test` internal APK sets `EXPO_PUBLIC_SCANNER_TEST_MODE=true`.
- Test mode must never call authentication, customer loading, scanning APIs, or any network endpoint.
- The permanent banner text is `โหมดทดสอบ — ไม่มีการบันทึกข้อมูล`.
- `INVALID*` is invalid, `SYSTEM*` is system error, and a repeated successful code is duplicate.
- Production remains unchanged with test mode off; no runtime user switch is added.

---

### Task 1: Add the build-time test-mode contract and pure local result test

**Files:**
- Create: `utils/scannerTestMode.ts`
- Create: `utils/scannerTestMode.test.ts`
- Modify: `eas.json`

**Interfaces:**
- Produces: `isScannerTestMode: boolean`, `getScannerTestOutcome(code: string): "success" | "invalid" | "system"`, and the EAS `scanner-test` profile.

- [ ] **Step 1: Write outcome tests**

```ts
expect(getScannerTestOutcome("TEST001")).toBe("success");
expect(getScannerTestOutcome("INVALID001")).toBe("invalid");
expect(getScannerTestOutcome("SYSTEM001")).toBe("system");
```

- [ ] **Step 2: Implement the flag and local classifier**

```ts
export const isScannerTestMode =
  process.env.EXPO_PUBLIC_SCANNER_TEST_MODE === "true";

export const getScannerTestOutcome = (code: string) =>
  code.startsWith("INVALID") ? "invalid" : code.startsWith("SYSTEM") ? "system" : "success";
```

- [ ] **Step 3: Add the internal APK profile**

```json
"scanner-test": {
  "distribution": "internal",
  "env": { "EXPO_PUBLIC_SCANNER_TEST_MODE": "true" },
  "android": { "buildType": "apk", "image": "ubuntu-22.04-jdk-17-ndk-r26b", "gradleCommand": ":app:assembleRelease" }
}
```

- [ ] **Step 4: Verify**

Run: `npx jest utils/scannerTestMode.test.ts --runInBand`

Expected: 3 passing assertions.

### Task 2: Bypass production startup and lifecycle requests in test mode

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/(tabs)/receive.tsx`
- Modify: `app/(tabs)/release.tsx`

**Interfaces:**
- Consumes: `isScannerTestMode`.
- Produces: direct Receive navigation and no auth/customer lifecycle call in test mode.

- [ ] **Step 1: Make `app/index.tsx` route test builds directly to Receive**

```tsx
if (isScannerTestMode) {
  router.replace("/(tabs)/receive");
  return;
}
```

- [ ] **Step 2: Return a local token in each `ensureAuthenticated` callback and guard mount/focus/resume effects**

```tsx
if (isScannerTestMode) return "scanner-test";
```

Wrap each existing lifecycle authentication call in `if (!isScannerTestMode)`.

- [ ] **Step 3: Make Release use the deterministic local customer and skip customer loading**

```tsx
const TEST_CUSTOMER: Customer = { uuid: "scanner-test-customer", code: "TEST", name: "TEST CUSTOMER", companyCode: "", email: "", tel: "", discountPointRate: 0, createdAt: "", totalOrder: 0 };
```

Set it on mount in test mode, return before `loadCustomers`, and hide the picker/reload controls when test mode is true.

### Task 3: Run scan results locally and show the safety banner

**Files:**
- Modify: `app/(tabs)/receive.tsx`
- Modify: `app/(tabs)/release.tsx`

**Interfaces:**
- Consumes: `getScannerTestOutcome`, `isScannerTestMode`, existing scan request locks and `ScanErrorModal`.
- Produces: successful local history records, local invalid/system modal outcomes, and an always-visible test banner.

- [ ] **Step 1: Branch before every scanning API request when test mode is on**

```tsx
const outcome = getScannerTestOutcome(normalized);
if (outcome === "invalid" || outcome === "system") {
  modalOpened = true;
  showScanError(outcome === "invalid" ? "generic" : "system");
  return;
}
```

For `success`, create the same local record, add the code to `scannedCodesRef`, clear input, update history/status, and play the existing success sound. Never call `api` or token code in this branch.

- [ ] **Step 2: Add the persistent banner at the top of both scanner pages**

```tsx
{isScannerTestMode && (
  <View style={styles.testModeBanner}>
    <Text style={styles.testModeBannerText}>โหมดทดสอบ — ไม่มีการบันทึกข้อมูล</Text>
  </View>
)}
```

- [ ] **Step 3: Verify all static and focused tests**

Run: `npx jest utils/scannerTestMode.test.ts app/components/ScanErrorModal.test.ts --runInBand && npx tsc --noEmit && git diff --check`

Expected: all tests pass, TypeScript exits 0, and no whitespace errors.

## Self-Review

- **Spec coverage:** Task 1 provides isolated build configuration and test outcomes; Task 2 covers root, auth, app lifecycle, and Release customers; Task 3 gives local scanning plus an unmistakable safety banner.
- **Placeholder scan:** No placeholders or deferred behavior.
- **Type consistency:** Both screens consume the same boolean and three-value outcome union; Release uses a complete `Customer` object.
