# Barcode Scanner Readiness and Error Alert Design

## Goal

Restore hands-free sequential barcode scanning on the Receive and Release screens and show a prominent blocking confirmation when a barcode is invalid or duplicated.

## Scope

- `app/(tabs)/receive.tsx`
- `app/(tabs)/release.tsx`
- One shared scan-error modal component used by both screens
- One small runnable test covering error-message classification

No scanner SDK, Android broadcast integration, new dependency, batching, or background scan queue is required.

## Confirmed Behavior

### Automatic submission

- When Auto mode is enabled, any non-empty tracking input is submitted after it remains unchanged for 250 ms.
- The current per-character scanner-speed heuristic is removed. Scanner input must not depend on characters arriving within 35 ms.
- A scanner or keyboard Enter submits immediately and cancels the pending auto-submit timer.
- Submitting must not permanently blur the tracking input.
- After a successful API response, the input is cleared and focused automatically for the next scan.
- While a scan request is being processed, another scan is not accepted. The screen becomes ready automatically when the request finishes. No multi-item queue is introduced.
- When Auto mode is disabled, input is submitted only by the existing manual action.

### Blocking error modal

- Use the approved custom modal design: large text, high-contrast red warning treatment, and one prominent `ยืนยัน` button.
- While the modal is visible, the tracking input cannot accept scanner input.
- The modal cannot be dismissed by tapping the backdrop.
- Android Back must not bypass confirmation while the modal is visible.
- Pressing `ยืนยัน` closes the modal, clears stale input, and restores focus to the tracking input.

### Error messages

- A duplicate found in the current session history displays `รายการนี้ถูกสแกนแล้ว`.
- API duplicate responses (`ALREADY_RECEIVED`, `ALREADY_RELEASED`, or equivalent existing message detection) display `รายการนี้ถูกสแกนแล้ว`.
- Invalid, unknown, not-found, wrong-customer, or destination-mismatch barcodes display `เลขนี้ไม่ถูกต้อง`.
- Connection or unexpected server failures display `ไม่สามารถตรวจสอบรายการได้` so a system outage is not misreported as an invalid barcode.
- Existing beep patterns may remain as secondary feedback, but the modal is the authoritative blocking feedback.
- The current silent same-code rejection within 1.5 seconds must not hide a genuine duplicate scan. Duplicate scans must reach the duplicate modal.

## Data Flow

1. Scanner writes a tracking number into the focused `TextInput`.
2. Auto mode resets a 250 ms trailing timer after each change.
3. When the timer fires, or Enter is received, the screen submits the current normalized value once.
4. The request lock prevents a second submission of the same input event.
5. Success clears the input, records history, and restores focus.
6. Validation or duplicate failure clears the input and opens the blocking error modal.
7. Confirming the modal closes it and restores focus for the next scan.

## Implementation Boundaries

- Reuse React Native's existing `Modal`; do not add a UI dependency.
- Keep the scan flow inside the two existing screens.
- Share only the visual error modal because both screens require identical presentation and confirmation behavior.
- Do not add a generalized scanner framework, queue, context, provider, or native module.

## Verification

- Auto enabled: scan without Enter; submission occurs after input is idle and the input clears on success.
- Auto enabled: scan with an Enter suffix; exactly one request is submitted and focus remains available afterward.
- Auto disabled: typing does not auto-submit; the manual control still submits.
- Scan two valid barcodes sequentially without manually pressing Enter.
- Scan a barcode already present in local history; the duplicate modal appears and blocks further input until confirmation.
- Receive an API duplicate response; the duplicate modal appears.
- Scan an invalid/not-found barcode; the invalid-number modal appears.
- Simulate a connection failure; the system-failure modal appears rather than the invalid-number message.
- Press `ยืนยัน`; the modal closes and the tracking input is focused.
- Run TypeScript validation and the focused error-classification test.
