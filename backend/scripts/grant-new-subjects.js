// Grants the v1.1 subjects ("mlflow" ML Workflow, "cloud" Cloud) to EVERY proctor. Idempotent.
//
//   npm run grant-new-subjects            dry-run: prints what would change, writes nothing
//   npm run grant-new-subjects -- --apply writes the missing proctor_subjects rows
//
// RUN IT ONLY AFTER the new backend (with the v1.1 catalog) is live: an older API that does not know these subject ids
// would fail on proctors whose subject list contains them. Safe to re-run; existing rows are never touched.
import { query, tx, getPool } from '../src/db.js';
import { SUBJECTS } from '../src/catalog.js';

const NEW_SUBJECTS = ['mlflow', 'cloud'];
const apply = process.argv.includes('--apply');

const known = new Set(SUBJECTS.map((s) => s.id));
const unknown = NEW_SUBJECTS.filter((s) => !known.has(s));
if (unknown.length) {
  console.error(`The catalog does not contain: ${unknown.join(', ')}. Run "npm run build-bank" in question-bank/ and redeploy first.`);
  process.exit(1);
}

try {
  const proctors = (await query("SELECT id FROM users WHERE role='proctor'")).rows.map((r) => r.id);
  const have = new Set((await query('SELECT proctor_id, subject_id FROM proctor_subjects WHERE subject_id = ANY($1::text[])', [NEW_SUBJECTS])).rows
    .map((r) => `${r.proctor_id}|${r.subject_id}`));
  const missing = [];
  for (const id of proctors) for (const s of NEW_SUBJECTS) if (!have.has(`${id}|${s}`)) missing.push([id, s]);

  console.log(`proctors: ${proctors.length}; subjects: ${NEW_SUBJECTS.join(', ')}; rows to add: ${missing.length}`);
  if (!apply) {
    console.log('DRY RUN - nothing written. Re-run with --apply (after the new backend is live) to grant them.');
  } else if (!missing.length) {
    console.log('Nothing to do: every proctor already has these subjects.');
  } else {
    const added = await tx(async (c) => {
      const r = await c.query(
        'INSERT INTO proctor_subjects (proctor_id, subject_id) SELECT * FROM unnest($1::uuid[], $2::text[]) ON CONFLICT DO NOTHING',
        [missing.map((m) => m[0]), missing.map((m) => m[1])]);
      await c.query("INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta) VALUES (NULL, 'proctor.grant_subjects', 'subject', NULL, $1)",
        [JSON.stringify({ subjects: NEW_SUBJECTS, rows: r.rowCount, via: 'grant-new-subjects script' })]);
      return r.rowCount;
    });
    console.log(`Granted: ${added} row(s).`);
  }
} finally {
  await getPool().end().catch(() => {});
}
