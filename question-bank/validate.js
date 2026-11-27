// Runs every validator in sequence (validate_*.js) and the unit tests (test_*.js) found in this folder.
// Usage: npm run validate
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => /^(validate_|test_).+\.js$/.test(f)).sort();
let failed = false;
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
console.log(failed ? '\nSEED VALIDATION FAILED' : '\nSEED VALIDATION OK');
process.exit(failed ? 1 : 0);
