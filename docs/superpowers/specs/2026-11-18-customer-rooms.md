# Customer-account chat rooms; order controls remain internal

Correction from user: 1 customer = 1 chat room, unrelated to individual orders. Website checkout remains separate. Telegram order buttons (complete, view order, issue, etc.) are admin tools; customers see changed order state on the website, never chat bubbles containing those controls or status events. User confirmed login is required so a customer returns to the same room across devices.

Add username/password customer accounts, hashed passwords and opaque expiring sessions. One room per account, durable customer/admin text history. Authorization requires a logged-in customer owning the room/order. Admin text inside a mapped Telegram customer topic becomes public chat; /note is internal. General private admin chat remains administrative and is never relayed. Order notifications and controls stay outside customer topics. No customer Telegram account is required.

Private-chat Topics are currently disabled on the existing bot. Ask user to enable via BotFather; never silently use one shared room as a substitute. Creating or reusing a topic requires a durable account-room mapping; topic creation retries must not create duplicate rooms. When topic creation outcome is ambiguous, mark as needing attention rather than blindly create another.

No email addresses are collected or implied verified. Username/password registration is the initial local identity model; recovery/verification and customer UI are not implemented here. Password policy >=12 and <=128 characters, scrypt hashing with per-account salt. Sessions expire in 30 days and can be logged out. Customer authentication APIs are rate limited.
