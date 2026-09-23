# MailWeave V1.0 architecture and decisions

Version: 1.0.30. This is an independent implementation of `CLEAN_ROOM_REQUIREMENTS.md`. Only that specification was supplied at the start; no prior extension source, artifacts, fixtures, or lockfile were consulted.

## Components

| File | Responsibility |
| --- | --- |
| `core.js` | Version, lifecycle cancellation, preferences, identity continuity, participant colors, export schema |
| `source.js` | Gmail-only discovery, ownership, expansion, bounded reconciliation, original navigation |
| `clean.js` | Inert copied-HTML parsing, evidence-backed classification, sender-ending comparison, allowlist reconstruction |
| `view.js` | Shadow-root sidebar, reversible document layout reservation, resize, rendering and keyboard interaction |
| `app.js` | Conversation lifecycle, commit cancellation, observers, fresh export, refresh notices |
| `options.*` | Explicit aliases stored in local extension preferences |

Classic scripts run in manifest order in Chrome's isolated world. There is no service worker, injected main-world code, dynamic evaluation, Gmail API, OAuth grant, network interception, background scan, or remote service. Only the currently open conversation is read. Emails are inert data.

## Discovery and ownership

The adapter identifies a visible Gmail `role=main` containing a subject `.hP` and message rows. Collapsed `.h7` rows and provider row wrappers (`.adn`, `data-message-id`, `data-legacy-message-id`) are considered only outside `.a3s` message bodies. Nested wrappers contribute identities to their owning row instead of becoming extra records. Collapsed `.aju`/`.ady` headers and `.adv` older-history controls are supported. Source order is authoritative. Identical bodies or timestamps do not deduplicate rows.

All populated bodies are read, including hidden bodies. An empty collapsed placeholder is not loaded; an expanded, present, empty body is distinguishable. Snippets never substitute for bodies. Genuine attachment metadata comes only from Gmail's `.aQH` attachment UI outside authored content. Message-like body markup and quoted attachment-like markup cannot create rows or paperclips.

Gmail header/group controls expand missing rows/bodies. Loading allows up to 40 passes and a shared 8-second expansion-wait budget per refresh, plus actual processing time. Cached bodies take no intentional per-message wait. Discovery runs after yields; the controller reconciles again after cleanup before rendering. Unavailable bodies remain records. No universal total is invented: consistent row `aria-setsize` supplies a total when present; otherwise the UI reports found/loaded counts and export completeness is unconfirmed.

Provider identifiers and live node continuity take precedence. Occurrence-aware sender/time continuity handles replacements; replacement of nonempty provider identities through metadata is permitted only at the same ordinal with an unchanged row count. Temporary identities alone never prove a reply. A new provider-identified row beyond the surviving displayed tail establishes the refresh notice when no history was pending. Earlier/middle additions and newly available bodies reconcile automatically. Appearance/style/image changes do not define messages. An outstanding reply notice is not absorbed by automatic reconciliation.

## Cleanup evidence

All transformations operate on detached template-parsed copies. Original Gmail message bodies are unchanged.

| Evidence | Transformation |
| --- | --- |
| Explicit Gmail/Mozilla/Outlook mobile signature container | Remove that bounded container, accepting Gmail's rewritten ID prefixes |
| `blockquote[type=cite]` or a blockquote paired with Gmail/Mozilla attribution (direct or at the end of an adjacent display wrapper) | Remove the bounded quote and paired attribution |
| Exact prior message in a blockquote | Remove that quoted region |
| Outlook `divRplyFwdMsg`, including Gmail-prefixed IDs; complete structured From/Sent/To/Subject header | Remove bounded header metadata; remove exact known prior content within established quote context, retain unknown following text |
| Exact prior text in Gmail/Yahoo quote context | Remove the matching whole node, preserve unmatched content |
| Exact terminal units from two distinct messages with verified same sender | Remove shared terminal units only when authored prefixes differ; preserve complete repeated messages and potential signature-only contributions |
| Empty layout or unsafe active content | Compact empty debris, reconstruct safe formatting, remove active HTML |

Removal records retain the category, a bounded text excerpt, and media count when relevant. Raw source remains available in exports. All evidence remains in memory until close/navigation.

Sender comparisons are thread-local, normalized for insignificant whitespace, and exact. Table boundaries and preformatted whitespace remain significant. A reverse trie indexes terminal runs. Clipped authored regions are ineligible. Clipping inside a bounded quote does not disqualify a complete authored region. Different footer versions can form separate exact groups. Media is removed only inside a proven removed region; nearby authored media is preserved for sanitized rendering.

Comparison operates on the authored region before recognized quote metadata, not on the end of the entire raw message including history. BR-separated logical lines are split on the detached copy while keeping their inline formatting. Unmatched quote content is excluded from signature comparison but retained in the display. Matching uses verified normalized sender addresses, never names, domains, jobs, contact fields, font/template markers or phrase heuristics. No footer database or cross-thread matching is introduced.

## Security boundary

The sanitizer reconstructs allowed semantic nodes and a small attribute allowlist. It drops all original style, classes, IDs, event handlers, form/active/embed content, and unsafe URLs. Source IDs and extension-like labels cannot become executable controls. Allowed links are HTTP(S), mailto and tel with opener/referrer protections. Media is first serialized into inert descriptors with validated HTTP(S) sources; the view creates sanitized media elements under the loading policy. Source styles, srcset, poster, event handlers and unsafe schemes are discarded.

The shadow root isolates extension styling from email formatting. Email markup cannot leave its `.body` wrapper or become a sibling of extension controls. The only page event accepted from another isolated instance is teardown; it cannot trigger reading, export, storage, or privileged recovery. No externally connectable messaging endpoints exist. Startup separately verifies the exact HTTPS Gmail origin and top frame.

## Dock and lifecycle

A fixed right-hand panel is paired with a removable stylesheet reserving body width and constraining Gmail's internally sized `.nH`/main boxes. Gmail message nodes are never moved. This page-dock choice allows explicit keyboard resizing and preference persistence without additional Chrome permissions. Body margins are included in width accounting. Both pointer and keyboard resizing update reservation and panel together. Bubble widths use a continuous sidebar-width-based ratio, reaching 66% at 800px.

The controller owns observers, listeners, AbortControllers, and DOM nodes. Close, navigation and reinjection abort jobs, restore highlighting, remove reservation, and discard message memory. Rendering is atomic after cancellable fragment construction. Rendering/cleaning yield between messages after roughly 12ms of work; a loading frame precedes expensive work. Scroll anchoring uses the previously visible record or follows the bottom.

## Deliberate limitations and unresolved integration risks

- Gmail markup is undocumented and can vary. Group/header, account, clipping and attachment selectors need confirmation on the owner's actual Workspace/Gmail layouts. An unknown selector produces retained/unavailable content, not fabricated MIME data.
- No authenticated Gmail session was used. User-supplied exports were inspected and the nine-message and 56-message exports were replayed locally with networking blocked. Neither those replays nor synthetic geometry checks establish that every live Gmail internally sized container, compose overlay, or browser zoom state reflows correctly. This remains a release-readiness gate.
- With no trustworthy total or recognized group control, history not represented in the page cannot be proven complete. A provider-identified late row appended beyond the tail can be indistinguishable from a new reply if Gmail exposes no older-history evidence. This ambiguity requires live validation; the implementation does not use body mutation as a substitute signal.
- Name-only senders remain separate identities and cannot establish repeated-ending evidence. Explicit aliases are required if the account button is unavailable or a sender uses another address.
- Outlook history with unknown/unbounded layout, localized unrecognized headers, an unmarked single-use footer, authored “Subject:” text, billing/contact sentences, and intentional quotations remain visible. No footer phrases, domain guesses, fuzzy matching or model classifiers are used.
- HTTPS images on mail.google.com, numbered ci Google image-proxy hosts, and lh3.googleusercontent.com load lazily. This may request data from Google. Other valid HTTP(S) media requires the per-message Load images / media button and may contact the sender’s server. Permission stays in memory for the conversation, survives Refresh, and clears on navigation/account changes. No background hashing or comparison downloads occur. Broken/unusable media has compact text fallback. Audio/video use playback controls without autoplay or preloading. No-referrer is set on media; browser support varies for audio/video. Attachments remain separate.
- Very large single messages can exceed a frame budget during browser HTML parsing or sanitization. Per-message failures are isolated; ordinary multirecord workloads yield. No universal performance guarantee is made.
- On very narrow screens Gmail's own controls may require horizontal scrolling. The supported environment is desktop Chrome; a wider window provides the intended side-by-side reading experience.

## Platform references consulted

- [Chrome content scripts and isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome manifest format](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Chrome permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

Accessed September 17, 2026. These document platform behavior; they do not document or guarantee Gmail DOM selectors.

Account ownership uses only head meta[name="og-profile-acct"] plus configured aliases, normalized by trimming and lowercasing. Message sender comes from Gmail header metadata outside the body. Account metadata mutations clear the active view and identity; refresh re-reads identity and verifies it before/after render. No account-button, display-name, domain, dot-removal or plus-removal inference is used.
