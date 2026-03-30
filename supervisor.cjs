/**
 * FintekPro Self-Healing Supervisor
 *
 * Production-grade process monitor with:
 *  - HTTP health checks (/healthz)
 *  - Exponential-backoff auto-restart
 *  - Memory threshold watchdog (500 MB)
 *  - Crash-pattern detection (ECONNREFUSED, DB timeout, port errors)
 *  - ENV validation on startup
 *
 * Usage (Replit workflow or Railway override):
 *   node supervisor.js
 */

const { spawn, execSync } = require('child_process');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_RESTARTS          = 10;
const HEALTH_CHECK_INTERVAL = 15_000;   // ms between checks once running
const STARTUP_GRACE         = 8_000;    // ms to wait before first health check
const BASE_BACKOFF          = 3_000;    // ms — multiplied by attempt number
const MEMORY_CHECK_INTERVAL = 30_000;   // ms between memory snapshots
const MEMORY_LIMIT_MB       = 500;      // restart if heap exceeds this

const PORT         = parseInt(process.env.PORT || '5000', 10);
const IS_PROD      = process.env.NODE_ENV === 'production';
const HEALTH_PATH  = '/healthz';

// ── State ─────────────────────────────────────────────────────────────────────
let appProcess    = null;
let restartCount  = 0;
let restarting    = false;

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[SUPERVISOR] ${new Date().toISOString()} — ${msg}`);
}

// ── ENV validation ────────────────────────────────────────────────────────────
function validateEnv() {
  const required = IS_PROD
    ? ['PORT', 'DATABASE_URL', 'SESSION_SECRET']
    : [];

  for (const key of required) {
    if (!process.env[key]) log(`⚠️  WARNING: ${key} is not set`);
  }

  if (!process.env.DATABASE_URL && !process.env.PRODUCTION_DATABASE_URL) {
    log('⚠️  WARNING: Neither DATABASE_URL nor PRODUCTION_DATABASE_URL is set');
  }
}

// ── Crash-pattern scanner ─────────────────────────────────────────────────────
const CRASH_PATTERNS = [
  'ECONNREFUSED',
  'DB timeout',
  'EADDRINUSE',
  'Cannot find module',
  'SyntaxError',
  'Error: listen EACCES',
];

function scanForCrashPattern(line) {
  for (const pattern of CRASH_PATTERNS) {
    if (line.includes(pattern)) {
      log(`🔍 Crash pattern detected: "${pattern}" — scheduling restart`);
      scheduleRestart();
      break;
    }
  }
}

// ── Process management ────────────────────────────────────────────────────────
function getStartCommand() {
  if (IS_PROD) {
    return { cmd: 'node', args: ['dist/index.js'] };
  }
  return { cmd: 'npm', args: ['run', 'dev'] };
}

function freePort() {
  try {
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
  } catch {
    // fuser not available or port already free — ignore
  }
}

function startApp() {
  if (restarting) return;

  freePort(); // ensure port is clear before binding

  const { cmd, args } = getStartCommand();
  log(`🚀 Starting app: ${cmd} ${args.join(' ')}`);

  appProcess = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });

  // Pipe stdout — scan for crash patterns
  appProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    scanForCrashPattern(data.toString());
  });

  // Pipe stderr — scan for crash patterns
  appProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
    scanForCrashPattern(data.toString());
  });

  appProcess.on('exit', (code, signal) => {
    if (restarting) return;
    log(`❌ App exited (code=${code}, signal=${signal})`);
    scheduleRestart();
  });

  appProcess.on('error', (err) => {
    log(`❌ Failed to spawn app: ${err.message}`);
    scheduleRestart();
  });
}

function stopApp() {
  if (!appProcess) return;
  log('🛑 Sending SIGTERM to app...');
  appProcess.kill('SIGTERM');
  setTimeout(() => {
    if (appProcess && !appProcess.killed) {
      log('🔪 App did not stop — sending SIGKILL');
      appProcess.kill('SIGKILL');
    }
  }, 5000);
  appProcess = null;
}

function scheduleRestart() {
  if (restarting) return;

  if (restartCount >= MAX_RESTARTS) {
    log(`🔥 MAX RESTART LIMIT (${MAX_RESTARTS}) REACHED — manual intervention required`);
    process.exit(1);
  }

  restarting = true;
  restartCount++;
  const delay = BASE_BACKOFF * restartCount;
  log(`🔁 Restart ${restartCount}/${MAX_RESTARTS} in ${delay / 1000}s...`);

  stopApp();
  setTimeout(() => {
    restarting = false;
    startApp();
  }, delay);
}

// ── Health check ──────────────────────────────────────────────────────────────
function healthCheck(callback) {
  const req = http.get(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: HEALTH_PATH,
      timeout: 4000,
    },
    (res) => callback(res.statusCode === 200)
  );
  req.on('error', () => callback(false));
  req.on('timeout', () => { req.destroy(); callback(false); });
}

function startHealthMonitor() {
  setInterval(() => {
    if (restarting) return;
    healthCheck((healthy) => {
      if (healthy) {
        restartCount = 0; // reset on confirmed healthy
        log('✅ Health OK');
      } else {
        log('💥 Health check failed — triggering restart');
        scheduleRestart();
      }
    });
  }, HEALTH_CHECK_INTERVAL);
}

// ── Memory watchdog ───────────────────────────────────────────────────────────
function startMemoryWatchdog() {
  setInterval(() => {
    const usedMB = process.memoryUsage().heapUsed / 1024 / 1024;
    log(`📊 Supervisor heap: ${usedMB.toFixed(1)} MB`);

    // Also check child process RSS via /proc if on Linux
    if (appProcess && appProcess.pid) {
      try {
        const fs = require('fs');
        const stat = fs.readFileSync(`/proc/${appProcess.pid}/status`, 'utf8');
        const vmRss = stat.match(/VmRSS:\s+(\d+)/);
        if (vmRss) {
          const childMB = parseInt(vmRss[1], 10) / 1024;
          log(`📊 App process RSS: ${childMB.toFixed(1)} MB`);
          if (childMB > MEMORY_LIMIT_MB) {
            log(`⚠️  App memory ${childMB.toFixed(0)} MB exceeds ${MEMORY_LIMIT_MB} MB — restarting`);
            scheduleRestart();
          }
        }
      } catch {
        // /proc not available (macOS/Windows) — skip
      }
    }
  }, MEMORY_CHECK_INTERVAL);
}

// ── Graceful supervisor shutdown ──────────────────────────────────────────────
process.on('SIGTERM', () => {
  log('🛑 Supervisor SIGTERM received — shutting down gracefully');
  stopApp();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('🛑 Supervisor SIGINT received — shutting down gracefully');
  stopApp();
  process.exit(0);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  log('🔍 Initializing FintekPro self-healing supervisor...');
  log(`   Mode:        ${IS_PROD ? 'production' : 'development'}`);
  log(`   Port:        ${PORT}`);
  log(`   Max retries: ${MAX_RESTARTS}`);

  validateEnv();
  startApp();

  setTimeout(() => {
    log('🩺 Starting health monitor...');
    startHealthMonitor();
    startMemoryWatchdog();
  }, STARTUP_GRACE);
}

init();
