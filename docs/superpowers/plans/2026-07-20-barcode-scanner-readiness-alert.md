# Barcode Scanner Readiness and Error Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically submit scanner input without Enter and block further scanning behind a prominent confirmation modal for invalid or duplicate barcodes.

**Architecture:** Keep request, timer, and focus behavior in the existing Receive and Release screens. Add one shared React Native modal containing a colocated pure classifier so both screens use identical error copy without a new dependency.

**Tech Stack:** Expo 54, React Native 0.81, React 19, TypeScript 5.9, Jest with `jest-expo`.

## Global Constraints

- Auto-submit non-empty input after 250 ms without using a per-character speed heuristic.
- Enter submits immediately without permanently blurring the tracking input.
- Do not accept another scan while a request or error modal is active.
- Duplicate copy: `รายการนี้ถูกสแกนแล้ว`.
- Invalid barcode copy: `เลขนี้ไม่ถูกต้อง`.
- Transport/server failure copy: `ไม่สามารถตรวจสอบรายการได้`.
- The modal requires explicit confirmation and restores focus afterward.
- Do not add dependencies, batching, a scan queue, scanner SDK integration, context, or provider.
- Preserve unrelated staged files; commits must use explicit pathspecs.

---

### Task 1: Shared scan-error modal and classifier

**Files:**
- Create: `app/components/ScanErrorModal.tsx`
- Create: `app/components/ScanErrorModal.test.ts`

**Interfaces:**
- Produces: `ScanErrorKind`, `classifyScanError(message?, apiCode?, systemFailure?)`, and `ScanErrorModal({ kind, onConfirm })`.
- Consumes: React Native `Modal`, `StyleSheet`, `Text`, `TouchableOpacity`, and `View` only.

- [ ] **Step 1: Write the failing classifier test**

```ts
import { classifyScanError, getScanErrorMessage } from "./ScanErrorModal";

describe("scan error classification", () => {
  test.each(["ALREADY_RECEIVED", "ALREADY_RELEASED"])(
    "maps %s to duplicate",
    (code) => expect(classifyScanError(undefined, code)).toBe("duplicate"),
  );

  test("maps not-found responses to invalid copy", () => {
    expect(getScanErrorMessage(classifyScanError("not found"))).toBe(
      "เลขนี้ไม่ถูกต้อง",
    );
  });

  test("keeps system failures distinct from invalid barcodes", () => {
    expect(getScanErrorMessage(classifyScanError(undefined, undefined, true))).toBe(
      "ไม่สามารถตรวจสอบรายการได้",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npx jest app/components/ScanErrorModal.test.ts --runInBand`

Expected: FAIL because `ScanErrorModal` does not exist.

- [ ] **Step 3: Implement the pure classifier and blocking modal**

```tsx
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ScanErrorKind =
  | "duplicate"
  | "wrongCustomer"
  | "destinationMismatch"
  | "notFound"
  | "generic"
  | "system";

export const classifyScanError = (
  message?: string,
  apiCode?: number | string,
  systemFailure = false,
): ScanErrorKind => {
  if (systemFailure) return "system";
  const code = apiCode === undefined ? "" : String(apiCode).trim().toUpperCase();
  const normalizedMessage = message?.trim().toLowerCase() ?? "";
  if (
    code === "ALREADY_RECEIVED" ||
    code === "ALREADY_RELEASED" ||
    (normalizedMessage.includes("already") &&
      (normalizedMessage.includes("receive") || normalizedMessage.includes("release")))
  ) return "duplicate";
  if (code === "WRONG_CUSTOMER" || normalizedMessage.includes("customer") || message?.includes("ลูกค้า")) return "wrongCustomer";
  if (code === "DESTINATION_COUNTRY_MISMATCH") return "destinationMismatch";
  if (code === "NOT_FOUND" || code === "TRACKING_NOT_FOUND" || normalizedMessage.includes("not found") || message?.includes("ไม่พบ")) return "notFound";
  return "generic";
};

export const getScanErrorMessage = (kind: ScanErrorKind) =>
  kind === "duplicate"
    ? "รายการนี้ถูกสแกนแล้ว"
    : kind === "system"
      ? "ไม่สามารถตรวจสอบรายการได้"
      : "เลขนี้ไม่ถูกต้อง";

export function ScanErrorModal({
  kind,
  onConfirm,
}: {
  kind: ScanErrorKind | null;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={kind !== null} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <Text style={styles.icon}>⚠</Text>
          <Text style={styles.message}>{kind ? getScanErrorMessage(kind) : ""}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onConfirm}>
            <Text style={styles.buttonText}>ยืนยัน</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

Add only the styles needed for a centered high-contrast red warning card and large confirmation control.

- [ ] **Step 4: Run the focused test and TypeScript**

Run: `npx jest app/components/ScanErrorModal.test.ts --runInBand`

Expected: PASS, 3 tests.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit only Task 1 paths**

Run: `git add -- app/components/ScanErrorModal.tsx app/components/ScanErrorModal.test.ts && git commit --only -m "feat: add blocking scan error modal" -- app/components/ScanErrorModal.tsx app/components/ScanErrorModal.test.ts`

---

### Task 2: Restore automatic submission on Receive

**Files:**
- Modify: `app/(tabs)/receive.tsx`

**Interfaces:**
- Consumes: `ScanErrorKind`, `classifyScanError`, and `ScanErrorModal` from `../components/ScanErrorModal`.
- Produces: Receive scanning with 250 ms trailing auto-submit, synchronous request lock, blocking errors, and focus restoration.

- [ ] **Step 1: Replace scanner-speed state with explicit request and modal state**

Remove `PendingScan`, `SCANNER_CHAR_INTERVAL_MS`, `SCANNER_BURST_MIN_LENGTH`, `pendingScanRef`, `scanBurstRef`, and `resetScanBurst`. Add:

```ts
const [scanError, setScanError] = useState<ScanErrorKind | null>(null);
const scanInFlightRef = useRef(false);
```

Keep `scannedLock` for rendering `editable`, and keep `latestInputRef` for the trailing timer.

- [ ] **Step 2: Replace local error classification with shared modal state**

Delete `normalizeApiCode` and `showReceiveAlert`. Add:

```ts
const showScanError = useCallback((kind: ScanErrorKind) => {
  setInput("");
  latestInputRef.current = "";
  inputRef.current?.blur();
  setScanError(kind);
}, []);

const confirmScanError = useCallback(() => {
  setScanError(null);
  setTimeout(() => inputRef.current?.focus(), 100);
}, []);
```

- [ ] **Step 3: Make `handleDetected` submit once and surface every duplicate**

- Check `scanInFlightRef.current` before starting a request.
- Remove the silent `lastValue === normalized && now - lastTimestamp < 1500` return.
- Send local-history duplicates to `showScanError("duplicate")`.
- Set both locks before the API request and release both in `finally`.
- Use `classifyScanError(response.data?.message, response.data?.code)` for handled API failures.
- In `catch`, pass `systemFailure = !error?.response || error.response.status >= 500`.
- Refocus in `finally` only when no modal was opened.

- [ ] **Step 4: Replace speed detection with trailing idle submission**

```ts
const handleInputChange = useCallback((text: string) => {
  const sanitized = text.replaceAll(/[\r\n]/g, "");
  const hasSubmitChar = /[\r\n]/.test(text);
  latestInputRef.current = sanitized;
  setInput(sanitized);
  clearAutoSubmitTimer();

  if (!autoEnter || !sanitized.trim()) return;
  if (hasSubmitChar) {
    void handleDetected(sanitized, "auto");
    return;
  }

  autoSubmitTimerRef.current = setTimeout(() => {
    const latestValue = latestInputRef.current.trim();
    if (latestValue === sanitized.trim()) void handleDetected(latestValue, "auto");
  }, 250);
}, [autoEnter, clearAutoSubmitTimer, handleDetected]);
```

- [ ] **Step 5: Render the lock and modal**

Set the tracking input to:

```tsx
editable={canScan && !scannedLock && scanError === null}
submitBehavior="submit"
```

Render once near the screen root:

```tsx
<ScanErrorModal kind={scanError} onConfirm={confirmScanError} />
```

- [ ] **Step 6: Run focused verification**

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npx jest app/components/ScanErrorModal.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 7: Commit only Receive**

Run: `git add -- 'app/(tabs)/receive.tsx' && git commit --only -m "fix: restore receive scanner readiness" -- 'app/(tabs)/receive.tsx'`

---

### Task 3: Apply the same scanner flow to Release

**Files:**
- Modify: `app/(tabs)/release.tsx`

**Interfaces:**
- Consumes: `ScanErrorKind`, `classifyScanError`, and `ScanErrorModal` from `../components/ScanErrorModal`.
- Produces: Release scanning with identical Auto behavior and blocking error confirmation while preserving customer selection.

- [ ] **Step 1: Remove the duplicated scanner-speed and error-classification code**

Remove the same obsolete constants, refs, pending-scan type, reset helper, and `showReleaseAlert`. Add `scanError`, `scanInFlightRef`, `showScanError`, and `confirmScanError` with the same signatures as Task 2.

- [ ] **Step 2: Preserve the customer guard and route errors through the modal**

- If no customer is selected, use `showScanError("wrongCustomer")`.
- Local and API duplicates use `showScanError("duplicate")`.
- Other API responses use `classifyScanError`.
- Network and HTTP 5xx failures use `classifyScanError(message, code, true)`.
- Remove the silent 1.5-second duplicate return and pending one-slot queue.

- [ ] **Step 3: Use the same 250 ms idle handler and input props**

Use the exact `handleInputChange` logic from Task 2. Set:

```tsx
editable={canScan && !scannedLock && scanError === null}
submitBehavior="submit"
```

Render:

```tsx
<ScanErrorModal kind={scanError} onConfirm={confirmScanError} />
```

- [ ] **Step 4: Run all checks**

Run: `npx jest app/components/ScanErrorModal.test.ts --runInBand`

Expected: PASS, 3 tests.

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit only Release**

Run: `git add -- 'app/(tabs)/release.tsx' && git commit --only -m "fix: restore release scanner readiness" -- 'app/(tabs)/release.tsx'`

---

### Task 4: Manual device acceptance check

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: a configured barcode scanner and test API account.
- Produces: confirmation that physical-device timing and focus match the approved behavior.

- [ ] **Step 1: Verify Receive Auto mode**

Scan two valid barcodes without pressing Enter. Each must submit after input stops, clear, and focus for the next scan.

- [ ] **Step 2: Verify Release Auto mode**

Select a customer, then scan two valid barcodes without pressing Enter. Each must submit once and return to ready state.

- [ ] **Step 3: Verify blocking errors**

Scan an invalid barcode and a duplicate. Each must show the approved modal, ignore additional scanner input until `ยืนยัน`, then focus the tracking input.

- [ ] **Step 4: Verify Manual mode**

Disable Auto, type a tracking number, and confirm it does not submit until the manual action is used.
