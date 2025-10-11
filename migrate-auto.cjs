const { spawn } = require('child_process');

// Run drizzle-kit push with automatic responses
const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

let promptCount = 0;

// Auto-respond to any prompts with Enter key (select default option)
const interval = setInterval(() => {
  if (promptCount < 20) {  // Safety limit
    child.stdin.write('\n');
    promptCount++;
  }
}, 500);

child.on('close', (code) => {
  clearInterval(interval);
  console.log(`\nMigration process exited with code ${code}`);
  process.exit(code);
});

child.on('error', (err) => {
  clearInterval(interval);
  console.error('Failed to start migration:', err);
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  clearInterval(interval);
  child.kill();
  console.error('\nMigration timed out');
  process.exit(1);
}, 30000);
