// Combined question bank. Every question gets a STABLE id: `<subject slug>-<difficulty>-<slug(title)>`.
// Dev-only `reference` fields are kept here for the validators and are NEVER emitted by build.js.
import { coding } from './q_coding.js';
import { sql, nosql, ui, mcq } from './q_other.js';
import { coding2 } from './q_coding2.js';
import { ml } from './q_ml.js';
import { cloud } from './q_cloud.js';

export const subjects = [
  { id: 'dsa', name: 'Programming (DSA)', description: 'Data structures & algorithms problems in Python / JavaScript with multiple test cases and partial marking.' },
  { id: 'sql', name: 'SQL', description: 'Relational queries (SQLite dialect) validated against multiple datasets.' },
  { id: 'nosql', name: 'NoSQL (MongoDB)', description: 'MongoDB-style find and aggregation pipelines.' },
  { id: 'ui', name: 'Quick Dev (UI Debug)', description: 'Fix a broken UI with live preview; behaviour is verified by automated checks.' },
  { id: 'aiml', name: 'AI/ML', description: 'Scenario-based multiple-choice questions on applied machine learning.' },
  { id: 'mlflow', name: 'ML Workflow (Drag & Drop)', description: 'Arrange the steps of a machine-learning pipeline in the right order, with visuals.' },
  { id: 'cloud', name: 'Cloud (AWS, Azure, GCP)', description: 'Drag and drop services to design a simple architecture, or match services to what they do.' },
];

export const slug = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const bySubjectName = new Map(subjects.map((s) => [s.name, s]));

export const questions = [...coding, ...coding2, ...sql, ...nosql, ...ui, ...mcq, ...ml, ...cloud].map((q) => {
  const subject = bySubjectName.get(q.subject);
  if (!subject) throw new Error(`Unknown subject "${q.subject}" on question "${q.title}"`);
  return { ...q, id: `${subject.id}-${q.difficulty}-${slug(q.title)}`, subject_id: subject.id };
});

const seen = new Set();
for (const q of questions) {
  if (seen.has(q.id)) throw new Error(`Duplicate question id: ${q.id}`);
  seen.add(q.id);
}
