# Sandbox PAN API Migration - October 17, 2025

## Summary
Updated FintekPro to use the new Sandbox PAN Verification API (v1.0). The old `/kyc/pan/verify` endpoint was deprecated as of April 30, 2025.

## Changes Made

### 1. API Endpoint Updated
- **Old**: `POST /kyc/pan/verify`
- **New**: `POST /pans/verify`

### 2. New API Requirements
The new API requires **three parameters** instead of two:
- `pan` - PAN number (10 digits)
- `name` - Full name as per PAN card
- `dob` - Date of birth (YYYY-MM-DD or DD-MM-YYYY)

### 3. Backend Services Updated

#### ✅ `server/services/sandbox-kyc-service.ts`
- **verifyIndividualPAN()**: Updated signature to accept `(pan, name, dob)`
- **verifyCorporatePAN()**: Updated signature to accept `(pan, name)`
- **verifyCorporateEntity()**: Updated to accept `companyName` in params
- **Error Handling**: Added specific error messages for 400 (bad request) and 401 (auth failed)

#### ✅ `server/routes.ts`
- **POST /api/kyc/wizard/verify-pan**: Now requires `fullName` in request body
- **POST /api/kyc/corporate/verify-pan**: Created new endpoint for Corporate KYC wizard
- Updated validation to check for `fullName` and `companyName` parameters
- Passes `fullName` to `verifyIndividualPAN()` and `companyName` to `verifyCorporatePAN()`

#### ✅ `server/services/corporate-kyc-service.ts`
- **verifyCorporatePAN()**: Updated to accept `companyName` parameter
- Passes `companyName` to Sandbox API

#### ✅ `server/services/nri-kyc-service.ts`
- **verifyPassportAndPAN()**: Uses `passportName` when verifying PAN
- Passes name to `verifyIndividualPAN()`

## Frontend Changes Completed ✅

### ✅ Updated KYC Form Components

All frontend components have been updated to collect the user's **full name** in addition to PAN and DOB:

#### ✅ 1. Smart KYC Onboarding (`client/src/pages/onboarding.tsx`)
- Added `fullName` input field to PAN verification step
- Added form validation for `fullName` (minimum 3 characters)
- Updated API request to include `fullName` parameter
- Endpoint: `POST /api/kyc/wizard/verify-pan`

#### ✅ 2. Manual KYC Page (`client/src/pages/manual-kyc.tsx`)
- **NO CHANGES NEEDED** - This is a fully manual submission form
- Does not call Sandbox PAN verification API
- Endpoint: `POST /api/kyc/manual-submit` (separate from Sandbox API)

#### ✅ 3. Corporate KYC Wizard (`client/src/components/kyc/corporate-kyc-wizard.tsx`)
- Added `companyName` input field in Step 1
- Added form validation for `companyName` (minimum 3 characters)
- Updated API request to include `companyName` parameter
- Endpoint: `POST /api/kyc/corporate/verify-pan` (newly created)

#### ✅ 4. NRI KYC Wizard (`client/src/components/kyc/nri-kyc-wizard.tsx`)
- Already has `passportName` field ✅
- Passes name to PAN verification when applicable

## API Documentation

### Endpoint: POST /api/kyc/wizard/verify-pan (Individual)

**Request Body:**
```json
{
  "sessionId": "string",
  "panNumber": "ABCDE1234F",
  "fullName": "John Doe",        // ← NEW REQUIRED FIELD
  "dob": "1990-01-15"
}
```

### Endpoint: POST /api/kyc/corporate/verify-pan (Corporate)

**Request Body:**
```json
{
  "pan": "ABCDE1234C",
  "companyName": "ABC Private Limited"    // ← NEW REQUIRED FIELD
}
```

**Success Response (200):**
```json
{
  "success": true,
  "companyName": "ABC Private Limited",
  "companyType": "Private Limited Company",
  "pan": "ABCDE1234C"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "verification": {
    "pan": "ABCDE1234F",
    "fullName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-15",
    "status": "Active",
    "category": "Individual"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid request: Name mismatch. Check API credentials or input format."
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Authentication failed. Verify SANDBOX_API_KEY and SANDBOX_API_SECRET."
}
```

## Testing the API

### Test with cURL:
```bash
# Test authentication
curl -X POST https://api.sandbox.co.in/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "x_api_key": "YOUR_SANDBOX_API_KEY",
    "x_api_secret": "YOUR_SANDBOX_API_SECRET"
  }'

# Test PAN verification (replace TOKEN with access_token from above)
curl -X POST https://api.sandbox.co.in/pans/verify \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pan": "ABCDE1234F",
    "name": "John Doe",
    "dob": "1990-01-15"
  }'
```

### Test via FintekPro API:
1. Log in to FintekPro
2. Start KYC wizard
3. Enter:
   - PAN: `ABCDE1234F`
   - Full Name: `John Doe` (as per PAN card)
   - DOB: `1990-01-15`
4. Check response - should return PAN details or specific error

## Sandbox API Credentials

**Dashboard**: https://sandbox.co.in/login  
**Docs**: https://developer.sandbox.co.in

**Environment Variables** (already set):
- `SANDBOX_API_KEY` ✅
- `SANDBOX_API_SECRET` ✅

## Error Handling

### Common Errors:
1. **400 Bad Request**
   - Invalid PAN format
   - Name mismatch (name doesn't match PAN records)
   - Invalid date format
   - **Action**: Verify user input and API credentials

2. **401 Unauthorized**
   - Invalid API key/secret
   - Expired token
   - **Action**: Check `SANDBOX_API_KEY` and `SANDBOX_API_SECRET` in environment

3. **Mock Fallback**
   - When Sandbox API is unavailable, system returns mock data
   - ⚠️ **WARNING**: Mock data is for testing only, NOT production-ready

## Migration Checklist

- [x] Update backend API endpoint to `/pans/verify`
- [x] Add `name` parameter to Individual PAN verification
- [x] Add `name` parameter to Corporate PAN verification
- [x] Update routes to accept `fullName` from frontend
- [x] Create `/api/kyc/corporate/verify-pan` endpoint for Corporate KYC
- [x] Update NRI KYC service
- [x] Update Corporate KYC service
- [x] Add better error handling (400, 401 status codes)
- [x] **Update frontend KYC forms to collect full name**
  - [x] Smart KYC Onboarding (onboarding.tsx) - Added fullName field
  - [x] Manual KYC (manual-kyc.tsx) - No changes needed (manual form)
  - [x] Corporate KYC Wizard (corporate-kyc-wizard.tsx) - Added companyName field
  - [x] NRI KYC Wizard - Already has passportName field
- [ ] Test with real Sandbox API credentials
- [ ] Verify wallet balance in Sandbox dashboard
- [ ] Update user documentation

## Next Steps

1. **Frontend Update**: Add `fullName` input field to all KYC forms
2. **Test Credentials**: Use Sandbox dashboard to verify API keys and wallet balance
3. **Production Testing**: Test with real PAN numbers (with user consent)
4. **Monitor Errors**: Watch for 400/401 errors in logs to identify credential issues

## Support

**Sandbox Support**: https://sandbox.co.in/support  
**API Documentation**: https://developer.sandbox.co.in/reference/verify-pan-details-api
