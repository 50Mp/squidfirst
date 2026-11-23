# USD window implementation plan

Goal: convert catalog API prices to USD with LFX 15–16 quote and restrict all live ingestion to that daily local time window.

Spec: ../specs/2026-11-18-usd-window-design.md

- [x] Add failing tests for schedule, LFX row validation and decimal conversion.
- [x] Implement schedule.ts and fx.ts; validate source response strictly and retain provenance.
- [x] Add FX table/repository methods, API currency selection and exchange-rate endpoint; test stored rates and missing rates.
- [x] Gate CLI/worker scraping, abort at deadline, poll every 15 minutes, and enforce window again before write.
- [x] Run tests, typecheck, build, independent review and HTTP verification. Update README and restart API. Do not bypass the time window for live verification.

Verification: 16 tests passed, typecheck/build passed. CLI shop sync and FX sync skipped outside window without external collection. Independent review found delayed-write boundary gaps: FX now uses guarded transaction; catalog final guard moved after final SQL update. A regression test reproduced the catalog gap and now verifies rollback of both shop and FX writes when database work crosses 16:00. API restarted and waiting for 2026-11-18 15:00 local; no production rate imported out of window. Formula tested against fixtures; live scheduled ingestion of LFX remains pending its first permitted time window. Existing 237 package records retained.
