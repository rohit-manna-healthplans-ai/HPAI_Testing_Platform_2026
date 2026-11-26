// Question bank accessor. The bank itself (questions.generated.js) is produced by `npm run build-bank` from question-bank/
// and is loaded LAZILY as its own chunk — never import it statically from eagerly-loaded modules (login, dashboards).
let bankPromise = null;

/** Loads (once) and returns the generated module: { BANK_VERSION, SUBJECTS, QUESTIONS }. */
export function loadBank() {
  if (!bankPromise) {
    bankPromise = import('./questions.generated.js').catch((err) => { bankPromise = null; throw err; });
  }
  return bankPromise;
}

let indexPromise = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = loadBank().then((m) => ({ ...m, byId: new Map(m.QUESTIONS.map((q) => [q.id, q])) }));
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

export const BANK_UPDATED_MESSAGE = 'The app was updated. Please refresh the page (Ctrl+F5) and continue — your progress is saved.';

/** Resolves ids to question objects, preserving order. Throws a clear error listing any missing ids. */
export async function getQuestionsByIds(ids) {
  const { byId } = await loadIndex();
  const out = []; const missing = [];
  for (const id of ids || []) { const q = byId.get(id); if (q) out.push(q); else missing.push(id); }
  if (missing.length) throw new Error(`${BANK_UPDATED_MESSAGE} (missing questions: ${missing.join(', ')})`);
  return out;
}

/** Returns one question or null. */
export async function getQuestionById(id) {
  const { byId } = await loadIndex();
  return byId.get(id) || null;
}

/** Returns the loaded bank version string. */
export async function getBankVersion() {
  return (await loadBank()).BANK_VERSION;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sealed answers. Every question in the bundle carries its PUBLIC fields in clear (statement, config without `correct`,
// `public_tests` = sample tests only, `test_count`) and a `sealed` blob = AES-256-GCM of { tests (all, incl. hidden/UI
// check sources), correct (MCQ) }. Keys are never in the bundle: the API releases them (a) to a candidate for the ids of
// their own in-progress attempt, (b) to an admin who re-enters their password. Without a key the answers cannot be read.
// ---------------------------------------------------------------------------------------------------------------------
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Decrypts one question's sealed payload and returns the FULL question (tests incl. hidden, config.correct for MCQ). */
export async function unsealQuestion(q, keyB64) {
  if (!q?.sealed) return q;
  if (!keyB64) throw new Error(`Missing key for question "${q.id}".`);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Secure context required: open the app over https (or localhost).');
  let payload;
  try {
    const key = await subtle.importKey('raw', b64(keyB64), 'AES-GCM', false, ['decrypt']);
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64(q.sealed.iv) }, key, b64(q.sealed.ct));
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error(`Could not unlock question "${q.id}". Please refresh the page and try again.`);
  }
  const { sealed: _sealed, public_tests: _pt, ...rest } = q; // eslint-disable-line no-unused-vars
  const config = { ...(q.config || {}) };
  if (payload.correct !== undefined) config.correct = payload.correct;
  return { ...rest, config, tests: payload.tests || [], revealed: true };
}

/** Full (unsealed) questions for an attempt, in order. bankKeys: { [questionId]: base64Key } from the attempt payload. */
export async function getRunnableQuestions(ids, bankKeys) {
  const pub = await getQuestionsByIds(ids);
  return Promise.all(pub.map((q) => unsealQuestion(q, bankKeys?.[q.id])));
}

/** Unseals every question you have a key for (admin reveal). Returns Map(id -> full question). */
export async function unsealAll(keys) {
  const { byId } = await loadIndex();
  const out = new Map();
  await Promise.all(Object.entries(keys || {}).map(async ([id, k]) => {
    const q = byId.get(id); if (q) out.set(id, await unsealQuestion(q, k));
  }));
  return out;
}
