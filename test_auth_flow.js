const http = require('http');

async function run() {
  // We can't easily mock login without a DB and everything.
  // Let's just create an Express app that imports `registerAuthRoutes`
  // and see what it does.
}
