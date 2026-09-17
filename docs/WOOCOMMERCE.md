# RecoverFlow AI — WooCommerce Adapter & Commerce Normalization

## 1. Overview
The WooCommerce integration normalizes cart, order, and customer entities into standard RecoverFlow commerce events:
- Ingestion: REST API v3 webhook receivers (`order.created`, `order.updated`).
- Normalization: Maps WooCommerce order metadata into unified `Payment` and `PaymentFailure` records.
- Action: Dispatches localized payment rescue links and coupon incentives via REST API.
