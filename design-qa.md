# Admin design restoration QA

Source visual truth: `/Users/nexpure/Documents/Codex/2026-10-08/kono/outputs/ticketless-admin-preview.jpg` (1654 × 1222).

Implementation: `outputs/admin-design-restored-desktop.png`, `outputs/admin-design-restored-mobile.png`, `outputs/admin-mail-mobile-fixed.png` in the same task directory. Desktop CSS viewport 1654 × 1222, DPR 1; mobile 390 × 844, DPR 1, full-page capture; landscape 844 × 390. Chrome was used after the in-app browser returned distorted captures despite correct DOM dimensions. Distorted captures were discarded.

State: locally rendered production components with temporary, read-only sample data matching the reference's event and 8/4/4 metrics. All temporary action replacements were restored before the production build and commit. Production records and mail were not modified during QA.

## Findings and comparison history

- Resolved P1: previously deployed admin used a horizontal blue header and Mincho typography instead of the supplied green sidebar design. Restored 210px sidebar, source palette, system/Hiragino sans typography, 14px cards, 34px desktop content gutters, three summary cards, and the three-step workflow.
- Resolved P2: the first mobile mail capture (`admin-mail-mobile.png`) wrapped names vertically and hid table columns behind horizontal scrolling. Converted participant rows into labeled mobile cards; `admin-mail-mobile-fixed.png` confirms readable names, email, ticket, status, and reachable actions.

The reference and desktop implementation were opened together in one comparison input. The headline, sidebar, metric row, step cards, and their text were readable at full size; no additional crop was needed. Full-view composition and the focused card/heading inspection show the original design carried through.

## Required surfaces

- Typography: source system/Hiragino sans stack, 28px title, 18px panel headings, 32px metrics, 10–12px supporting text. Mobile title 24px and metrics 28px. Admin styling is scoped and leaves ticket rendering unchanged.
- Spacing: matching sidebar/content proportions, panel radii and padding, 14px metric gaps and 20px step gaps. Mobile stacks the step cards and uses the source's compact navigation grid.
- Colors: source green #216d50, ink #193c33, background #f5f7f2, border #e3e9e2. Supporting text darkened slightly for legibility.
- Assets: source has no raster imagery. Existing Lucide library supplies standard QR/navigation icons, replacing the prototype's Unicode placeholders.
- Copy: same headline and flow. Production-specific adaptations are explicit: CSV upload replaces paste-only wording; database-backed event selector replaces mock event date/venue; live check-in counts replace the old GAS send quota; new staff/CSV/member navigation remains available. The sample-only banner is absent in production.

## Interactions verified

- Dashboard → mail preparation preserves selected event.
- History → second event participants → CSV upload preserves that event.
- Mail text loads from the selected event; send/save actions are retained but were not executed.
- Desktop, 390px portrait, and 844px landscape have no document horizontal overflow.
- Console error log was empty during local navigation.
- Local lint and production build passed with actual server actions restored.

## Remaining limits

Mobile real-device camera/thermal validation belongs to the scanner rollout, not this admin correction. No production emails or participant deletion were used as tests.

final result: passed
