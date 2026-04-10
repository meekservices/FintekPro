/**
 * FintekPro Self-Healing Supervisor
 *
 * Production-grade process monitor with:
 *  - HTTP health checks (/api/health)
 *  - Exponential-backoff auto-restart
 *  - Post-restart grace window (no false health-check loops)
 *  - Memory threshold watchdog with warn + restart tiers
 *  - Crash-pattern detection (filtered to genuine fatal signals)
 *  - Consecutive-health-check gate before resetting restart counter
 *  - MAX_RESTARTS alert via crash-event endpoint
 *  - ENV validation on startup
 */

const { spawn, execSync } = require('child_process');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_RESTARTS            = 10;
const HEALTH_CHECK_INTERVAL   = 15_000;   // ms between health probes once running
const STARTUP_GRACE           = 8_000;    // ms before the FIRST health check at boot
const RESTART_GRACE           = 12_000;   // ms to ignore health failures after each restart
const BASE_BACKOFF            = 3_000;    // ms × restart number = delay before re-launch
const MEMORY_CHECK_INTERVAL   = 30_000;   // ms between memory snapshots
const MEMORY_WARN_MB          = 500;      // log a warning at this RSS level
const MEMORY_LIMIT_MB         = 700;      // restart if RSS exceeds this
const HEALTHY_STREAK_REQUIRED = 3;        // consecutive healthy checks before resetting restartCount

const PORT        = parseInt(process.env.PORT || '5000', 10);
const IS_PROD     = process.env.NODE_ENV === 'production';
const HEALTH_PATH = '/api/health';

// ── State ─────────────────────────────────────────────────────────────────────
let appProcess    = null;
let appPgid       = null;     // process group id for full-tree kill
let restartCount  = 0;
let restarting    = false;
let lastStartTime = 0;        // epoch ms of last startApp() call — for restart grace
let healthyStreak = 0;        // consecutive passing health checks

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[SUPERVISOR] ${new Date().toISOString()} — ${msg}`);
}

// ── ENV validation ────────────────────────────────────────────────────────────
function validateEnv() {
  const required = IS_PROD ? ['PORT', 'DATABASE_URL', 'SESSION_SECRET'] : [];
  for (const key of required) {
    if (!process.env[key]) log(`⚠️  WARNING: ${key} is not set`);
  }
  if (!process.env.DATABASE_URL && !process.env.PRODUCTION_DATABASE_URL) {
    log('⚠️  WARNING: Neither DATABASE_URL nor PRODUCTION_DATABASE_URL is set');
  }
}

// ── Crash-pattern scanner ─────────────────────────────────────────────────────
// Only patterns that indicate the process is genuinely broken and needs a
// restart. EPIPE is intentionally excluded — it is a normal HTTP event that
// occurs when a client disconnects before the response finishes.
const CRASH_PATTERNS = [
  // Network / connectivity (fatal variants only)
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  // Database
  'DB timeout',
  'relation does not exist',
  'column does not exist',
  'connection terminated unexpectedly',
  'password authentication failed',
  'too many clients',
  // Node runtime
  'Cannot find module',
  'SyntaxError',
  'ReferenceError: Cannot access',
  'TypeError: Cannot read propert',
  'Error: listen EACCES',
  // Heap / memory
  'JavaScript heap out of memory',
  'FATAL ERROR: Reached heap limit',
  // TypeScript / tsx
  'TSError',
  'TS18007',
];

// ── Supervisor DB bridge (best-effort, non-blocking) ──────────────────────────
function reportCrashEvent(triggerMessage, context, isFatal = false) {
  const body = JSON.stringify({
    eventType: isFatal ? 'supervisor_fatal' : 'supervisor_restart',
    trigger: (triggerMessage || '').substring(0, 300),
    action: isFatal ? 'max_restarts_reached' : 'restart_scheduled',
    success: !isFatal,
    message: isFatal
      ? `Supervisor GAVE UP after ${MAX_RESTARTS} restarts — manual intervention required`
      : `Supervisor detected crash and scheduled restart #${restartCount + 1}`,
    context: context || 'supervisor',
  });

  const postReq = http.request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/internal/self-healing/crash-event',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 2000,
    },
    () => { /* fire-and-forget */ }
  );
  postReq.on('error', () => { /* silently ignore if app is down */ });
  postReq.write(body);
  postReq.end();
}

function scanForCrashPattern(line) {
  // Special handling for EADDRINUSE — hard-kill orphan then restart, not loop
  if (line.includes('EADDRINUSE')) {
    log('🔍 EADDRINUSE detected — hard-killing orphan server processes then restarting');
    reportCrashEvent('EADDRINUSE — port already in use', 'supervisor:port_conflict');
    hardKillServerProcesses();
    scheduleRestart();
    return;
  }

  for (const pattern of CRASH_PATTERNS) {
    if (line.includes(pattern)) {
      log(`🔍 Crash pattern detected: "${pattern}" — scheduling restart`);
      reportCrashEvent(line.trim(), `supervisor:pattern:${pattern}`);
      scheduleRestart();
      break;
    }
  }
}

// ── Hard-kill all tsx/server processes (pkill-based, not just tracked pid) ────
function hardKillServerProcesses() {
  const cmds = [
    `pkill -9 -f 'server/index.ts' 2>/dev/null || true`,
    `pkill -9 -f 'tsx.*server' 2>/dev/null || true`,
    `fuser -k ${PORT}/tcp 2>/dev/null || true`,
  ];
  for (const cmd of cmds) {
    try { execSync(cmd, { stdio: 'ignore' }); } catch { /* ignore */ }
  }
}

// ── Kill the tracked process group ───────────────────────────────────────────
function killProcessGroup(pgid, signal) {
  if (!pgid) return;
  try { process.kill(-pgid, signal); } catch { /* group already gone */ }
}

// ── Process management ────────────────────────────────────────────────────────
function getStartCommand() {
  return IS_PROD
    ? { cmd: 'node', args: ['dist/index.js'] }
    : { cmd: 'npm', args: ['run', 'dev'] };
}

function startApp() {
  if (restarting) return;

  hardKillServerProcesses();

  const { cmd, args } = getStartCommand();
  log(`🚀 Starting app: ${cmd} ${args.join(' ')}`);
  lastStartTime = Date.now();
  healthyStreak = 0;

  appProcess = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
    detached: true,   // own process group so we can kill all descendants
  });

  appPgid = appProcess.pid;

  appProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    scanForCrashPattern(data.toString());
  });

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
  const pgid = appPgid;
  appProcess = null;
  appPgid = null;

  log('🛑 Sending SIGTERM to process group...');
  killProcessGroup(pgid, 'SIGTERM');

  // Escalate to SIGKILL after 4s + hard pkill sweep
  setTimeout(() => {
    killProcessGroup(pgid, 'SIGKILL');
    hardKillServerProcesses();
  }, 4000);
}

function scheduleRestart() {
  if (restarting) return;

  if (restartCount >= MAX_RESTARTS) {
    log(`🔥 MAX RESTART LIMIT (${MAX_RESTARTS}) REACHED — manual intervention required`);
    // Best-effort alert to the DB / on-call webhook before giving up
    reportCrashEvent(
      `App failed to stay up after ${MAX_RESTARTS} restart attempts`,
      'supervisor:fatal',
      true
    );
    // Give the event 2s to POST before we exit
    setTimeout(() => process.exit(1), 2000);
    return;
  }

  restarting = true;
  healthyStreak = 0;
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
  let called = false;
  function done(result) {
    if (called) return;
    called = true;
    callback(result);
  }

  const req = http.get(
    { hostname: '127.0.0.1', port: PORT, path: HEALTH_PATH, timeout: 4000 },
    (res) => {
      res.resume(); // consume body so socket closes cleanly
      done(res.statusCode === 200);
    }
  );
  req.on('error', () => done(false));
  req.on('timeout', () => { req.destroy(); done(false); });
}

function startHealthMonitor() {
  setInterval(() => {
    if (restarting) return;

    // Do not act on failures during the post-restart grace window.
    // The app needs time to bind the port and complete boot before
    // we start treating failures as real crashes.
    const timeSinceStart = Date.now() - lastStartTime;
    const inGrace = timeSinceStart < RESTART_GRACE;

    healthCheck((healthy) => {
      if (healthy) {
        healthyStreak++;
        // Require several consecutive healthy checks before clearing the
        // restart counter — prevents a flapping app from resetting indefinitely.
        if (healthyStreak >= HEALTHY_STREAK_REQUIRED && restartCount > 0) {
          log(`✅ ${HEALTHY_STREAK_REQUIRED} consecutive healthy checks — resetting restart counter`);
          restartCount = 0;
        }
      } else {
        healthyStreak = 0;
        if (inGrace) {
          log(`⏳ Health check failed but within ${RESTART_GRACE / 1000}s restart grace (${Math.round(timeSinceStart / 1000)}s elapsed) — ignoring`);
        } else {
          log('💥 Health check failed — triggering restart');
          scheduleRestart();
        }
      }
    });
  }, HEALTH_CHECK_INTERVAL);
}

// ── Memory watchdog ───────────────────────────────────────────────────────────
function readAppGroupRssMB() {
  const fs = require('fs');
  let totalMB = 0;
  if (!appPgid) return 0;
  try {
    const pids = fs.readdirSync('/proc').filter(f => /^\d+$/.test(f));
    for (const pid of pids) {
      try {
        const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
        const procPgidMatch = status.match(/NSpgid:\s+(\d+)/);
        const vmRss = status.match(/VmRSS:\s+(\d+)/);
        if (procPgidMatch && parseInt(procPgidMatch[1]) === appPgid && vmRss) {
          totalMB += parseInt(vmRss[1], 10) / 1024;
        }
      } catch { /* process gone mid-scan */ }
    }
  } catch {
    // /proc not available (macOS/Windows) — skip
  }
  return totalMB;
}

function startMemoryWatchdog() {
  setInterval(() => {
    const appMB = readAppGroupRssMB();
    if (appMB > 0) {
      if (appMB > MEMORY_LIMIT_MB) {
        log(`🔴 App memory ${appMB.toFixed(0)} MB exceeds limit (${MEMORY_LIMIT_MB} MB) — restarting`);
        reportCrashEvent(`Memory limit exceeded: ${appMB.toFixed(0)} MB`, 'supervisor:memory');
        scheduleRestart();
      } else if (appMB > MEMORY_WARN_MB) {
        log(`⚠️  App memory ${appMB.toFixed(0)} MB approaching limit (warn=${MEMORY_WARN_MB} MB, limit=${MEMORY_LIMIT_MB} MB)`);
      } else {
        log(`📊 App memory: ${appMB.toFixed(0)} MB`);
      }
    }
  }, MEMORY_CHECK_INTERVAL);
}

// ── Graceful supervisor shutdown ──────────────────────────────────────────────
process.on('SIGTERM', () => {
  log('🛑 Supervisor SIGTERM — shutting down gracefully');
  stopApp();
  setTimeout(() => process.exit(0), 5000);
});

process.on('SIGINT', () => {
  log('🛑 Supervisor SIGINT — shutting down gracefully');
  stopApp();
  setTimeout(() => process.exit(0), 5000);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  log('🔍 Initializing FintekPro self-healing supervisor...');
  log(`   Mode:        ${IS_PROD ? 'production' : 'development'}`);
  log(`   Port:        ${PORT}`);
  log(`   Max retries: ${MAX_RESTARTS}`);
  log(`   Restart grace: ${RESTART_GRACE / 1000}s`);
  log(`   Healthy streak to reset counter: ${HEALTHY_STREAK_REQUIRED}`);

  validateEnv();
  startApp();

  setTimeout(() => {
    log('🩺 Starting health monitor...');
    startHealthMonitor();
    startMemoryWatchdog();
  }, STARTUP_GRACE);
}

init();
