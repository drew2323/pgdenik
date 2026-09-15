# PG Deník — design system

Reading comes first: a warm off-white paper, dark green-black text and one restrained teal accent keep long technical notes calm. System sans-serif is used for navigation and headings; a system serif gives articles a comfortable, book-like rhythm without external font requests.

The desktop navigation is a fixed 304 px tree with a visible active-page rail and nested hierarchy. Below 800 px it becomes a labelled modal-style drawer with scrim, Escape dismissal and immediate focus. Focus uses a distinct orange outline, motion is limited to the drawer and disabled for reduced-motion users.

Articles top out at 48 rem, use fluid headings and generous vertical rhythm. Managed images retain their intrinsic ratio and captions; YouTube and XCvid are allowlisted 16:9 frames. E2E captures real Chromium screenshots at 1440×1000 and 390×844 into Playwright test artifacts.
