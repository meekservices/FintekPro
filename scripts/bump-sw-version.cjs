#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'client', 'public', 'sw.js');

function bumpVersion() {
  try {
    let content = fs.readFileSync(SW_PATH, 'utf8');
    
    const versionMatch = content.match(/const VERSION = '(\d+)'/);
    if (!versionMatch) {
      console.error('Could not find VERSION constant in sw.js');
      process.exit(1);
    }
    
    const currentVersion = parseInt(versionMatch[1], 10);
    const newVersion = currentVersion + 1;
    const newTimestamp = Date.now().toString();
    
    content = content.replace(
      /const VERSION = '\d+'/,
      `const VERSION = '${newVersion}'`
    );
    
    content = content.replace(
      /const BUILD_TIMESTAMP = '\d+'/,
      `const BUILD_TIMESTAMP = '${newTimestamp}'`
    );
    
    fs.writeFileSync(SW_PATH, content, 'utf8');
    
    console.log(`Service Worker version bumped: v${currentVersion} -> v${newVersion}`);
    console.log(`Build timestamp: ${newTimestamp}`);
    console.log(`Cache names will be: fintekpro-static-v${newVersion}, fintekpro-dynamic-v${newVersion}`);
    
  } catch (error) {
    console.error('Error bumping service worker version:', error.message);
    process.exit(1);
  }
}

bumpVersion();
