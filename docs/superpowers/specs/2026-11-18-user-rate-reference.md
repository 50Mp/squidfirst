# User-provided USD reference

User explicitly supplied a screenshot and asked to calculate using its 15:00–16:00 quote: 1 USD = 22,688.45 LAK. Apply that reference now, without waiting for an automated fetch. The displayed -0.39% is a change indicator, not an extra discount or conversion fee.

Persist user-supplied quotes separately from automatic FX ingestion. Record provenance=user_provided, evidence file, provided_at, fetched_at=null and published_date=null. Do not falsely date the screenshot or claim a network fetch in the permitted window. The newest supplied or automatically collected reference is selected, so a later valid scheduled quote replaces this bootstrap reference. Preserve original package prices and all existing automated ingestion window checks.

Verification: regression test covers outside-window user reference, USD API conversion, original LAK preservation, automatic write rejection outside window, and later scheduled quote superseding the supplied reference.
