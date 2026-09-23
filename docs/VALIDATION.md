# MailWeave V1.0 validation report

Version **1.0.30**. Generated from the recorded browser run at **2026-09-18T17:23:41.907Z**.

**55/55 browser test groups passed.** Numbered mappings are in ACCEPTANCE.md. Runtime ZIP verification separately checks the exact allowlist, JavaScript syntax, manifest/package versions, and byte-identical rebuilds.

## Environment

- Windows_NT 10.0.26200
- CPU: 12th Gen Intel(R) Core(TM) i9-12900KF
- Node v24.19.0; Chrome 152.0.7977.78, headless
- Playwright 1.62.1; JSZip 3.10.1 from the installed development runtime
- Browser fixture: 1440 × 1000 CSS px; narrow-layout check at 560 × 800
- Generic DOM-only messages; populated hidden bodies; all external network blocked

## Measured stage timings

Milliseconds, one recorded run, not a statistical benchmark. Total includes additional discovery/final reconciliation and view construction, so individual columns need not sum to total. Fixtures are deliberately small; these results do not establish the proposed live Gmail 1-second/2-second targets.

| Messages | Discovery | Expansion wait | Classification | Ending comparison | Sanitize | Render | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 0.20 | 0.00 | 0.10 | 0.10 | 0.00 | 1.60 | 2.60 |
| 22 | 0.50 | 0.30 | 0.80 | 0.20 | 0.20 | 13.40 | 16.40 |
| 56 | 1.80 | 0.50 | 1.90 | 0.30 | 0.30 | 9.20 | 16.00 |
| 200 | 6.50 | 0.90 | 6.40 | 0.80 | 1.30 | 6.70 | 28.90 |

Nested quote cleanup, one synthetic message:

- 20 nested quotes: 0.20 ms
- 100 nested quotes: 0.30 ms
- 300 nested quotes: 1.30 ms

Cached fixture bodies required no header expansion. Remaining reported wait is event-loop scheduling, not a body-visibility deadline. Missing-body loading uses a bounded expansion budget. Cleanup/render work yields between messages; extremely large individual bodies may still exceed a frame budget.

## Verified and unverified

- Automated: synthetic discovery/loading/cleanup/security/export/controller/layout acceptance tests; screenshot inspected; runtime source unchanged by cleanup; local release packaging checks.
- Capture replays: the user-supplied nine-message export was replayed locally with all network blocked to inspect cleanup and sender-ending outcomes. It retains all nine records and removes exact repeated authored endings where eligible. Unmatched footers/history remain intentionally. The latest 56-message export was also replayed: all records remain, and both reported bubbles retain their new replies without nested history. Classification took about 1.66 seconds for that large capture in one local run. A subsequent 1.0.5 capture was replayed for the Date-header and collapsed-region fixes: 56 records remain; the reported long bubble is reduced but unmatched history remains. The latest 1.0.6 capture also verifies complete removal of the reported bubble’s Outlook-bounded nested history and image controls; its unmatched unmarked signature remains. Earlier exports and screenshots were also inspected for diagnosis. No private email content is included in public fixtures or releases. See CHANGELOG.md.
- Authenticated live Gmail: **not run**. Gmail selectors, internally sized layouts, compose overlays, themes, browser zoom, real clipboard permission behavior and controlled reply arrival remain outstanding. A supplied export replay does not validate these live behaviors.
- Chrome extension installation UI: **not run**. Browser tests load runtime scripts into a routed synthetic page with storage/clipboard test doubles; this is not a claim that the installed extension was exercised in a user's account.
- Fresh dependency install: registry access denied by environment. Tests and ZIP used the existing independently selected development runtime packages; no dependency from an old extension was used.

## Readiness

V1.0 source and local-install ZIP are delivered for owner validation. The specification explicitly permits completing implementation/automated validation when authenticated Gmail is unavailable, while requiring live verification to remain outstanding. **Do not treat synthetic tests as live Gmail certification or final sign-off on all §18 release gates.** Follow the checklist in ACCEPTANCE.md and record any failures before general use.

Machine-readable details: test-results/results.json (local generated artifact). Synthetic visual check: test-results/sidebar.png. Neither enters the runtime release.
