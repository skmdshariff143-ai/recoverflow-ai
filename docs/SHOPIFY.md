# RecoverFlow AI — Shopify Commerce Integration Architecture

## 1. Scope & Capabilities
- **OAuth 2.0**: Merchant store connection with granular scopes (`read_checkouts`, `read_orders`, `write_discounts`, `read_products`, `read_inventory`).
- **Webhooks**: `checkouts/create`, `checkouts/update`, `orders/create`, `orders/fulfilled`, `orders/cancelled`.
- **GraphQL Admin API**: Dynamic single-use price rule generation, discount code assignment, and real-time inventory checks.
