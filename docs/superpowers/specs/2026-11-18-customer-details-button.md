# Customer details from the permanent chat room

Customer clarification: contact support opens the existing account chat, without inserting an order number. Show this support entry on orders with a problem. The customer storefront has not been built yet; retain this as its UI requirement. Existing chat messages already require no order context.

Every incoming customer message in its Telegram topic gets an admin-only customer-details button. It shows account identity/status, order counts, and defaults to the issue-orders tab. An all-orders tab exposes the customer's complete history in pages of five; each order can be opened with the existing view-order control. Restrict the profile callback to the configured private admin and that account's mapped topic. Profile views do not enter the customer's conversation. Select only business/account fields, never authentication secrets.

User clarification: customer details must cover every order and every order status. Include an all-status count breakdown covering the complete history, independently of the selected tab/page. The all-orders tab is not limited to problem orders.

Validation covers filtering by customer, issue/all tabs, account field selection, wrong-user and wrong-topic callbacks, unchanged customer conversation content, and the details button on outgoing topic messages.
