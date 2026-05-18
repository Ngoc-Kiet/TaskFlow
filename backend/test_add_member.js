const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/projects/e69ca84e420f515a520f42f3/members',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.TEST_TOKEN
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
});

req.on('error', console.error);
req.write(JSON.stringify({ email: 'cuong@taskflow.com', role: 'member' }));
req.end();
