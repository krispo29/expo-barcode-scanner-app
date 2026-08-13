# Barcode Scanner Readiness and Error Alert Design

## Goal

Restore hands-free sequential barcode scanning on the Receive and Release screens and display a prominent blocking confirmation when a barcode is invalid or duplicated.

## Scope

- `app/(tabs)/receive.tsx`
- `app/(tabs)/release.tsx`
- The shared `app/components/ScanErrorModal.tsx` component and its error classification
- The existing focused error-classification test

No scanner SDK, Android broadcast integration, new dependency, batching, or background scan queue is required.

## Confirmed Behavior

### Automatic submission

- When Auto mode is enabled, a non-empty tracking input is submitted after it remains unchanged for 150 ms.
- Scanner or keyboard Enter submits immediately and cancels the pending automatic submission timer.
- Submission does not permanently blur the tracking input.
- After a successful API response, clear the input and restore focus automatically for the next scan.
- While a request is processing, reject further scans. When it completes, the screen becomes ready automatically.
- When Auto mode is disabled, retain the existing manual submission action only.

### Blocking error modal

- Use the confirmed card modal: dark overlay, red border and button, warning icon, and large high-contrast message.
- Invalid or unknown barcode text is `เลขนี้ไม่ถูกต้อง`.
- Duplicate barcode text is `รายการนี้ถูกสแกนแล้ว`.
- The modal has one primary `ยืนยัน` button.
- The modal cannot be dismissed by touching the backdrop or Android Back.
- Do not accept scanner input while it is visible.
- Confirming clears any stale input, closes the modal, and restores focus to the tracking field.

### Error classification

- A tracking number successfully processed at any time since this screen was opened is a duplicate, even when it has dropped from the visible capped history. Keep a separate in-memory set for this purpose and reset it only when the screen session is recreated.
- API duplicate responses, including `ALREADY_RECEIVED` and `ALREADY_RELEASED`, are duplicates.
- Invalid, unknown, not-found, wrong-customer, and destination-mismatch responses are invalid barcodes.
- Connection failures and unexpected server failures remain a distinct system-error message; they must not be reported as invalid barcodes.

## Data Flow

1. The scanner writes a tracking number to the focused input.
2. Auto mode resets a 150 ms trailing timer after every input change.
3. The timer or Enter submits the normalized tracking number once.
4. A request lock prevents another scan while processing.
5. On success, record history, clear the input, and refocus it.
6. On validation or duplicate failure, clear input and open the blocking modal.
7. On `ยืนยัน`, close the modal and refocus for the next scan.

## Implementation Boundaries

- Reuse React Native `Modal`; do not add a UI dependency.
- Keep submission, focus, timers, and request handling in the existing screen files.
- Reuse the existing shared modal; do not introduce a scanner framework, queue, context, provider, or native module.

## Verification

- Auto mode submits without Enter after 150 ms and is ready for successive scans.
- An Enter suffix results in exactly one request.
- Manual mode does not auto-submit.
- Invalid and duplicate scans show their respective blocking messages and resume only after confirmation.
- A system failure shows the system-error message rather than the invalid-barcode message.
- TypeScript validation passes with `npx tsc --noEmit`.
- The focused modal test passes with `npx jest app/components/ScanErrorModal.test.ts --runInBand`.
