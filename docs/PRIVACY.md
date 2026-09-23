# MailWeave V1.0 privacy, permissions and dependencies

Version: 1.0.30. Processing happens locally in the current Gmail tab. No analytics, telemetry, cloud processing, AI classification, background email indexing, or persistent email storage is implemented.

## Permissions

| Manifest declaration | Reason |
| --- | --- |
| `content_scripts.matches: https://mail.google.com/*` | Read and interact with the current Gmail conversation, reserve page space and open originals |
| `storage` | Save only sidebar width and explicitly supplied aliases in `chrome.storage.local` |
| `clipboardWrite` | Complete the user's explicit Copy raw thread action after asynchronous discovery |

No broad host permissions, cookies, browsing-history, tabs, scripting, webRequest, identity/OAuth, downloads or remote communication permissions are requested. Activation additionally rejects lookalike/non-HTTPS origins and subframes. Gmail itself continues making its normal requests; MailWeave does not control those.

The clipboard export includes email addresses, subject, source HTML and removal evidence. Copying is explicitly initiated; nothing is uploaded or silently saved. The extension never reads the clipboard. Operating-system/browser clipboard history, if enabled by the user, is outside extension control.

HTTPS images on mail.google.com, numbered ci Google image-proxy hosts, and lh3.googleusercontent.com load lazily. This may request data from Google. Other valid HTTP(S) media requires the per-message Load images / media button and may contact the sender’s server. Permission stays in memory for the conversation, survives Refresh, and clears on navigation/account changes. No background hashing or comparison downloads occur. Broken/unusable media has compact text fallback. Audio/video use playback controls without autoplay or preloading. No-referrer is set on media; browser support varies for audio/video. Attachments remain separate.

Closing Chat or navigating discards extension-held message snapshots. Removing the extension deletes its Chrome-managed preferences. Reload Gmail after uninstall to remove previously injected UI from existing tabs.

## Dependencies and licensing

The browser runtime has no third-party library dependencies. All nine runtime files are independently authored and distributed under the root MIT license.

Development-only tools, independently selected:

- Playwright **1.62.1**, **Apache-2.0**: browser acceptance tests in installed Chrome. It is not shipped inside the extension.
- JSZip **3.10.1**, **MIT** option of MIT/GPL dual licensing: deterministic ZIP construction and verification. It is not shipped inside the extension.
- Node.js **24.19.0** (MIT and included third-party notices): local test/build execution environment, not redistributed.

Dependency license texts are available in their installed package directories and upstream packages. The runtime ZIP contains only the runtime allowlist and this project's LICENSE; it excludes tool packages, tests, reports, fixtures, caches and private exports.

The Open automatically checkbox stores one local boolean preference (off by default). It does not store message content.
