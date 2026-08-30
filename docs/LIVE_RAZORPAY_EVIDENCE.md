# RecoverFlow AI — Razorpay Test-Mode Integration Evidence

> **Document Status**: Live integration verification pending preview execution capture.  
> **Source Implementation**: `src/lib/adapters/recoveryAdapter.ts`, `src/app/api/recovery/execute/route.ts`, `src/app/api/recovery/webhook/route.ts`  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)

---

## Current Status

Live integration not yet verified on this branch. Source implementation and mocked tests are available. Verified captures will be recorded via live HTTP execution against the deployed preview environment during release validation.

### Source Validation Invariants:
1. **Live Key Prohibition**: Any key starting with `rzp_live_*` throws an immediate security exception.
2. **Payment-Link Creation Accounting**: Creation of a payment link creates a test payment object with status `test_link_created` and records ₹0.00 recovered money.
3. **Webhook Verification**: Webhook verification fails closed if `RAZORPAY_WEBHOOK_SECRET` is not explicitly configured in environment variables.
