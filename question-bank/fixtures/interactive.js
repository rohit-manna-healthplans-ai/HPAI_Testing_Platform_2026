// DEV-ONLY fixtures for the interactive question types. They are NEVER part of the shipped bank: they exist so that the
// validators and unit tests can exercise the generator + marking code independently of the real content.
// Authored format (readable ids; the generator rewrites them into opaque ids).

export const fixtureSequence = {
  subject: 'ML Workflow (Drag & Drop)', type: 'sequence', difficulty: 'easy', title: 'Fixture: tiny regression pipeline',
  statement: 'Fixture statement.', marks: 10, time_mins: 3, tags: ['fixture'],
  config: {
    scenario: 'Predict a house price from its area. Arrange the steps.',
    stages: [{ id: 'data', label: 'Data' }, { id: 'clean', label: 'Clean' }, { id: 'split', label: 'Split' }, { id: 'model', label: 'Model' }, { id: 'evaluate', label: 'Evaluate' }],
    visual: { kind: 'none' },
    items: [
      { id: 'load', label: 'Load the dataset', detail: 'pd.read_csv("houses.csv")', stage: 'data' },
      { id: 'clean', label: 'Fix missing values', detail: 'fillna / dropna', stage: 'clean' },
      { id: 'enc', label: 'Encode categorical columns', detail: 'one-hot encoding', stage: 'clean' },
      { id: 'split', label: 'Split into train and test', detail: 'train_test_split', stage: 'split' },
      { id: 'scale', label: 'Scale numeric features (fit on train)', detail: 'StandardScaler', stage: 'split' },
      { id: 'fit', label: 'Fit the model', detail: 'LinearRegression().fit', stage: 'model' },
      { id: 'pred', label: 'Predict on the test set', detail: 'model.predict', stage: 'evaluate' },
      { id: 'eval', label: 'Compute RMSE and R2', detail: 'metrics', stage: 'evaluate' },
    ],
  },
  reference: {
    order: ['load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval'],
    constraints: [
      ['load', 'clean'], ['load', 'enc'], ['clean', 'split'], ['enc', 'scale'], ['split', 'scale'], ['clean', 'enc'],
      ['scale', 'fit'], ['split', 'fit'], ['fit', 'pred'], ['pred', 'eval'], ['scale', 'pred'],
    ],
  },
};

export const fixtureMatch = {
  subject: 'Cloud (AWS, Azure, GCP)', type: 'match', difficulty: 'easy', title: 'Fixture: match AWS services',
  statement: 'Fixture statement.', marks: 10, time_mins: 2, tags: ['fixture'],
  config: {
    scenario: 'Match each AWS service to what it does.',
    left: [
      { id: 'L1', label: 'Amazon S3', kind: 'storage', provider: 'aws' },
      { id: 'L2', label: 'Amazon EC2', kind: 'compute', provider: 'aws' },
      { id: 'L3', label: 'Amazon RDS', kind: 'db-sql', provider: 'aws' },
      { id: 'L4', label: 'Amazon CloudFront', kind: 'cdn', provider: 'aws' },
    ],
    right: [
      { id: 'R1', text: 'Object storage for files, images and backups' },
      { id: 'R2', text: 'Virtual servers you can resize' },
      { id: 'R3', text: 'Managed relational database' },
      { id: 'R4', text: 'Content delivery network that caches near users' },
      { id: 'R5', text: 'Message queue between services' },
    ],
  },
  reference: { pairs: { L1: 'R1', L2: 'R2', L3: 'R3', L4: 'R4' } },
};

export const fixtureArchitecture = {
  subject: 'Cloud (AWS, Azure, GCP)', type: 'architecture', difficulty: 'medium', title: 'Fixture: static website on AWS',
  statement: 'Fixture statement.', marks: 20, time_mins: 4, tags: ['fixture'],
  config: {
    provider: 'aws',
    scenario: 'Serve a static website globally with HTTPS and keep the files in cheap storage.',
    zones: [{ id: 'z1', label: 'Edge', x: 2, y: 5, w: 30, h: 90 }, { id: 'z2', label: 'Storage', x: 36, y: 5, w: 60, h: 90 }],
    palette: [
      { id: 'p1', label: 'Amazon CloudFront', kind: 'cdn', provider: 'aws' },
      { id: 'p2', label: 'Amazon S3', kind: 'storage', provider: 'aws' },
      { id: 'p3', label: 'Amazon Route 53', kind: 'dns', provider: 'aws' },
      { id: 'p4', label: 'Amazon EC2', kind: 'compute', provider: 'aws' },
      { id: 'p5', label: 'Amazon RDS', kind: 'db-sql', provider: 'aws' },
      { id: 'p6', label: 'Amazon SQS', kind: 'queue', provider: 'aws' },
    ],
    slots: [
      { id: 'a1', label: 'DNS', x: 6, y: 12, w: 22, h: 20 },
      { id: 'a2', label: 'CDN', x: 6, y: 42, w: 22, h: 20 },
      { id: 'a3', label: 'Static files', x: 52, y: 42, w: 28, h: 20 },
    ],
    links: [{ from: 'a1', to: 'a2', label: 'resolves' }, { from: 'a2', to: 'a3', label: 'origin' }],
  },
  reference: { solution: { a1: ['p3'], a2: ['p1'], a3: ['p2'] } },
};

export const fixtures = [fixtureSequence, fixtureMatch, fixtureArchitecture];
