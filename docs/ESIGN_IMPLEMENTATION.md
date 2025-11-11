# eSign Integration - Production Implementation Guide

## Overview

This document describes the production-ready eSign integration for digital signature capture on Risk Declaration documents for Accredited Investor verification.

## Provider Selection: eMudhra

After comprehensive research of both eMudhra and NSDL eSign services, **eMudhra was chosen** as the recommended provider for the following reasons:

### Why eMudhra?

✅ **Modern REST API Architecture**
- RESTful API with Swagger/OpenAPI documentation
- JSON request/response format (vs XML-based NSDL)
- Easy integration with modern web applications

✅ **Superior Documentation**
- Comprehensive developer portal: https://developers.emsigner.com/
- API documentation: https://devemca.emudhra.com/eSign.html
- Sandbox environment: https://esign.sandbox.emudhra.com/
- Postman collections available

✅ **Simpler Integration**
- Only 2 API calls required to get started
- Straightforward authentication using auth tokens
- Built-in webhook support for async notifications

✅ **Better Developer Experience**
- 24×7 API support team
- Faster onboarding process
- Modern cloud infrastructure (geo-redundant)

✅ **Compliance & Security**
- ISO 27001, SOC2 Type 2 certified
- Legally valid under IT Act 2000 (India)
- Licensed Certifying Authority under Ministry of IT

### Comparison with NSDL

| Feature | eMudhra | NSDL |
|---------|---------|------|
| API Type | REST/JSON | XML-based |
| Documentation | Excellent | Good |
| Integration Complexity | Low (2 API calls) | High (XML structure) |
| Sandbox | Yes | Limited |
| Developer Portal | Yes | No |
| Onboarding | Direct ASP | ASP or third-party |

## Architecture

### Flow Diagram

```
User Request → Backend API → eMudhra API → Aadhaar Auth (OTP) → Digital Signature
                    ↓                                                      ↓
              Database Update ← Webhook Callback ←────────────────────────┘
```

### Components

1. **eSign Service** (`server/services/esign-service.ts`)
   - Core integration logic
   - API client for eMudhra
   - Error handling and logging
   - Webhook processing

2. **API Routes** (`server/routes.ts`)
   - `POST /api/esign/webhook` - Handle eMudhra callbacks
   - `GET /api/esign/status/:transactionId` - Poll signing status

3. **Database Integration**
   - Updates `accreditedInvestorVerifications` table
   - Stores transaction IDs, status, and signed document URLs

## Configuration

### Environment Variables

Add these to your `.env` file or Replit Secrets:

```bash
# eSign Configuration
ESIGN_MODE=simulation                    # or "production"
ESIGN_PROVIDER=emudhra                   # Recommended provider

# eMudhra Credentials (obtain from eMudhra)
EMUDHRA_API_URL=https://api.emsigner.com/v1
EMUDHRA_SYSTEM_ID=your_system_id
EMUDHRA_AUTH_TOKEN=your_auth_token
EMUDHRA_UNIQUE_ID=SYSTEM_ID+EMAIL        # Format: SYSTEMID + your@email.com

# Webhook Configuration
ESIGN_WEBHOOK_SECRET=generate_strong_random_string
ESIGN_CALLBACK_URL=https://yourapp.com/api/esign/webhook
```

### Getting eMudhra Credentials

1. **Register as ASP (Application Service Provider)**
   - Visit: https://www.emudhra.com/
   - Contact sales for ASP registration
   - Submit required documents (company details, use case)

2. **Access Developer Portal**
   - Login to: https://developers.emsigner.com/
   - Generate System ID and Auth Token
   - Create Unique ID: `SYSTEM_ID` + `your_email@company.com`

3. **Test in Sandbox**
   - Use sandbox URL: https://esign.sandbox.emudhra.com/
   - Test with dummy Aadhaar numbers (provided by eMudhra)
   - Verify webhook callbacks work

4. **Go Live**
   - Complete ISA audit checklist
   - Switch to production URL
   - Update `ESIGN_MODE=production`

## API Integration

### 1. Initiate eSign Request

```typescript
import { initiateESign } from "./services/esign-service";

const response = await initiateESign({
  userId: "user123",
  verificationId: "verification456",
  documentType: "risk_declaration",
  documentUrl: "https://yourapp.com/docs/risk_declaration.pdf",
  signerDetails: {
    fullName: "John Doe",
    email: "john@example.com",
    mobile: "+919876543210",
    panNumber: "ABCDE1234F",
    aadharNumber: "1234-5678-9012",
  },
  returnUrl: "https://yourapp.com/esign/complete",
});

if (response.success) {
  // Redirect user to signing portal
  window.location.href = response.redirectUrl;
}
```

### 2. Handle Webhook Callback

The webhook endpoint automatically processes callbacks from eMudhra:

**Endpoint:** `POST /api/esign/webhook`

**Headers:**
- `X-eSign-Signature`: HMAC-SHA256 signature for validation

**Payload:**
```json
{
  "transactionId": "ESIGN-1699876543-ABC123",
  "status": "completed",
  "signedDocumentUrl": "https://emudhra.com/signed/doc123.pdf",
  "certificate": {
    "issuer": "eMudhra CA",
    "serialNumber": "123456789",
    "validFrom": "2024-01-01T00:00:00Z",
    "validUntil": "2025-01-01T00:00:00Z"
  }
}
```

### 3. Poll for Status

If webhooks fail, use polling:

```typescript
import { checkESignStatus } from "./services/esign-service";

const status = await checkESignStatus("ESIGN-1699876543-ABC123", "emudhra");

console.log(status.status); // "pending" | "completed" | "failed" | "expired"
```

### 4. Download Signed Document

```typescript
import { downloadSignedDocument } from "./services/esign-service";

const result = await downloadSignedDocument(signedDocumentUrl);

if (result.success) {
  // Save PDF buffer to storage
  await saveToStorage(result.pdfBuffer);
}
```

## Error Handling

### User-Friendly Error Messages

All eMudhra error codes are mapped to user-friendly messages:

| Error Code | User Message |
|------------|--------------|
| `AUTH_FAILED` | Authentication failed. Please contact support. |
| `INVALID_AADHAAR` | Invalid Aadhaar number. Please verify and try again. |
| `OTP_EXPIRED` | OTP has expired. Please request a new one. |
| `OTP_INVALID` | Invalid OTP. Please check and try again. |
| `SESSION_EXPIRED` | Signing session has expired. Please start a new signing request. |
| `USER_CANCELLED` | Signing process was cancelled by user. |
| `AADHAAR_NOT_LINKED` | Mobile number not linked with Aadhaar. Please link your mobile number. |
| `RATE_LIMIT_EXCEEDED` | Too many requests. Please wait and try again. |

### Error Logging

All errors are logged with sensitive data redacted:

```typescript
// Before logging
{
  aadharNumber: "1234-5678-9012",
  otp: "123456"
}

// After sanitization
{
  aadharNumber: "***REDACTED***",
  otp: "***REDACTED***"
}
```

## Security Features

### 1. Data Sanitization
- All Aadhaar numbers, OTPs, and auth tokens are redacted in logs
- Only transaction IDs and status are logged

### 2. Webhook Signature Validation
- HMAC-SHA256 signature verification
- Prevents unauthorized webhook calls

### 3. HTTPS Enforcement
- All API calls use HTTPS
- TLS 1.2+ required

### 4. Timeout Protection
- Signing sessions expire after 30 minutes
- Automatic cleanup of expired transactions

## Testing

### Simulation Mode (Default)

For development and testing without eMudhra credentials:

```bash
ESIGN_MODE=simulation
```

**Behavior:**
- Auto-completes eSign requests immediately
- No external API calls
- Returns mock signed documents
- Perfect for CI/CD and local development

### Production Mode

When ready to go live:

```bash
ESIGN_MODE=production
EMUDHRA_AUTH_TOKEN=your_actual_token
EMUDHRA_UNIQUE_ID=your_actual_unique_id
```

**Behavior:**
- Real API calls to eMudhra
- Actual Aadhaar OTP verification
- Legal digital signatures
- Webhook callbacks processed

## Monitoring & Debugging

### Log Messages

All operations are logged with clear prefixes:

```
[eMudhra eSign] Initiating eSign for verification abc123
[eMudhra eSign] Transaction ID: ESIGN-1699876543-ABC123
[eMudhra eSign] Success response: {...}
[eSign Webhook] Received callback
[eSign Webhook] Updated verification xyz789 with status completed
```

### Status Dashboard

Check the service status on startup:

```
✅ eSign Service initialized
   Provider: EMUDHRA
   Mode: SIMULATION
   Endpoint: https://esign.sandbox.emudhra.com/api/v1
   Webhook: https://yourapp.com/api/esign/webhook
```

If credentials are missing in production:

```
⚠️  PRODUCTION MODE - Missing credentials!
   Provider: EMUDHRA
   Mode: PRODUCTION
   Endpoint: https://api.emsigner.com/v1
   Webhook: Not configured
```

## Frontend Integration

### Initiating eSign

```typescript
// On frontend
const response = await apiRequest('/api/profile/kyc-tier/request-accredited', {
  method: 'POST',
  body: {
    verificationType: 'networth_based'
  }
});

if (response.eSignRequired) {
  // Redirect to eMudhra signing portal
  window.location.href = response.redirectUrl;
}
```

### Handling Return

After user completes signing on eMudhra portal:

```typescript
// User returns to returnUrl
const urlParams = new URLSearchParams(window.location.search);
const transactionId = urlParams.get('transactionId');

// Poll for status
const status = await fetch(`/api/esign/status/${transactionId}?provider=emudhra`);
const data = await status.json();

if (data.status.status === 'completed') {
  // Show success message
  showSuccess('Document signed successfully!');
} else if (data.status.status === 'failed') {
  // Show error
  showError(data.status.errorMessage);
}
```

## Database Schema

The `accreditedInvestorVerifications` table stores:

```sql
- eSignTransactionId: VARCHAR (unique transaction ID)
- eSignProvider: ENUM ('emudhra', 'nsdl')
- eSignStatus: ENUM ('pending', 'completed', 'failed')
- riskDeclarationUrl: TEXT (signed document URL)
- eSignCompletedAt: TIMESTAMP
- eSignResponsePayload: JSONB (full response from provider)
```

## Troubleshooting

### Common Issues

**1. "eSign service not configured"**
- Check `EMUDHRA_AUTH_TOKEN` and `EMUDHRA_UNIQUE_ID` are set
- Verify credentials are correct

**2. "Invalid webhook signature"**
- Ensure `ESIGN_WEBHOOK_SECRET` matches on both sides
- Check webhook URL is publicly accessible

**3. "Signing session expired"**
- User took longer than 30 minutes
- Ask user to retry with new session

**4. "Aadhaar not linked to mobile"**
- User's mobile number not linked to Aadhaar
- Guide user to link at https://uidai.gov.in/

## Production Checklist

Before going live:

- [ ] Obtained eMudhra ASP credentials
- [ ] Set all environment variables
- [ ] Tested in sandbox environment
- [ ] Verified webhook callbacks work
- [ ] Completed ISA audit (if required)
- [ ] Updated `ESIGN_MODE=production`
- [ ] Monitored first few transactions
- [ ] Set up error alerting
- [ ] Documented incident response plan

## Support

### eMudhra Support
- **Email:** support@emudhra.com
- **Phone:** +91-80-XXXXXXXXX (check official website)
- **Developer Portal:** https://developers.emsigner.com/
- **Documentation:** https://devemca.emudhra.com/eSign.html

### Internal Support
For implementation questions, contact the development team.

## Appendix

### Sample cURL Request

```bash
curl -X POST https://api.emsigner.com/v1/esign/initiate \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your_auth_token" \
  -H "X-Unique-ID: your_unique_id" \
  -d '{
    "transactionId": "ESIGN-1699876543-ABC123",
    "documentHash": "sha256_hash_here",
    "documentUrl": "https://yourapp.com/doc.pdf",
    "signer": {
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "+919876543210",
      "identifier": "1234-5678-9012",
      "identifierType": "aadhaar"
    },
    "callbackUrl": "https://yourapp.com/api/esign/webhook",
    "expiryMinutes": 30
  }'
```

### Response Example

```json
{
  "success": true,
  "sessionId": "SESSION123",
  "signingUrl": "https://esign.emudhra.com/sign/SESSION123",
  "expiresAt": "2024-01-01T12:30:00Z"
}
```

---

**Document Version:** 1.0  
**Last Updated:** November 11, 2025  
**Author:** Development Team  
**Status:** Production Ready
