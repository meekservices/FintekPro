const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/user',
  method: 'GET',
  headers: {
    // We can't easily mock an authenticated session without cookie.
  }
};

// ... we can't do this easily.
