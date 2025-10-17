# Environment Variables - FintekPro

This document lists all required environment variables for the FintekPro platform. These should be configured in your deployment environment (Replit Secrets, .env file, etc.).

## Critical / Always Required

### Database
- `DATABASE_URL` - PostgreSQL connection string (auto-configured in Replit)

### Security & Encryption
- `ENCRYPTION_MASTER_KEY` - Master key for PII encryption (AES-256-GCM)
- `SESSION_SECRET` - Express session secret key

## Payment Gateways (India-focused)

### Cashfree (Primary)
- `CASHFREE_APP_ID` - Cashfree application ID
- `CASHFREE_SECRET_KEY` - Cashfree secret key
- `CASHFREE_ENVIRONMENT` - Environment (sandbox/production)

### PhonePe (Secondary)
- `PHONEPE_MERCHANT_ID` - PhonePe merchant identifier
- `PHONEPE_SALT_KEY` - PhonePe salt key for signature
- `PHONEPE_SALT_INDEX` - PhonePe salt index

## KYC & Verification Services

### Cashfree OKYC
- Uses same Cashfree credentials as payment gateway

### Sandbox KYC/Penny Drop
- `SANDBOX_API_KEY` - Sandbox API key for bank verification
- `SANDBOX_API_SECRET` - Sandbox API secret

## AI & Intelligence

### Google Gemini AI
- `GEMINI_API_KEY` - Google Gemini API key for AI assistant and expense categorization

## Communication Services

### Email (Nodemailer)
- `EMAIL_HOST` - SMTP host
- `EMAIL_PORT` - SMTP port
- `EMAIL_USER` - SMTP username
- `EMAIL_PASS` - SMTP password

### SMS & WhatsApp (Twilio)
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number for SMS

## Object Storage
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Default bucket ID (auto-configured in Replit)
- `PUBLIC_OBJECT_SEARCH_PATHS` - Search paths for public assets
- `PRIVATE_OBJECT_DIR` - Directory for private objects

## Optional / Feature-Specific

### Market Data
- BSE Star MFD API credentials (if using BSE mutual funds)
- NSE NCB API credentials (if using NSE bonds)
- Finnhub API key (if using Finnhub for market data)

### External Integrations
- DigiLocker API credentials (if using DigiLocker KYC)
- CKYC credentials (if using Central KYC)
- Bajaj Finance API (if using Bajaj calculators)
- Tata Capital API (if using Tata Capital services)

### Social Auth (Optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `APPLE_KEY_ID` - Apple Sign In key ID
- `APPLE_PRIVATE_KEY` - Apple Sign In private key
- `APPLE_SERVICE_ID` - Apple Sign In service ID
- `APPLE_TEAM_ID` - Apple Sign In team ID

## Development Environment
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `LOG_LEVEL` - Logging level (debug/info/warn/error/fatal)

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env` files locally (add to `.gitignore`)
   - Use Replit Secrets for deployment
   - Use environment-specific secret managers in production

2. **Rotate secrets regularly**
   - Set up automatic rotation for critical secrets
   - Update keys after any security incident

3. **Principle of Least Privilege**
   - Only provide secrets needed for specific features
   - Use read-only keys where possible
   - Separate development and production credentials

4. **Validation**
   - The app validates required secrets on startup
   - Missing critical secrets will prevent server start
   - Check server logs for secret-related errors

## Migration & Setup

### First-Time Setup
1. Configure all critical secrets (Database, Encryption, Session)
2. Configure payment gateway credentials
3. Configure communication services (Email, SMS)
4. Run PII encryption migration: `tsx server/scripts/migrate-encrypt-pii.ts`

### Adding New Environment
1. Copy secret values from existing environment (never commit)
2. Update environment-specific values (API URLs, etc.)
3. Verify all health checks pass: `GET /health` and `GET /ready`
