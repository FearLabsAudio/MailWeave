import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const result = JSON.parse(await fs.readFile(path.join(root, 'test-results/results.json')));
const fmt = n => Number(n || 0).toFixed(2);
const passed = result.results.filter(r => r.status === 'pass').length;
const rows = result.performance.filter(r => r.messages).map(r => `| ${r.messages} | ${fmt(r.discoveryMs)} | ${fmt(r.expansionWaitMs)} | ${fmt(r.classificationMs)} | ${fmt(r.endingComparisonMs)} | ${fmt(r.sanitizeMs)} | ${fmt(r.renderMs)} | ${fmt(r.totalMs)} |`).join('\n');
const quotes = result.performance.filter(r => r.nestedQuoteDepth).map(r => `- ${r.nestedQuoteDepth} nested quotes: ${fmt(r.totalMs)} ms`).join('\n');
const text = `# MailWeave V1.0 validation report

Version **${result.version}**. Generated from the recorded browser run at **${result.time}**.

**${passed}/${result.results.length} browser test groups passed.** Numbered mappings are in ACCEPTANCE.md. Runtime ZIP verification separately checks the exact allowlist, JavaScript syntax, manifest/package versions, and byte-identical rebuilds.

## Environment

- ${result.environment.os}
- CPU: ${result.environment.cpu}
- Node ${result.environment.node}; Chrome ${result.environment.browser}, headless
- Playwright 1.62.1; JSZip 3.10.1 from the installed development runtime
- Browser fixture: 1440 × 1000 CSS px; narrow-layout check at 560 × 800
- Generic DOM-only messages; populated hidden bodies; all external network blocked

## Measured stage timings

Milliseconds, one recorded run, not a statistical benchmark. Total includes additional discovery/final reconciliation and view construction, so individual columns need not sum to total. Fixtures are deliberately small; these results do not establish the proposed live Gmail 1-second/2-second targets.

| Messages | Discovery | Expansion wait | Classification | Ending comparison | Sanitize | Render | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

Nested quote cleanup, one synthetic message:

${quotes}

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
`;
await fs.writeFile(path.join(root, 'docs/VALIDATION.md'), text);
console.log('Wrote docs/VALIDATION.md');
