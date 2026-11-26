// Runs every validator in sequence. Usage: npm run validate-seed
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
let failed = false;
for (const f of ['validate_coding.js', 'validate_other.js']) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
console.log(failed ? '\nSEED VALIDATION FAILED' : '\nSEED VALIDATION OK');
process.exit(failed ? 1 : 0);
