# USD conversion and daily ingestion window

User request: display USD converted using LFX, exclusively the 15:00–16:00 quote. User clarified that both collection and updates must also occur only during that daily window. Time zone is Asia/Vientiane (UTC+07, same local wall clock as Bangkok). API reads remain available all day.

Use the public Final data endpoint embedded by the LFX home-page widget; select exactly one USD row with Time 15:00–16:00. Never use another hour, another currency, or daily RATE fallback. Store the reference quote separately from original LAK package prices, with source URL, data URL, raw row and fetched timestamp. Source has no publication date: preserve null and expose that limitation, never fabricate today's date.

Default package responses display USD with original LAK fields retained. Use integer arithmetic and half-up rounding to two decimals. If no valid stored quote is available, USD price is null with an explicit unavailable status. Historical valid fetched quotes may be reused with their retrieval age and unknown publication date visible. currency=LAK remains supported.

Daily window is [15:00:00,16:00:00). Check before any fetch and before saving; abort in-flight HTTP/browser operations at closing time. Outside the window, worker waits until the next opening. CLI sync commands obey the same rules without override. Poll every 15 minutes inside the window; server schedules without making requests outside it. Server starts locally now to serve stored packages; no out-of-window quote is imported for convenience.

Tests cover schedule boundaries and next opening, selection/rejection of ambiguous rate rows, exact decimal conversion, source quote persistence, API no-rate/available-rate behavior, and outside-window ingestion without external calls.
