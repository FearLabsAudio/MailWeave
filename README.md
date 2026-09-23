# MailWeave — Conversation Sidebar for Gmail

**V1.0 · extension/package version 1.0.30 · Chrome Manifest V3**

MailWeave turns an open Gmail conversation into a locally processed message sidebar. It preserves authored text, removes evidence-backed signatures and history, links bubbles to their originals, and exports fresh Gmail page data on request.

## Install

1. Extract `release/MailWeave-v1.0.30.zip` into a permanent folder. Alternatively, use this project's `extension` folder directly.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
3. Reload any Gmail tabs that were already open.
4. Open a conversation and select **Chat** near Gmail's upper right. The launcher is hidden on mailbox/search pages without an identifiable conversation.

The ZIP is an unpacked release, not a Chrome Web Store installation package. No build step is required to use the extension.

## Read and control the sidebar

- Select a bubble, or focus it and press Enter/Space, to expand and scroll to the original email. Link clicks and text selection remain separate.
- Drag the left divider to resize. With the divider focused, use Left/Right (20px), Shift+Left/Right (50px), Home (minimum), or End (maximum).
- **Refresh** rereads the conversation. **Close** cancels loading and restores page space. Navigation also closes and cancels the old view.
- **Copy raw thread** copies private, versioned JSON containing current source HTML and discovery evidence. Review it before sharing. It is page data, not MIME/EML or attachment bytes.
- A paperclip identifies attachment UI belonging to that Gmail message. It opens the original; nothing downloads automatically.
- Gmail/recognized Google-proxy HTTPS images load lazily. External media stays blocked until you choose **Load images / media** beneath that message; this may contact the sender’s server. Permission lasts only for the current conversation.
- Set explicit aliases through **Extensions → MailWeave → Details → Extension options**. Close and reopen Chat to apply. The active account is detected from Gmail's account button when available.

On normal desktop screens, Gmail retains at least 480 CSS pixels and Chat at least 300, where space permits. Below 780px the space is split approximately 52%/48%. Both areas remain accessible; Gmail may need horizontal scrolling and a wider window for its own dense controls. Width is clamped after zoom/window changes. The divider and header controls wrap within the sidebar.

## Update, reload, troubleshoot, uninstall

Replace the unpacked files in the same folder, click **Reload** on the extension card, then reload Gmail. This reconnects Chrome storage and installs the latest code. Width and aliases are retained across extension reloads; message content is never saved.

If Chat does not appear, open a single conversation and reload Gmail. If a count/body is missing, expand older history or the original message in Gmail and select Refresh. Counts say **found** when Gmail does not expose a reliable total. Unavailable bodies remain represented with actionable placeholders. Copy raw thread can help diagnose source changes; it contains private data.

If Gmail layout, compose windows, or reply controls misbehave, close Chat to immediately remove the dock stylesheet. Gmail selectors and layouts are not a public API: live integration validation remains required for your account/layout. See `docs/VALIDATION.md`.

If clipboard access fails, keep Gmail focused and retry the explicit copy action. The existing conversation view remains intact. If preferences stop saving after extension reload, reload Gmail.

To uninstall, close Chat, remove MailWeave in `chrome://extensions`, and reload Gmail tabs. Chrome removes extension preferences on uninstall. There are no stored emails to delete.

## Development and verification

Node 24+ and desktop Chrome are used by the test runner. Runtime code has **zero third-party dependencies**.

```text
npm install
npm test
npm run package
node tools/verify-release.mjs
```

The only development dependencies are Playwright 1.62.1 (Apache-2.0) and JSZip 3.10.1 (used under MIT). They are not included in the runtime ZIP. In this workspace, tests/package scripts also resolve the installed Codex runtime packages without installing anything. Set `MAILWEAVE_NODE_MODULES` to another dependency directory if needed. Set `MAILWEAVE_BROWSER=msedge` only for supplementary testing; Chrome is the supported product.

The registry was inaccessible in the implementation environment, so a fresh package-manager install/lockfile could not be verified. Exact direct dependency versions are declared in `package.json`; the supplied release is already built and requires neither npm nor these tools. Packaging checks deterministic byte output with the tested dependency versions.

```text
node tests/run.mjs
node tools/package.mjs
node tools/verify-release.mjs
node tools/report.mjs
```

Tests use only independently authored synthetic messages, route Gmail requests to a generated fixture, and block all other network requests. They do not log in to or read an email account. Results and a synthetic screenshot are written to `test-results/`; no test material enters the release.

See `docs/ARCHITECTURE.md`, `docs/PRIVACY.md`, `docs/VALIDATION.md`, and `docs/ACCEPTANCE.md` for evidence rules, limitations, permissions, coverage, and the live validation checklist.

Own messages are identified by Gmail’s og-profile-acct account metadata and explicitly configured aliases in extension preferences. Matching trims whitespace and lowercases addresses only. If account metadata is unavailable, only configured aliases identify own messages.

Enable **Open automatically** beside Close to open MailWeave whenever you enter a Gmail conversation. The preference is saved locally. Close dismisses it for the current conversation; the next conversation opens automatically.
