-- Questions/subjects moved out of the database into code (question-bank/). Idempotent: a no-op on fresh databases.
DO $$
BEGIN
  -- proctor_subjects.subject_id: uuid FK -> text slug. Old uuid assignments are meaningless now, so they are cleared.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'proctor_subjects' AND column_name = 'subject_id' AND data_type = 'uuid') THEN
    TRUNCATE proctor_subjects;
    ALTER TABLE proctor_subjects DROP CONSTRAINT IF EXISTS proctor_subjects_subject_id_fkey;
    ALTER TABLE proctor_subjects ALTER COLUMN subject_id TYPE text USING subject_id::text;
  END IF;

  -- answers.question_id: uuid FK -> text id (kept as-is; legacy rows simply no longer resolve in the catalog).
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'answers' AND column_name = 'question_id' AND data_type = 'uuid') THEN
    ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
    ALTER TABLE answers ALTER COLUMN question_id TYPE text USING question_id::text;
  END IF;
END $$;

DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
