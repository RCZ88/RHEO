const { execSync } = require('child_process');
try {
  execSync('npx vite build', { cwd: process.cwd(), stdio: 'inherit' });
  console.log('\n=== BUILD EXIT CODE: 0 (success) ===');
} catch (e) {
  console.log(`\n=== BUILD EXIT CODE: ${e.status} (failed) ===`);
  process.exit(e.status ?? 1);
}
