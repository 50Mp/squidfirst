# Consistent readable bot messages

User requested the supplied order layout for every bot message type. Use a ten-character display suffix from the existing order UUID, without hyphens, while preserving the full database and callback identifiers. This is a display label, not a replacement primary key.

Separate game, player UUID label (the game's existing UID value), game zone, package, price, supplier and Thai status with whitespace and dividers. Remove duplicate game names and mock-player suffixes from mock package labels; preserve the prominent MOCK warning. Resolve known supplier IDs to their store names; do not label a mock supplier as an actual supplier. Keep receipt captions within Telegram's limit and retain the manual-review note.

Apply consistently to new orders, status cards, receipts, view-order results, legacy order-message headers, and customer history summaries/buttons. Preserve full callbacks, ownership, topic routing and actual customer conversation text.
