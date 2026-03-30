/**
 * FintekPro Self-Healing Supervisor
 *
 * Production-grade process monitor with:
 *  - HTTP health checks (/healthz)
 *  - Exponential-backoff auto-restart
 *  - Memory threshold watchdog (500 MB)
 *  - Crash-pattern detection (ECONNREFUSED, DB timeout)
 *  - ENV validation on startup
 *
 * Usage (Replit workflow or Railway override):
 *   node supervisor.cjs
 */

const { spawn, execSync } = require('child_process');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_RESTARTS          = 10;
const HEALTH_CHECK_INTERVAL = 15_000;   // ms between checks once running
const STARTUP_GRACE         = 8_000;    // ms to wait before first health check
const BASE_BACKOFF          = 3_000;    // ms — multiplied by attempt number
const MEMORY_CHECK_INTERVAL = 30_000;   // ms between memory snapshots
const MEMORY_LIMIT_MB       = 700;      // restart if RSS exceeds this

const PORT         = parseInt(process.env.PORT || '5000', 10);
const IS_PROD      = process.env.NODE_ENV === 'production';
const HEALTH_PATH  = '/healthz';

// ── State ─────────────────────────────────────────────────────────────────────
let appProcess    = null;
let appPgid       = null;   // process group ID for full-tree kill
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
// NOTE: EADDRINUSE is handled separately below — do NOT add it here
// or it creates a restart loop when a previous process still holds the port.
const CRASH_PATTERNS = [
  'ECONNREFUSED',
  'DB timeout',
  'Cannot find module',
  'SyntaxError',
  'Error: listen EACCES',
];

function scanForCrashPattern(line) {
  // Special handling for EADDRINUSE — hard-kill then restart, don't loop
  if (line.includes('EADDRINUSE')) {
    log('🔍 EADDRINUSE detected — hard-killing orphan server processes then restarting');
    hardKillServerProcesses();
    scheduleRestart();
    return;
  }

  for (const pattern of CRASH_PATTERNS) {
    if (line.includes(pattern)) {
      log(`🔍 Crash pattern detected: "${pattern}" — scheduling restart`);
      scheduleRestart();
      break;
    }
  }
}

// ── Hard-kill all tsx/server processes (pkill-based, not just the tracked pid) ─
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
  try {
    process.kill(-pgid, signal);
  } catch {
    // process group already gone
  }
}

// ── Process management ────────────────────────────────────────────────────────
function getStartCommand() {
  if (IS_PROD) {
    return { cmd: 'node', args: ['dist/index.js'] };
  }
  return { cmd: 'npm', args: ['run', 'dev'] };
}

function startApp() {
  if (restarting) return;

  // Ensure port is free before binding
  hardKillServerProcesses();

  const { cmd, args } = getStartCommand();
  log(`🚀 Starting app: ${cmd} ${args.join(' ')}`);

  appProcess = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
    detached: true,   // creates its own process group so we can kill all descendants
  });

  appPgid = appProcess.pid; // process group id == pid when detached:true

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
  const pgid = appPgid;
  appProcess = null;
  appPgid = null;

  log('🛑 Sending SIGTERM to process group...');
  killProcessGroup(pgid, 'SIGTERM');

  // After 4s, escalate to SIGKILL for the whole group + hard pkill
  setTimeout(() => {
    killProcessGroup(pgid, 'SIGKILL');
    hardKillServerProcesses();
  }, 4000);
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

    if (appPgid) {
      try {
        // Sum RSS of all processes in the group via /proc
        const fs = require('fs');
        let totalMB = 0;
        const pids = fs.readdirSync('/proc').filter(f => /^\d+$/.test(f));
        for (const pid of pids) {
          try {
            const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
            const pgidLine = status.match(/NSpgid:\s+(\d+)|Tgid:\s+(\d+)/);
            const vmRss = status.match(/VmRSS:\s+(\d+)/);
            // Only count if same process group
            const procPgidMatch = status.match(/NSpgid:\s+(\d+)/);
            if (procPgidMatch && parseInt(procPgidMatch[1]) === appPgid && vmRss) {
              totalMB += parseInt(vmRss[1], 10) / 1024;
            }
          } catch { /* process gone */ }
        }
        if (totalMB > 0) {
          log(`📊 App group RSS: ${totalMB.toFixed(0)} MB`);
          if (totalMB > MEMORY_LIMIT_MB) {
            log(`⚠️  App memory ${totalMB.toFixed(0)} MB exceeds ${MEMORY_LIMIT_MB} MB — restarting`);
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
  setTimeout(() => process.exit(0), 5000);
});

process.on('SIGINT', () => {
  log('🛑 Supervisor SIGINT received — shutting down gracefully');
  stopApp();
  setTimeout(() => process.exit(0), 5000);
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
