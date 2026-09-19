const { spawn } = require('child_process');
const child = spawn('node_modules/.bin/electron', ['.', '--remote-debugging-port=9222'], {
  cwd: process.cwd(),
  detached: true,
  stdio: ['ignore', 'ignore', 'ignore'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});
child.unref();
console.log('SPAWNED:', child.pid);
