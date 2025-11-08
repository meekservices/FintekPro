# FintekPro - Production Deployment Checklist

## Overview
This document provides a comprehensive checklist for deploying FintekPro to production on Replit.

---

## 🔐 Required Environment Variables (Secrets)

### Core Application
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `NODE_ENV` | Environment mode | ✅ | `production` |
| `PORT` | Server port | ✅ Auto-set | `5000` (auto-set by Replit) |
| `DATABASE_URL` | PostgreSQL connection | ✅ Auto-set | Auto-set by Replit Database |
| `SESSION_SECRET` | Session encryption key | ✅ **MANUAL** | Generate: `openssl rand -hex 32` |
| `REPLIT_DEV_DOMAIN` | Your app domain | ✅ Auto-set | Auto-set by Replit (e.g., `https://your-app.replit.app`) |

### Replit Authentication (Auto-Set by Platform)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `REPLIT_DOMAINS` | Authorized callback domains | ✅ Auto-set | Auto-set by Replit platform |
| `REPL_ID` | Unique Repl identifier | ✅ Auto-set | Auto-set by Replit platform |
| `ISSUER_URL` | OIDC issuer URL | ✅ Auto-set | Auto-set by Replit (defaults to https://replit.com/oidc) |
| `REPLIT_APP_SECRET` | OAuth client secret | ✅ Auto-set | Auto-set by Replit for authentication |

### AI & Analytics (Optional)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `GEMINI_API_KEY` | Google Gemini AI for chat assistant & expense tracking | ⚠️ Optional | Get from Google AI Studio |

### Payment Gateways (Optional)
#### Cashfree (Primary)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `CASHFREE_APP_ID` | Cashfree application ID | ⚠️ Optional | From Cashfree dashboard |
| `CASHFREE_SECRET_KEY` | Cashfree secret key | ⚠️ Optional | From Cashfree dashboard |
| `CASHFREE_ENVIRONMENT` | Environment mode | ⚠️ Optional | `SANDBOX` or `PRODUCTION` |

#### PhonePe (Secondary)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `PHONEPE_MERCHANT_ID` | PhonePe merchant ID | ⚠️ | Optional, for PhonePe payments |
| `PHONEPE_SALT_KEY` | PhonePe salt key | ⚠️ | From PhonePe dashboard |
| `PHONEPE_SALT_INDEX` | PhonePe salt index | ⚠️ | Usually `1` |
| `PHONEPE_ENVIRONMENT` | Environment mode | ⚠️ | `SANDBOX` or `PRODUCTION` |

### Banking & Financial APIs
#### ICICI Bank Integration
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `ICICI_APP_KEY` | ICICI auto-populate API | ⚠️ | For account aggregation |
| `ICICI_SECRET_KEY` | ICICI secret | ⚠️ | From ICICI Bank |
| `ICICI_BANK_APP_KEY` | ICICI direct banking API | ⚠️ | Optional |
| `ICICI_BANK_SECRET_KEY` | ICICI banking secret | ⚠️ | Optional |
| `ICICI_BANK_BASE_URL` | ICICI API base URL | ⚠️ | Optional |
| `ICICI_BANK_ENVIRONMENT` | ICICI environment | ⚠️ | `sandbox`, `uat`, or `production` |

#### HDFC Bank Integration
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `HDFC_CLIENT_ID` | HDFC client ID | ⚠️ | Optional |
| `HDFC_CLIENT_SECRET` | HDFC client secret | ⚠️ | Optional |

### Market Data APIs
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `FINNHUB_API_KEY` | Finnhub market data | ⚠️ | Get from finnhub.io (free tier available) |

### Trading Platforms
#### BSE (Bombay Stock Exchange)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `BSE_BOND_USER_ID` | BSE Bond platform | ⚠️ | Optional, for bond trading |
| `BSE_BOND_PASSWORD` | BSE Bond password | ⚠️ | Optional |
| `BSE_BOND_MEMBER_ID` | BSE member ID | ⚠️ | Optional |
| `BSE_BOND_ENVIRONMENT` | BSE environment | ⚠️ | `production` or leave empty for demo |
| `BSE_DIRECT_USER_ID` | BSE Direct platform | ⚠️ | Optional |
| `BSE_DIRECT_PASSWORD` | BSE Direct password | ⚠️ | Optional |
| `BSE_DIRECT_MEMBER_ID` | BSE Direct member | ⚠️ | Optional |
| `BSE_DIRECT_ENVIRONMENT` | BSE environment | ⚠️ | `production` or leave empty for demo |

#### NSE (National Stock Exchange)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `NSE_USER_ID` | NSE NCB platform | ⚠️ | Optional |
| `NSE_PASSWORD` | NSE password | ⚠️ | Optional |
| `NSE_MEMBER_ID` | NSE member ID | ⚠️ | Optional |
| `NSE_ENVIRONMENT` | NSE environment | ⚠️ | `production` or leave empty for demo |

### Communication Services
#### Email (Nodemailer)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `EMAIL_HOST` | SMTP server | ✅ | `smtp.gmail.com` (for Gmail) |
| `EMAIL_PORT` | SMTP port | ✅ | `587` (TLS) or `465` (SSL) |
| `EMAIL_SECURE` | Use SSL | ✅ | `false` for port 587, `true` for 465 |
| `EMAIL_USER` | Email address | ✅ | Your email (e.g., `noreply@fintekpro.com`) |
| `EMAIL_PASS` | Email password/app password | ✅ | Gmail: Use App Password |

#### SMS (Twilio or other - Optional)
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `SMS_API_KEY` | SMS service API key | ⚠️ Optional | Twilio or other SMS provider (email OTP works without this) |
| `SMS_SENDER_ID` | Sender ID | ⚠️ Optional | `FINTEK` or your brand name |
| `SMS_TEMPLATE_ID` | Template ID | ⚠️ Optional | Optional, for templated messages |

### Verification Services
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `SANDBOX_API_KEY` | Sandbox.co.in API | ⚠️ | For penny drop verification |
| `SANDBOX_API_SECRET` | Sandbox secret | ⚠️ | From sandbox.co.in dashboard |

### Object Storage
| Variable | Purpose | Required | Example/Notes |
|----------|---------|----------|---------------|
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public asset paths | Auto-set | Set by Replit Object Storage |
| `PRIVATE_OBJECT_DIR` | Private uploads directory | Auto-set | Set by Replit Object Storage |

---

## 📋 Pre-Publication Checklist

### 1. Database Setup
- [x] PostgreSQL database created (already done via Replit)
- [x] Admin user created (`admin@fintekpro.com`)
- [ ] Verify all database tables are properly migrated
- [ ] Run `npm run db:push` to sync schema
- [ ] Test database connection in production mode

### 2. Essential Secrets Configuration

**AUTO-SET by Replit (verify these exist):**
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `REPLIT_DOMAINS` - Authorized OAuth callback domains
- [ ] `REPL_ID` - Your Repl's unique identifier
- [ ] `REPLIT_DEV_DOMAIN` - Your app's deployment URL
- [ ] `PORT` - Server port (usually 5000)

**REQUIRED - You MUST manually configure these:**
- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] `EMAIL_HOST=smtp.gmail.com` (or your SMTP server)
- [ ] `EMAIL_PORT=587`
- [ ] `EMAIL_SECURE=false`
- [ ] `EMAIL_USER` (your email address)
- [ ] `EMAIL_PASS` (Gmail: use App Password, not regular password)

**HIGHLY RECOMMENDED (for core features):**
- [ ] `GEMINI_API_KEY` (AI chat assistant & expense tracking)
- [ ] `CASHFREE_APP_ID` & `CASHFREE_SECRET_KEY` (payment processing)
- [ ] `CASHFREE_ENVIRONMENT=SANDBOX` (or `PRODUCTION`)
- [ ] `SMS_API_KEY` (Twilio or other SMS provider for OTP)

**Can configure later (optional features):**
- [ ] Market data APIs (FINNHUB)
- [ ] Banking integrations (ICICI, HDFC)
- [ ] Trading platforms (BSE, NSE)
- [ ] PhonePe payment gateway

### 3. Security Review
- [x] Login authentication working with OTP
- [x] Password hashing implemented (bcrypt)
- [x] Session management configured (connect-pg-simple with PostgreSQL)
- [x] **CSRF protection** - Session-scoped tokens with automatic frontend integration
- [x] **Session regeneration** - OAuth and local auth flows regenerate sessions on login
- [x] **Rate limiting** - 100 req/15min general, 5 req/15min for 9 auth endpoints
- [x] **OTP security** - Scrypt hashing, 5-attempt limit, server-side expiration
- [x] **User enumeration prevention** - Uniform error messages across auth flows
- [x] CORS settings appropriate for production domain
- [x] Security headers configured (Helmet.js already in use)
- [x] SQL injection protection (using Drizzle ORM - ✅)
- [x] XSS protection enabled (input sanitization middleware)

### 4. Application Testing
Critical flows to test before publishing:
- [x] Admin login (tested and working)
- [ ] User registration and email verification
- [ ] Password reset flow
- [ ] KYC submission flow
- [ ] Payment processing (test mode)
- [ ] Portfolio creation and management
- [ ] Market data display

### 5. Performance Optimization
- [x] **Console.log cleanup** - 200+ statements migrated to winston logger in 5 critical files
- [x] **Database connection pooling** - 20 connections (prod) / 10 (dev), 30s idle timeout
- [x] **HTTP server timeouts** - 65s keep-alive, 66s headers, 120s request timeout
- [x] API rate limiting configured (general + auth-specific limits)
- [ ] Verify caching strategies are in place
- [ ] Test page load times under load
- [ ] Database indexes optimization (in progress)

### 6. Monitoring & Logging
- [x] **Winston logger** - Structured JSON logging in production, human-readable in dev
- [x] **Production logging** - 5 critical services migrated (KYC, payments, auto-population, AA, reminders)
- [x] Compliance logging in place
- [x] Activity tracking configured
- [x] Error tracking configured (winston with log rotation)
- [ ] Monitor production logs after deployment (winston daily rotate files)

---

## 🚀 Deployment Steps

### Step 1: Verify Auto-Set Secrets
1. Go to your Replit workspace
2. Click on "Tools" → "Secrets"
3. Verify these Replit auto-set variables exist:
   - ✅ `DATABASE_URL` - PostgreSQL connection
   - ✅ `REPLIT_DOMAINS` - OAuth callback domains
   - ✅ `REPL_ID` - Your Repl identifier  
   - ✅ `REPLIT_DEV_DOMAIN` - Your app URL
   - ✅ `ISSUER_URL` - OIDC issuer (defaults to https://replit.com/oidc)
   - ✅ `REPLIT_APP_SECRET` - OAuth client secret

**Note:** If any are missing, Replit will set them automatically when you publish.

### Step 2: Configure REQUIRED Manual Secrets
Add these manually - **the app CANNOT start without them:**

```
NODE_ENV=production
SESSION_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=<your-email>
EMAIL_PASS=<your-gmail-app-password>
```

### Step 3: Configure OPTIONAL Secrets (For Enhanced Features)
Add these only if you want specific features enabled:

```
# AI Features (optional)
GEMINI_API_KEY=<from Google AI Studio>

# Payment Processing (optional)
CASHFREE_APP_ID=<from Cashfree>
CASHFREE_SECRET_KEY=<from Cashfree>
CASHFREE_ENVIRONMENT=SANDBOX

# SMS OTP (optional - email OTP works without this)
SMS_API_KEY=<from Twilio or other provider>
```

### Step 4: Test in Development
1. Verify all features work with configured secrets
2. Test critical user flows
3. Check for any errors in console

### Step 5: Publish on Replit
1. Click the "Publish" button in Replit
2. Choose "Autoscale Deployment" (recommended for web apps with variable traffic)
3. Configure your deployment:
   - **Name**: FintekPro
   - **Build command**: (auto-detected)
   - **Run command**: `npm run dev` (auto-detected)
4. Add payment method if required
5. Click "Publish"

### Step 6: Post-Deployment Verification
1. Test the published URL
2. Verify admin login works
3. Check database connectivity
4. Test email sending
5. Verify payment gateway (test mode)
6. Monitor logs for errors

---

## 🔧 Quick Setup Guide for Essential Services

### Google Gemini API (Required for AI features)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Get API Key"
4. Copy the key and add as `GEMINI_API_KEY` in Replit Secrets

### Cashfree Payment Gateway (Required for payments)
1. Sign up at [Cashfree](https://www.cashfree.com/)
2. Complete KYC and verification
3. Get your App ID and Secret Key from dashboard
4. Start with **SANDBOX mode** for testing:
   ```
   CASHFREE_APP_ID=your_test_app_id
   CASHFREE_SECRET_KEY=your_test_secret_key
   CASHFREE_ENVIRONMENT=SANDBOX
   ```
5. Switch to PRODUCTION after thorough testing

### Email Service (Gmail Example)
1. Create a Gmail account for your app (e.g., `noreply@yourdomain.com`)
2. Enable 2-Factor Authentication
3. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App Passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password
4. Configure in Replit Secrets:
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-char-app-password
   ```

### SMS Service (Twilio Example)
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token
3. Get a phone number
4. Configure:
   ```
   SMS_API_KEY=your_auth_token
   SMS_SENDER_ID=+1234567890
   ```

---

## ⚠️ Important Notes

### Database
- Your PostgreSQL database is already configured via Replit
- DATABASE_URL is automatically set
- Make sure to backup your database regularly using Replit's database tools

### Costs
- **Replit Autoscale**: Pay per request/compute time
- **Database**: Included with Replit subscription
- **Object Storage**: Pay for storage and transfer
- Review [Replit pricing](https://replit.com/pricing) for details

### Custom Domain (Optional)
- After publishing, you can add a custom domain
- Go to Deployment → Custom Domains
- Follow DNS configuration instructions

### Security Best Practices
1. ✅ Never commit secrets to code (using Replit Secrets)
2. ✅ Use strong passwords for admin accounts
3. ✅ Enable HTTPS (automatic with Replit deployments)
4. ✅ Regularly update dependencies
5. ✅ Monitor logs for suspicious activity

---

## 🆘 Troubleshooting

### Common Issues

**Issue**: Admin can't login after deployment
- **Solution**: Run `npx tsx server/create-admin-user.ts` to create admin user

**Issue**: Email not sending
- **Check**: Verify EMAIL_* secrets are configured correctly
- **Check**: For Gmail, ensure App Password is used (not regular password)

**Issue**: Payment failing
- **Check**: Verify CASHFREE_ENVIRONMENT is set correctly
- **Check**: Ensure you're using test credentials in SANDBOX mode

**Issue**: Database connection error
- **Check**: DATABASE_URL should be auto-set by Replit
- **Check**: Run `npm run db:push` to sync schema

---

## 📞 Support & Resources

- **Replit Docs**: https://docs.replit.com/
- **Cashfree Docs**: https://docs.cashfree.com/
- **Google Gemini**: https://ai.google.dev/docs
- **Twilio SMS**: https://www.twilio.com/docs/sms

---

## ✅ Final Pre-Launch Checklist

Before clicking "Publish", ensure:

- [ ] All required secrets are configured
- [ ] Admin user exists and can login
- [ ] Database schema is up to date
- [ ] Email service is working (test OTP delivery)
- [ ] Payment gateway is in test mode
- [ ] Error handling is in place
- [ ] Security headers configured
- [ ] Application tested in development mode
- [ ] You have a rollback plan

---

## 🔒 Production Security Hardening (November 2025)

### CSRF Protection (Fully Implemented ✅)
**Backend Implementation:**
- Session-scoped CSRF token generation with crypto.randomBytes(32)
- Dedicated `/api/csrf-token` endpoint for SPA token fetching
- Automatic validation on all state-changing requests (POST, PUT, PATCH, DELETE)
- Smart webhook exemptions (Cashfree, Zoho, PhonePe, AA callbacks)
- Middleware applied before all application routes for comprehensive coverage

**Frontend Integration:**
- Automatic token fetching on app initialization
- Token injection into all mutation requests via X-CSRF-Token header
- Retry logic on 403 CSRF validation failures
- Token refresh mechanism in queryClient configuration

**Files Modified:**
- `server/csrf-protection.ts` - Core CSRF middleware and token management
- `client/src/lib/queryClient.ts` - Frontend auto-fetch and retry logic
- `server/index.ts` - Middleware integration

### Authentication Security Enhancements
**Session Regeneration:**
- OAuth flow (Replit Auth): Session regenerated on successful authentication
- Local auth flow: Session regenerated after password verification
- Fresh CSRF tokens generated post-regeneration
- Prevents session fixation attacks

**Rate Limiting (9 Protected Endpoints):**
- `/api/login` - 5 requests per 15 minutes
- `/api/login/verify-otp` - 5 requests per 15 minutes
- `/api/register` - 5 requests per 15 minutes
- `/api/register/verify-otp` - 5 requests per 15 minutes
- `/api/register/resend-otp` - 5 requests per 15 minutes
- `/api/otp/send` - 5 requests per 15 minutes
- `/api/otp/verify` - 5 requests per 15 minutes
- `/api/auth/forgot-password` - 5 requests per 15 minutes
- `/api/auth/reset-password` - 5 requests per 15 minutes

**OTP Hardening:**
- OTPs stored with scrypt hashing (not plaintext)
- 5-attempt limit per OTP with auto-incrementing counter
- Strict server-side expiration enforcement (5 minutes)
- Automatic deletion after successful verification or max attempts exceeded
- Timing-safe comparison to prevent timing attacks

**User Enumeration Prevention:**
- Uniform "Invalid credentials" error messages across all failure paths
- No distinction between "user not found" and "wrong password"
- Consistent response timing across different failure scenarios
- Multiple accounts detection returns same generic error

### Production Infrastructure Configuration
**Database Connection Pooling:**
```javascript
max: process.env.NODE_ENV === 'production' ? 20 : 10
idleTimeoutMillis: 30000  // 30 seconds
connectionTimeoutMillis: 10000  // 10 seconds
```

**HTTP Server Timeouts:**
```javascript
server.keepAliveTimeout = 65000   // 65 seconds (> load balancer timeout)
server.headersTimeout = 66000     // 66 seconds (> keepAliveTimeout)
server.requestTimeout = 120000    // 120 seconds for long operations
```

**CORS Configuration:**
- Whitelist-based origin validation
- Credentials enabled for session cookies
- Replit domain patterns supported (*.replit.dev, *.repl.co, *.replit.app)
- Custom domain support (fintekpro.com, admin.fintekpro.com)

**Input Sanitization:**
- XSS pattern removal from all request bodies and query parameters
- Script tag stripping
- JavaScript protocol removal
- Event handler attribute sanitization
- Webhook exemptions for signature verification

### Logging & Monitoring
**Winston Logger Integration:**
- Structured JSON logging in production
- Human-readable format in development
- Daily log rotation with 14-day retention
- Separate logs for combined, error, and exceptions
- Maximum log file size: 20MB

**Migrated Services (200+ console statements):**
1. `server/services/reminder-scheduler.ts`
2. `server/services/kyc-workflow-orchestrator.ts`
3. `server/services/payment-execution-bridge.ts`
4. `server/services/auto-population-orchestrator.ts`
5. `server/services/account-aggregator-service.ts`

**Log Levels:**
- `info` - Normal operations, service initialization
- `warn` - Recoverable errors, fallbacks
- `error` - Critical failures requiring attention
- `debug` - Detailed troubleshooting (dev only)

### Error Handling Improvements
**Process-Level Handlers:**
```javascript
process.on('uncaughtException') // Logged with winston, process exits gracefully
process.on('unhandledRejection') // Logged with winston, rejection tracked
```

**Express Error Middleware:**
- Centralized error handler logs all errors via winston
- Never re-throws errors to prevent process termination
- Structured error responses with status codes
- Stack traces preserved for debugging

### Security Audit Results
**Architect Review Status:** ✅ PASS (November 8, 2025)

**Security Coverage:**
- ✅ CSRF protection comprehensive and correctly implemented
- ✅ No security gaps identified in authentication flows
- ✅ Production configurations optimal for financial services platform
- ✅ No regressions or breaking changes detected
- ✅ Input validation and sanitization working correctly
- ✅ Session management secure with regeneration
- ✅ Rate limiting prevents brute force attacks

**Remaining Recommendations (Non-Blocking):**
1. End-to-end testing of login → CSRF token fetch → mutation flow
2. Monitor `CSRF_VALIDATION_FAILED` events in production logs
3. Validate connection pool metrics under load in staging environment
4. Database index optimization for high-traffic queries
5. Performance testing under sustained load

---

**Last Updated**: November 8, 2025
**Status**: Production-hardened and architect-verified ✅
**Next Steps**: Configure essential secrets → End-to-end testing → Publish
