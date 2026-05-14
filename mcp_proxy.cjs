const { spawn } = require('child_process');

const args = process.argv.slice(2);
const toolsIndex = args.indexOf('--tools');
const dashIndex = args.indexOf('--');

let allowedTools = null;
if (toolsIndex !== -1 && toolsIndex + 1 < args.length) {
  allowedTools = args[toolsIndex + 1].split(',');
}

let targetCommand = [];
if (dashIndex !== -1) {
  targetCommand = args.slice(dashIndex + 1);
} else {
  console.error('Usage: node mcp_proxy.cjs --tools tool1,tool2 -- command arg1 arg2');
  process.exit(1);
}

const child = spawn(targetCommand[0], targetCommand.slice(1), {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env
});

let buffer = '';

process.stdin.on('data', (data) => {
  child.stdin.write(data);
});

child.stdout.on('data', (data) => {
  buffer += data.toString();
  
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    
    if (line.trim()) {
      try {
        const json = JSON.parse(line);
        if (json.result && json.result.tools && allowedTools) {
          json.result.tools = json.result.tools.filter(t => allowedTools.includes(t.name));
          process.stdout.write(JSON.stringify(json) + '\n');
        } else {
          process.stdout.write(line + '\n');
        }
      } catch (e) {
        process.stdout.write(line + '\n');
      }
    } else {
      process.stdout.write(line + '\n');
    }
  }
});

child.on('exit', (code) => {
  process.exit(code);
});
