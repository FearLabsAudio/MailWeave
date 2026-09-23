# Changes

## 1.0.30 — September 18, 2026

- Remove the descendant-wide Gmail .nH max-width override that could widen the left navigation and displace its labels. Keep the outer layout reservation.
- Browser regression reproduces the old rule widening a capped navigation rail; verifies unchanged width/label positions during open, resize and close, with the main content remaining beside the sidebar.

## 1.0.29 — September 18, 2026

- Remove the experimental quick-reply system completely and restore the pre-reply conversation viewer. Remove native composer automation, reply preferences/UI, diagnostics, API proof and experimental release packages.
- Preserve the later cleanup fix that removes a flattened signature only when its marked tail exactly matches a prior explicit signature, including image URLs.

## 1.0.20 — September 17, 2026

- Recognize an attribution-only On … wrote block with a matching mailto address immediately before a blockquote when forwarding stripped Gmail’s attribution class. Remove that bounded history including nested footer media. Preserve images and replies outside it.
- Latest private capture replay confirms the reported Bridget bubble retains only its new reply. Added regression coverage including a mismatched sender link that must not authorize removal.

## 1.0.19 — September 17, 2026

- Move Copy raw thread from the top toolbar to a compact 19px-high button on the footer’s right. Adjust vertical padding to retain the existing footer height at normal widths.

## 1.0.18 — September 17, 2026

- Explicitly scroll the first nonempty conversation render to the newest message after layout. Constrain the feed to its available height. Later refreshes retain the existing scroll-position behavior.

## 1.0.17 — September 17, 2026

- Position the floating fallback 24px from viewport right/bottom. With the sidebar open, keep it visible 16px left of the divider, following sidebar and viewport resizing. Clamp its width to the remaining Gmail area.
- Use compact green/white styling with keyboard focus indication; disable activation and show Loading during processing. Closing restores the bottom-right position. The existing side-by-side layout does not use a vertical split. Header placement is unchanged.

## 1.0.16 — September 17, 2026

- Place Chat in Gmail’s header controls immediately before the Google apps selector group. Reattach after header replacement. If the header cannot be recognized, use a bottom-right fallback instead of overlapping the message toolbar.
- Browser regression covers header placement, replacement, activation and fallback. Live Gmail header verification remains outstanding.

## 1.0.15 — September 17, 2026

- Add a saved Open automatically checkbox after Close. When enabled, open the sidebar on Gmail conversations, including the current conversation after page load. Manual Close keeps it closed until the next conversation; mailbox views do not open it. Default is off.

## 1.0.14 — September 17, 2026

- Replace the attachment emoji with a simple monochrome outline paperclip. Keep the attachment control to the right of both incoming and own bubbles; outgoing bubble/control groups remain right-aligned.

## 1.0.13 — September 17, 2026

- Remove the redundant Processed on this device label from the sidebar footer.

## 1.0.12 — September 17, 2026

- Remove the Conversation heading from the sidebar header.

## 1.0.11 — September 17, 2026

- Preserve authored image/audio/video as sanitized media descriptors. Auto-load only allowlisted Google HTTPS images; gate other valid HTTP(S) media with one per-message control. Invalid URLs remain unavailable.
- Keep permissions in conversation memory across Refresh and sidebar reopen; clear on conversation/account changes. Media loading never reintroduces removed regions or downloads attachments.
- Add lazy responsive images, compact errors/blocked alternatives, no-referrer attributes, and audio/video controls with preload disabled. Add host, URL, per-message permission, fallback and sanitization regressions.

## 1.0.10 — September 17, 2026

- Trace Gmail’s external clipping notice back to the final source text before cleanup. Clipping inside a quoted block no longer disqualifies complete authored endings. Exclude the clipping UI from authored suffix comparison; genuinely clipped authored text remains protected.
- Replay of the latest 56-message capture removes exact repeated signatures and disclaimers from all four Accounts Payable replies while retaining their different authored text. Quoted sender-warning banners can still remain. No footer phrase or contact-pattern guesses were added.
- Added regressions for external clipping notices after quoted history versus authored text.

## 1.0.9 — September 17, 2026

- Remove “This is me” and its preference-writing callback. Read the current account only from head meta[name="og-profile-acct"]. Own-message matching uses this address plus explicitly configured aliases, trimmed and lowercased without dot or plus normalization.
- Observe account metadata changes/removal and reset the open sidebar identity; refresh reads identity anew and rejects a render if it changes during processing. Conversation navigation clears the old view. Missing metadata uses aliases only.
- Browser coverage includes missing/spoofed metadata, exact aliases, distinct dots/plus suffixes, account switching/removal, and full-width left/right bubble geometry.

## 1.0.8 — September 17, 2026

- Remove all incoming participant indentation and explicitly make rows full width. Selected self bubbles align to the right content edge, including attachments; text stays left-aligned.
- Label recognized self messages “You” and replace the non-self teal palette entry to avoid confusing it with self green. A visible “This is me” means the sender has not yet been selected.
- Added geometry coverage across six incoming senders and outgoing bubbles with/without attachments.

## 1.0.7 — September 17, 2026

- Remove Outlook’s explicitly bounded mail-editor-reference-message-container, including nested history, media and disclaimers. Recognize exact client-prefixed Signature IDs. Preserve authored content outside those containers.
- Remove Gmail image-action overlays before comparison. Correct clipping detection: a6S/a6T are image UI, not clipping markers; use Gmail full-message links. Replay cleanup also handles legacy false-positive clipping flags conservatively.
- 44 browser groups pass. The latest private capture replay removes the reported bubble’s entire nested chain and Gmail image controls. Its unique unmarked signature remains; no footer wording or visual heuristics were added.

## 1.0.6 — September 17, 2026

- Add “This is me” on other senders to explicitly save a local address alias and immediately right-align its messages. Fix account detection skipping empty controls, accept account titles, exclude message-body links, and decline ambiguous accounts.
- Recognize structured Date reply headers as well as Sent. Compare whole repeated blocks inside Gmail toggle-associated collapsed-content regions, preserving unmatched inline replies. No new footer heuristics.
- 42 browser test groups pass, including identity-selection geometry with attachments and preservation of unknown inline replies. The latest supplied 56-message export retains all records. Cleanup reduces the reported long bubble but does not remove all unmatched history; this is a partial cleanup improvement, not a claim of complete removal.

## 1.0.5 — September 17, 2026

- Keep the active user’s bubbles flush right, with attachment controls on their left and text left-aligned. Row placement stays consistent in RTL page layouts. Identity uses Gmail’s account address and explicitly configured aliases.

## 1.0.4 — September 17, 2026

- Recognize explicit Gmail/Mozilla quote attribution nested at the end of an adjacent display wrapper. Remove only the attribution and its bounded blockquote; preserve surrounding authored replies. Authored text following an attribution prevents pairing.
- Added two regression groups for wrapped attribution and ambiguous neighboring content; all 39 groups pass. No new footer classification rules.
- Locally replayed the supplied 56-message export with networking blocked. Both reported bubbles retain their new replies without nested history; all 56 message records remain. Private capture content is excluded from fixtures and releases.

## 1.0.3 — September 17, 2026

- Exact repeated endings now compare the authored region separately from recognized Outlook history, including Gmail-prefixed reply-header IDs. Sender addresses are normalized; different senders, single-use endings, unmatched versions, nonterminal text, clipped authorship, signature-only contributions and whole-message repeats are preserved.
- Added logical BR-line comparison while preserving inline emphasis and links. Matches require differing authored prefixes and exact terminal units; no footer phrases, contact/name/domain rules, styling cues, fuzzy comparisons or template/font markers classify footers.
- Recognize explicit, Gmail-prefixed Outlook mobile signature containers. Reconstructed/split reply metadata is removed only with complete structural field evidence. Matching prior content in established quote context is removed conservatively; unmatched material remains.
- Remove artificial table borders, flatten explicit presentation-table layout, compact empty breaks, and exclude Gmail's empty quote-toggle UI from copied bodies.
- Select Gmail date metadata rather than arbitrary titled attachment nodes.
- 37 automated test groups plus local replay of the user-supplied nine-message export. Some unmarked signature and forwarded-history material remains because it lacks the required exact evidence. No claim that every screenshot footer was removed.

## 1.0.2 — September 17, 2026

- Added standalone `.kv` collapsed rows, which need not contain `.h7`, `.adn`, provider IDs or a body until expanded.
- Added a sender-and-date header fallback for unfamiliar row wrappers, excluding message bodies, drafts, dialogs and menus.
- Prefer an available message-header control before clicking the collapsed row itself. Preserve source order and identity when expansion replaces the row.
- Raw exports now include sender-header ancestry even for headers not recognized as rows; previous exports only described successfully discovered rows.
- Sidebar brand shows the exact extension version. Added two regression groups; all 32 groups pass.

The user's screenshots confirm seven real Gmail messages, six collapsed and one expanded. The earlier suggestion that all seven were quoted history was incorrect. Screenshots establish the missing-row symptom but do not expose DOM classes; the changed adapter is tested synthetically, with the user's live recheck still outstanding.

## 1.0.1 — September 17, 2026

- Discover collapsed `.h7` message rows even before Gmail provides a body, `.adn` wrapper or message ID.
- Expand `.aju`/`.ady` message headers and `.adv` older-message groups; retain a single identity when expanded wrappers appear.
- Add conversation-scoped row structure diagnostics to explicit raw exports.
- Add synthetic seven-message regressions for six collapsed rows plus the newest expanded message, and for grouped older history. All 30 browser test groups pass.

The user-supplied 1.0.0 export confirmed discovery of only one loaded row, zero recognized groups and no reliable total. It contained only that row's body, so it cannot establish the exact markup of the six missing rows. These fixes address uncovered discovery gaps; the affected live conversation still requires rechecking. No private email content was copied into fixtures or release files.
