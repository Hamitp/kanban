# Akış v3.0.0 — English and multi-currency support

## What is new

- A bilingual first-launch screen lets you choose Türkçe or English before entering the app.
- The interface can be switched at any time under Settings → Language and region.
- New installations receive sample content in the selected language; existing user content is never renamed or translated automatically.
- Every project can independently use TRY, USD, EUR, or GBP.
- Settings includes a default currency for newly created projects, independent of interface language.
- Portfolio cards and monthly cash-flow charts keep different currencies in separate totals. Akış does not calculate fictional exchange-rate totals.
- A project's currency is locked after payments exist, protecting the integrity of its payment history.
- Dates, money, task durations, accessibility labels, Kanban controls, mind-map controls, modals, and insights follow the selected language.

## Data safety

Existing v2 workspace stores migrate automatically to the v3 container. Projects without an explicit currency remain in TRY, matching earlier behavior. Workspaces, projects, boards, tasks, mind maps, people, payments, archive state, and backups remain in place.
