# 🚀 FintekPro Production Deployment Guide

This guide provides comprehensive instructions for deploying FintekPro to production with enterprise-grade reliability, security, and performance.

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Rollback Procedures](#rollback-procedures)
8. [Performance Optimization](#performance-optimization)
9. [Security Hardening](#security-hardening)
10. [Disaster Recovery](#disaster-recovery)

---

## ✅ Pre-Deployment Checklist

### Code Quality & Testing
- [ ] All tests passing (`npm test`)
- [ ] No TypeScript compilation errors (`npm run build`)
- [ ] Code review completed and approved
- [ ] Security audit completed (see `SECURITY_AUDIT.md`)
- [ ] Performance testing completed
- [ ] Load testing completed
- [ ] Integration tests passing

### Environment Configuration
- [ ] All environment variables configured in `.env` (use `.env.example` as template)
- [ ] Production API credentials obtained and validated
- [ ] Database connection string configured with SSL
- [ ] Session secrets generated (minimum 32 characters, cryptographically random)
- [ ] CSRF token secret configured
- [ ] Encryption keys configured for PII data

### Third-Party Services
- [ ] Payment gateways configured (Cashfree, PhonePe)
- [ ] Email service configured (SMTP/Nodemailer)
- [ ] SMS service configured (Twilio)
- [ ] KYC APIs configured (Sandbox, BSE STAR, KRA agencies)
- [ ] eSign service configured (eMudhra/NSDL)
- [ ] Market data APIs configured (Alpha Vantage, Finnhub)
- [ ] AI service configured (Google Gemini)

### Security
- [ ] HTTPS/SSL certificates installed
- [ ] Security headers configured (Helmet)
- [ ] CORS whitelist configured for production domains
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Input sanitization enabled
- [ ] API keys rotated from development
- [ ] Webhook secrets configured

### Infrastructure
- [ ] Database provisioned (Neon PostgreSQL recommended)
- [ ] Database backups configured
- [ ] Object storage configured (if using file uploads)
- [ ] CDN configured for static assets
- [ ] Load balancer configured (if using multiple instances)
- [ ] Health check endpoints accessible (`/health`, `/ready`, `/live`)

---

## 🔧 Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourorg/fintekpro.git
cd fintekpro
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and configure all required variables for production:

**Critical Variables:**
- `NODE_ENV=production`
- `DATABASE_URL` - PostgreSQL connection string with SSL
- `SESSION_SECRET` - Cryptographically random string (32+ chars)
- `JWT_SECRET` - Cryptographically random string (32+ chars)
- `CSRF_SECRET` - Cryptographically random string (32+ chars)
- `APP_URL` - Production domain (e.g., `https://fintekpro.com`)
- `FRONTEND_URL` - Production frontend URL

**Payment Gateways:**
- Cashfree: `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENVIRONMENT=production`
- PhonePe: `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_ENVIRONMENT=production`

**Communication:**
- Email: `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_SERVICE`
- SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

**KYC Services:**
- Sandbox: `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`
- BSE STAR: `BSE_STAR_API_KEY`, `BSE_STAR_MEMBER_ID`, `BSE_STAR_USER_ID`
- eMudhra: `EMUDHRA_API_KEY`, `EMUDHRA_CLIENT_ID`, `EMUDHRA_WEBHOOK_SECRET`

### 4. Database Configuration
Ensure your `DATABASE_URL` includes:
- SSL mode: `?sslmode=require`
- Connection pooling configuration

Example:
```
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require&pool_timeout=30
```

---

## 💾 Database Migration

### 1. Push Schema to Production Database
```bash
# Dry run to see what changes will be made
npm run db:push

# If safe, force push (production mode)
npm run db:push --force
```

**⚠️ CRITICAL**: Always backup database before pushing schema changes!

### 2. Verify Database Schema
```bash
# Connect to database and verify tables
psql $DATABASE_URL

\dt  # List all tables
\d users  # Describe users table
```

### 3. Run Data Migrations (if needed)
```bash
# Execute any custom data migration scripts
npm run db:migrate
```

---

## 🚀 Deployment Steps

### Option 1: Replit Deployments (Recommended)

1. **Push to Production**
   ```bash
   git push origin main
   ```

2. **Configure Deployment**
   - Navigate to Replit Deployments
   - Click "Deploy" button
   - Configure environment variables
   - Set deployment region
   - Enable auto-deploy on main branch

3. **Verify Deployment**
   - Check deployment logs
   - Verify health endpoints
   - Test critical user flows

### Option 2: Manual Server Deployment

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Start Production Server**
   ```bash
   NODE_ENV=production npm start
   ```

   Or use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start npm --name "fintekpro" -- start
   pm2 save
   pm2 startup
   ```

3. **Configure Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name fintekpro.com www.fintekpro.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
           proxy_read_timeout 300s;
           proxy_connect_timeout 75s;
       }
   }
   ```

### Option 3: Docker Deployment

1. **Build Docker Image**
   ```bash
   docker build -t fintekpro:latest .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     --name fintekpro \
     --env-file .env \
     -p 5000:5000 \
     --restart unless-stopped \
     fintekpro:latest
   ```

---

## ✅ Post-Deployment Verification

### 1. Health Checks
```bash
# Basic health check
curl https://yourapp.com/health

# Readiness check (includes database connectivity)
curl https://yourapp.com/ready

# Liveness check
curl https://yourapp.com/live

# Metrics endpoint
curl https://yourapp.com/metrics
```

**Expected Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T10:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "database": {
    "connected": true,
    "responseTime": 12
  }
}
```

### 2. Critical User Flows
- [ ] User registration with OTP verification
- [ ] User login with 2FA
- [ ] KYC process (all 3 tiers)
- [ ] Payment processing (Cashfree/PhonePe)
- [ ] Portfolio viewing and management
- [ ] Market data fetching
- [ ] AI chat assistant

### 3. API Endpoints
Test critical API endpoints:
```bash
# Authentication
curl -X POST https://yourapp.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# KYC Status
curl https://yourapp.com/api/kyc/status \
  -H "Cookie: connect.sid=..."

# Portfolio
curl https://yourapp.com/api/portfolio \
  -H "Cookie: connect.sid=..."
```

### 4. Monitor Logs
```bash
# View application logs
pm2 logs fintekpro

# Or if using Docker
docker logs -f fintekpro

# Check for errors
grep ERROR /var/log/fintekpro/combined.log
```

### 5. Database Connection
```bash
# Verify database connections
curl https://yourapp.com/metrics | grep db_latency
```

---

## 📊 Monitoring & Alerting

### Application Metrics

The application exposes Prometheus-compatible metrics at `/metrics`:

**Key Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `db_connections_active` - Active database connections
- `db_query_latency_ms` - Database query latency
- `cache_hit_rate` - Cache hit rate
- `external_api_latency_ms` - External API latency

### Health Monitoring

Configure monitoring tools to poll health endpoints:

```yaml
# Prometheus scrape config
scrape_configs:
  - job_name: 'fintekpro'
    scrape_interval: 15s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['fintekpro.com:443']
        labels:
          environment: 'production'
```

### Alerting Rules

Set up alerts for critical conditions:

**Database Issues:**
- Database connection pool exhausted
- Query latency > 1000ms
- Failed queries > 5% of total

**Application Issues:**
- 5xx errors > 1% of requests
- Memory usage > 80%
- CPU usage > 80% sustained
- Response time > 2000ms

**Business Logic:**
- Failed KYC verifications
- Failed payment transactions
- External API failures

### Log Aggregation

FintekPro uses Winston for structured JSON logging:

**Log Levels:**
- `error` - Application errors
- `warn` - Warnings and degraded states
- `info` - General information
- `http` - HTTP request logs
- `debug` - Detailed debugging

**Recommended Setup:**
- Use log aggregation service (e.g., Datadog, LogRocket, Papertrail)
- Configure log retention (30-90 days)
- Set up log-based alerts

---

## 🔄 Rollback Procedures

### Immediate Rollback (Critical Issues)

1. **Revert to Previous Deployment**
   ```bash
   # Replit Deployments
   - Go to Deployments page
   - Click "Rollback" on previous successful deployment
   
   # Manual/PM2
   git checkout previous-release-tag
   npm install
   npm run build
   pm2 restart fintekpro
   ```

2. **Verify Rollback**
   ```bash
   curl https://yourapp.com/health
   ```

### Database Rollback

**⚠️ WARNING**: Database rollbacks can cause data loss!

1. **Stop Application**
   ```bash
   pm2 stop fintekpro
   ```

2. **Restore Database from Backup**
   ```bash
   pg_restore -d $DATABASE_URL backup.dump
   ```

3. **Verify Database**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
   ```

4. **Restart Application**
   ```bash
   pm2 start fintekpro
   ```

---

## ⚡ Performance Optimization

### Database Optimization

1. **Connection Pooling**
   - Max connections: 20 (production)
   - Idle timeout: 30 seconds
   - Connection timeout: 10 seconds

2. **Query Optimization**
   - Add indexes on frequently queried columns
   - Use database query caching
   - Implement pagination for large result sets

3. **Monitoring**
   - Track slow queries (> 1000ms)
   - Monitor connection pool utilization
   - Set up query performance insights

### Application Caching

1. **In-Memory Cache**
   - Use `CacheService` for frequently accessed data
   - Default TTL: 1 hour
   - Max cache size: 1000 items

2. **API Response Caching**
   - Cache market data for 60 seconds
   - Cache KYC status for 5 minutes
   - Cache portfolio for 2 minutes

### Static Asset Optimization

1. **Enable Compression**
   ```javascript
   app.use(compression());
   ```

2. **CDN Configuration**
   - Serve static assets from CDN
   - Set cache headers (1 year for immutable assets)
   - Enable Brotli/Gzip compression

3. **Asset Minification**
   - JavaScript/CSS minification (Vite handles automatically)
   - Image optimization (WebP format)
   - Font subsetting

---

## 🔐 Security Hardening

### SSL/TLS Configuration

1. **Force HTTPS**
   ```javascript
   if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
     res.redirect(`https://${req.headers.host}${req.url}`);
   }
   ```

2. **Security Headers** (already configured via Helmet)
   - Content Security Policy (CSP)
   - HTTP Strict Transport Security (HSTS)
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY

### Rate Limiting

**API Endpoints:**
- General: 100 requests / 15 minutes
- Authentication: 5 requests / 15 minutes
- Admin: Bypassed for verified admins

### Input Validation

All inputs are validated and sanitized:
- XSS prevention
- SQL injection prevention (Drizzle ORM)
- Command injection prevention

### Secrets Management

**Never commit secrets to Git!**

Use environment variables for:
- API keys
- Database credentials
- Session secrets
- Encryption keys

**Production Best Practices:**
- Rotate secrets quarterly
- Use different secrets per environment
- Minimum 32 characters for cryptographic secrets
- Store in secure vault (AWS Secrets Manager, HashiCorp Vault)

---

## 🆘 Disaster Recovery

### Database Backups

**Automated Backups:**
- Daily full backups
- Hourly incremental backups (production)
- Retention: 30 days

**Manual Backup:**
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
pg_restore --list backup_YYYYMMDD_HHMMSS.sql
```

**Backup Storage:**
- Primary: Database provider (Neon)
- Secondary: Object storage (S3/GCS)
- Offline: Encrypted local copies

### Application State Backup

1. **Session Data** - Stored in database (connect-pg-simple)
2. **Cache Data** - Ephemeral, can be regenerated
3. **Uploaded Files** - Stored in object storage with versioning

### Recovery Time Objective (RTO)

- Database recovery: < 15 minutes
- Application recovery: < 5 minutes
- Full system recovery: < 30 minutes

### Recovery Point Objective (RPO)

- Database: < 1 hour (incremental backups)
- Application state: < 5 minutes (continuous replication)

---

## 📞 Support & Troubleshooting

### Common Issues

**Database Connection Errors:**
- Check `DATABASE_URL` configuration
- Verify SSL mode is enabled
- Check connection pool settings
- Review firewall rules

**Authentication Failures:**
- Verify `SESSION_SECRET` is configured
- Check CSRF token configuration
- Verify cookie domain settings
- Check rate limiting configuration

**Payment Processing Failures:**
- Verify Cashfree/PhonePe credentials
- Check webhook URL configuration
- Verify webhook signature validation
- Review payment gateway logs

**KYC Verification Failures:**
- Check external API credentials
- Verify API endpoint URLs
- Check API rate limits
- Review KYC service logs

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

### Contact

- Technical Support: support@fintekpro.com
- Security Issues: security@fintekpro.com
- Emergency Hotline: +91-XXXX-XXXXXX

---

## 📚 Additional Resources

- [Security Audit Checklist](./SECURITY_AUDIT.md)
- [Database Backup Guide](./DATABASE_BACKUP.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Environment Variables Reference](./.env.example)

---

**Last Updated:** November 15, 2025  
**Version:** 1.0.0  
**Maintainer:** FintekPro DevOps Team
