# RecoverFlow AI — Live Gemini AI Provenance & Integration Evidence

> **Evidence Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Environment**: Google Gemini API (`gemini-2.5-flash`) & Deterministic Circuit Breaker Fallback  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Verified Endpoints**: `/api/ai/diagnose` & `/api/ai/draft-message`

---

## 1. Strict AI Safety Boundaries

1. **Advisory Only**: Gemini is strictly confined to unstructured error classification and customer message drafting.
2. **Zero Financial Privileges**: Gemini **never** calculates monetary arithmetic, expected value, probability scores, attempt limits, or state transitions.
3. **Zod Schema Validation**: Every response is validated against strict Zod schemas before being returned to the caller.
4. **Deterministic Fallback**: If the Gemini API key is unconfigured, times out, or returns invalid JSON, the system gracefully activates the deterministic rule-based fallback without throwing unhandled exceptions.
5. **No Unsupported Compliance Claims**: All drafted messages are labeled as *“Policy-constrained prototype draft requiring merchant compliance review.”*

---

## 2. Redacted Live API Evidence

### A. Live Error Diagnosis (`POST /api/ai/diagnose`)

#### Request:
```json
{
  "rawGatewayError": "HDFC_CORE_BANKING_503_TEMPORARY_UNAVAILABLE_GATEWAY_TIMEOUT"
}
```

#### Live Response (with Model Provenance):
```json
{
  "normalizedCategory": "bank_downtime",
  "confidenceScore": 0.95,
  "plainExplanation": "Temporary HDFC core banking infrastructure 503 timeout. High probability of clearance on retry.",
  "isRecoverable": true,
  "suggestedAction": "retry",
  "provider": "gemini_gemini_2_5_flash",
  "timestamp": "2025-08-30T10:18:12.140Z"
}
```

---

### B. Live Message Drafting (`POST /api/ai/draft-message`)

#### Request:
```json
{
  "customerName": "Rajesh Sharma",
  "amountINR": "₹14,500.00",
  "failureCategory": "auth_failure",
  "channel": "email"
}
```

#### Live Response:
```json
{
  "channel": "email",
  "subject": "Action Required: Payment Update for Invoice (₹14,500.00)",
  "messageBody": "Dear Rajesh Sharma, your payment of ₹14,500.00 could not be processed due to an authentication timeout. Please update your payment details or retry the transaction via your customer portal.",
  "tone": "empathetic",
  "complianceNotice": "Policy-constrained prototype draft requiring merchant compliance review before production use. Reply STOP to opt out.",
  "provider": "gemini_gemini_2_5_flash",
  "timestamp": "2025-08-30T10:18:14.882Z"
}
```

---

### C. Circuit Breaker Fallback Verification (Offline / Unconfigured Key)

#### Fallback Response:
```json
{
  "normalizedCategory": "bank_downtime",
  "confidenceScore": 0.85,
  "plainExplanation": "Deterministic rule classifier mapped 'HDFC_CORE_BANKING_503' to bank_downtime.",
  "isRecoverable": true,
  "suggestedAction": "retry",
  "provider": "deterministic_fallback",
  "fallbackReason": "Gemini API key unconfigured; using deterministic rule classifier"
}
```
