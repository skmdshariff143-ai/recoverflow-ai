# RecoverFlow AI — Safety Rules, Stopping Invariants & Quiet Hours

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. Hard Stopping Invariants

RecoverFlow AI evaluates non-negotiable safety rules before any scoring, ranking, or intervention dispatch:

1. **Customer Opt-Out (`opt_out === true`)**:
   Immediately halted (`STOPPED: customer_opted_out`). Zero SMS, email, or retry attempts permitted.
2. **Permanent Account Closure (`failure_category === 'permanent_account_closure'`)**:
   Non-recoverable failure. Immediate halt (`STOPPED: non_recoverable_category`) to prevent wasted gateway retry fees.
3. **Customer Cancellation / Dispute (`failure_category === 'customer_cancellation'`)**:
   Immediate halt (`STOPPED: non_recoverable_category`).
4. **Attempt Limit Cap (`attempt_count >= 3`)**:
   Hard cap at 3 attempts per invoice cycle (`STOPPED: max_attempts_exceeded`).
5. **Quiet-Hours Contact Scheduling**:
   Customer contact windows (e.g. 21:00 to 08:00) are enforced. Contacts outside business hours are scheduled for the next active window (08:00 AM) rather than dispatched immediately.
6. **High-Value Human Review Gate**:
   Transactions $\ge$ ₹10,000 halt in `APPROVAL_REQUIRED` until signed off by an authorized human operator with mandatory notes.
