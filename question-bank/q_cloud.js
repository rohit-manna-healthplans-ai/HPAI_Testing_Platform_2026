// Cloud (AWS / Azure / GCP) drag & drop questions: 4 architecture builders + 4 matching sets.
// Format: docs/INTERACTIVE_TYPES.md. Every question is a 2-4 minute task. `reference` is dev-only and never shipped.
// Public lists (palette / left / right) are deliberately in SHUFFLED order; the helpers below only assign ids in that order,
// so the ids carry no information about the answer. Icons are generic (chosen by `kind`), never official logos.
//
// NOTE: service names/descriptions are written in our own words; double-check them against the provider docs when editing.

const SUBJECT = 'Cloud (AWS, Azure, GCP)';

/** palette([[key,label,kind], ...], provider) -> { items:[{id,label,kind,provider}], id:{key:'pN'} } (ids follow the listed order). */
function palette(list, provider) {
  const id = {};
  const items = list.map(([key, label, kind], i) => {
    id[key] = `p${i + 1}`;
    return { id: id[key], label, kind, provider };
  });
  return { items, id };
}

/** matchSet(left, right, pairs) -> { left, right, pairs } ; left=[[key,label,kind,provider]], right=[[key,text]], pairs={leftKey:rightKey}. */
function matchSet(leftList, rightList, pairsByKey) {
  const lid = {}; const rid = {};
  const left = leftList.map(([key, label, kind, provider], i) => { lid[key] = `L${i + 1}`; return { id: lid[key], label, kind, provider }; });
  const right = rightList.map(([key, text], i) => { rid[key] = `R${i + 1}`; return { id: rid[key], text }; });
  const pairs = {};
  for (const [lk, rk] of Object.entries(pairsByKey)) {
    if (!lid[lk] || !rid[rk]) throw new Error(`matchSet: unknown key ${lk} -> ${rk}`);
    pairs[lid[lk]] = rid[rk];
  }
  return { left, right, pairs };
}

// ---------------------------------------------------------------------------------------------------------------------
// a) Host a static website on AWS (easy, 3 min)
const A = palette([
  ['rds', 'Amazon RDS', 'db-sql'],
  ['cf', 'Amazon CloudFront', 'cdn'],
  ['acm', 'AWS Certificate Manager', 'secrets'],
  ['eks', 'Amazon EKS', 'container'],
  ['s3', 'Amazon S3', 'storage'],
  ['r53', 'Amazon Route 53', 'dns'],
  ['ec2', 'Amazon EC2', 'compute'],
  ['cw', 'Amazon CloudWatch', 'monitoring'],
], 'aws');

const staticSite = {
  subject: SUBJECT,
  type: 'architecture',
  difficulty: 'easy',
  title: 'Host a static website on AWS',
  statement: 'Build the architecture for a company marketing website on **AWS**. Drag a service from the palette into each slot. Some services are not needed.',
  marks: 10,
  time_mins: 3,
  tags: ['aws', 'static-website', 'cdn', 'storage'],
  config: {
    provider: 'aws',
    scenario: 'The marketing site is plain HTML, CSS and images. Visitors worldwide must load it quickly over HTTPS on the company domain, nobody wants to manage servers, and the team needs basic alarms.',
    palette: A.items,
    zones: [
      { id: 'z1', label: 'Public edge', x: 2, y: 6, w: 60, h: 88 },
      { id: 'z2', label: 'Origin', x: 66, y: 6, w: 32, h: 88 },
    ],
    slots: [
      { id: 'a1', label: 'Domain name (DNS)', x: 6, y: 12, w: 18, h: 22 },
      { id: 'a2', label: 'Global content delivery (CDN)', x: 34, y: 12, w: 18, h: 22 },
      { id: 'a3', label: 'Website files (object storage)', x: 72, y: 12, w: 18, h: 22 },
      { id: 'a4', label: 'HTTPS certificate', x: 34, y: 62, w: 18, h: 22 },
      { id: 'a5', label: 'Metrics and alarms', x: 72, y: 62, w: 18, h: 22 },
    ],
    links: [
      { from: 'a1', to: 'a2', label: 'Routes visitors' },
      { from: 'a2', to: 'a3', label: 'Fetches files' },
      { from: 'a4', to: 'a2', label: 'Enables HTTPS' },
      { from: 'a2', to: 'a5', label: 'Reports metrics' },
    ],
  },
  reference: {
    solution: { a1: [A.id.r53], a2: [A.id.cf], a3: [A.id.s3], a4: [A.id.acm], a5: [A.id.cw] },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// b) Three-tier web app on Azure (medium, 4 min)
const B = palette([
  ['cosmos', 'Azure Cosmos DB', 'db-nosql'],
  ['appsvc', 'Azure App Service', 'compute'],
  ['redis', 'Azure Cache for Redis', 'cache'],
  ['agw', 'Azure Application Gateway', 'lb'],
  ['entra', 'Microsoft Entra ID', 'identity'],
  ['sql', 'Azure SQL Database', 'db-sql'],
  ['blob', 'Azure Blob Storage', 'storage'],
  ['sb', 'Azure Service Bus', 'queue'],
  ['vm', 'Azure Virtual Machines', 'compute'],
  ['mon', 'Azure Monitor', 'monitoring'],
  ['lb', 'Azure Load Balancer', 'lb'],
], 'azure');

const threeTier = {
  subject: SUBJECT,
  type: 'architecture',
  difficulty: 'medium',
  title: 'Three-tier web app on Azure',
  statement: 'Complete the three-tier architecture for a web app on **Azure** by dragging services into the slots. Some services are extras, and a slot can have more than one reasonable answer.',
  marks: 20,
  time_mins: 4,
  tags: ['azure', 'three-tier', 'web-app', 'database'],
  config: {
    provider: 'azure',
    scenario: 'An online booking portal needs a secure, scalable setup: web traffic is spread across servers, the app tier runs the business code, bookings live in a managed relational database, popular data is cached, uploaded documents are kept as files, users sign in with company accounts, and the team watches logs and metrics.',
    palette: B.items,
    zones: [
      { id: 'z1', label: 'Web tier', x: 2, y: 4, w: 30, h: 92 },
      { id: 'z2', label: 'App tier', x: 34, y: 4, w: 30, h: 92 },
      { id: 'z3', label: 'Data tier', x: 66, y: 4, w: 32, h: 92 },
    ],
    slots: [
      { id: 'b1', label: 'Load balancer for web traffic', x: 7, y: 14, w: 18, h: 22 },
      { id: 'b2', label: 'Application tier (runs the business code)', x: 40, y: 14, w: 18, h: 22 },
      { id: 'b3', label: 'Relational database', x: 72, y: 6, w: 18, h: 20 },
      { id: 'b4', label: 'In-memory cache for hot data', x: 72, y: 38, w: 18, h: 20 },
      { id: 'b5', label: 'File and document storage', x: 72, y: 70, w: 18, h: 20 },
      { id: 'b6', label: 'User sign-in and identity', x: 7, y: 62, w: 18, h: 22 },
      { id: 'b7', label: 'Monitoring and logs', x: 40, y: 62, w: 18, h: 22 },
    ],
    links: [
      { from: 'b1', to: 'b2', label: 'Routes requests' },
      { from: 'b2', to: 'b3', label: 'SQL queries' },
      { from: 'b2', to: 'b4', label: 'Cache lookups' },
      { from: 'b2', to: 'b5', label: 'Documents' },
      { from: 'b6', to: 'b2', label: 'Authenticates users' },
      { from: 'b2', to: 'b7', label: 'Logs and metrics' },
    ],
  },
  reference: {
    solution: {
      b1: [B.id.agw, B.id.lb],
      b2: [B.id.appsvc, B.id.vm],
      b3: [B.id.sql],
      b4: [B.id.redis],
      b5: [B.id.blob],
      b6: [B.id.entra],
      b7: [B.id.mon],
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// c) Serverless REST API on AWS (medium, 4 min)
const C = palette([
  ['rds', 'Amazon RDS', 'db-sql'],
  ['sqs', 'Amazon SQS', 'queue'],
  ['apigw', 'Amazon API Gateway', 'api-gateway'],
  ['ses', 'Amazon SES', 'email'],
  ['cog', 'Amazon Cognito', 'identity'],
  ['ddb', 'Amazon DynamoDB', 'db-nosql'],
  ['ec2', 'Amazon EC2', 'compute'],
  ['cw', 'Amazon CloudWatch', 'monitoring'],
  ['lambda', 'AWS Lambda', 'function'],
], 'aws');

const serverlessApi = {
  subject: SUBJECT,
  type: 'architecture',
  difficulty: 'medium',
  title: 'Serverless REST API on AWS',
  statement: 'Design a **serverless** REST API on **AWS**: drag the right service into every slot. Some services in the palette do not belong in this design.',
  marks: 20,
  time_mins: 4,
  tags: ['aws', 'serverless', 'api', 'nosql'],
  config: {
    provider: 'aws',
    scenario: 'A mobile app needs a REST API without managing servers. Requests arrive over HTTPS from signed-in users, small pieces of code handle each request and keep items in a key-value NoSQL table, slow work is handed to a queue so replies stay fast, and the team wants metrics and logs.',
    palette: C.items,
    zones: [
      { id: 'z1', label: 'Entry', x: 2, y: 4, w: 30, h: 92 },
      { id: 'z2', label: 'Compute', x: 34, y: 4, w: 22, h: 92 },
      { id: 'z3', label: 'Data and messaging', x: 58, y: 4, w: 40, h: 92 },
    ],
    slots: [
      { id: 'c1', label: 'API front door (REST endpoints)', x: 8, y: 12, w: 18, h: 22 },
      { id: 'c2', label: 'Code that runs per request (no servers)', x: 37, y: 30, w: 18, h: 22 },
      { id: 'c3', label: 'Key-value / NoSQL table', x: 68, y: 10, w: 18, h: 22 },
      { id: 'c4', label: 'Queue for slow background jobs', x: 68, y: 44, w: 18, h: 22 },
      { id: 'c5', label: 'User sign-in and tokens', x: 8, y: 62, w: 18, h: 22 },
      { id: 'c6', label: 'Metrics, logs and alarms', x: 37, y: 66, w: 18, h: 22 },
    ],
    links: [
      { from: 'c5', to: 'c1', label: 'Verifies callers' },
      { from: 'c1', to: 'c2', label: 'Invokes' },
      { from: 'c2', to: 'c3', label: 'Reads and writes items' },
      { from: 'c2', to: 'c4', label: 'Queues slow jobs' },
      { from: 'c2', to: 'c6', label: 'Logs and metrics' },
    ],
  },
  reference: {
    solution: { c1: [C.id.apigw], c2: [C.id.lambda], c3: [C.id.ddb], c4: [C.id.sqs], c5: [C.id.cog], c6: [C.id.cw] },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// d) Event data pipeline on GCP (medium, 4 min)
const D = palette([
  ['sql', 'Cloud SQL', 'db-sql'],
  ['bq', 'BigQuery', 'analytics'],
  ['dp', 'Dataproc', 'compute'],
  ['ce', 'Compute Engine', 'compute'],
  ['mon', 'Cloud Monitoring', 'monitoring'],
  ['pubsub', 'Pub/Sub', 'queue'],
  ['looker', 'Looker Studio', 'analytics'],
  ['gcs', 'Cloud Storage', 'storage'],
  ['armor', 'Cloud Armor', 'firewall'],
  ['df', 'Dataflow', 'compute'],
], 'gcp');

const dataPipeline = {
  subject: SUBJECT,
  type: 'architecture',
  difficulty: 'medium',
  title: 'Event data pipeline on GCP',
  statement: 'Build an event analytics pipeline on **Google Cloud** by dragging services into the slots. The palette has extras, and one slot accepts either of two processing services.',
  marks: 20,
  time_mins: 4,
  tags: ['gcp', 'data-pipeline', 'streaming', 'analytics'],
  config: {
    provider: 'gcp',
    scenario: 'Website click events must be collected continuously, processed as a stream, kept as raw files in case they need reprocessing, loaded into a warehouse for SQL analysis, and shown on dashboards, while the team watches the health of the pipeline.',
    palette: D.items,
    zones: [
      { id: 'z1', label: 'Ingest', x: 2, y: 4, w: 20, h: 92 },
      { id: 'z2', label: 'Process', x: 24, y: 4, w: 22, h: 92 },
      { id: 'z3', label: 'Store', x: 48, y: 4, w: 26, h: 92 },
      { id: 'z4', label: 'Analyse', x: 76, y: 4, w: 22, h: 92 },
    ],
    slots: [
      { id: 'd1', label: 'Event ingestion (messaging)', x: 4, y: 38, w: 16, h: 22 },
      { id: 'd2', label: 'Stream and batch processing', x: 26, y: 30, w: 18, h: 22 },
      { id: 'd3', label: 'Raw data lake (object storage)', x: 52, y: 12, w: 18, h: 22 },
      { id: 'd4', label: 'Analytics data warehouse', x: 52, y: 60, w: 18, h: 22 },
      { id: 'd5', label: 'Dashboards and reports', x: 80, y: 60, w: 16, h: 22 },
      { id: 'd6', label: 'Pipeline monitoring', x: 26, y: 66, w: 18, h: 22 },
    ],
    links: [
      { from: 'd1', to: 'd2', label: 'Events' },
      { from: 'd2', to: 'd3', label: 'Raw copy' },
      { from: 'd2', to: 'd4', label: 'Clean data' },
      { from: 'd4', to: 'd5', label: 'Queries' },
      { from: 'd2', to: 'd6', label: 'Metrics' },
    ],
  },
  reference: {
    solution: { d1: [D.id.pubsub], d2: [D.id.df, D.id.dp], d3: [D.id.gcs], d4: [D.id.bq], d5: [D.id.looker], d6: [D.id.mon] },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// e) Match the core AWS services (easy, 3 min)
const E = matchSet(
  [
    ['sqs', 'Amazon SQS', 'queue', 'aws'],
    ['iam', 'AWS IAM', 'identity', 'aws'],
    ['s3', 'Amazon S3', 'storage', 'aws'],
    ['cw', 'Amazon CloudWatch', 'monitoring', 'aws'],
    ['lambda', 'AWS Lambda', 'function', 'aws'],
    ['rds', 'Amazon RDS', 'db-sql', 'aws'],
    ['vpc', 'Amazon VPC', 'network', 'aws'],
    ['ec2', 'Amazon EC2', 'compute', 'aws'],
  ],
  [
    ['ec2', 'Rents resizable virtual servers that you configure and manage'],
    ['dns', 'Translates domain names into IP addresses'], // distractor (Route 53)
    ['iam', 'Controls who can access which resources using users, roles and policies'],
    ['sqs', 'A message queue that lets parts of an application work independently'],
    ['vpc', 'Your own private, isolated network inside the cloud'],
    ['s3', 'Stores files, images and backups as objects in buckets'],
    ['cw', 'Collects metrics, logs and alarms so you can monitor your systems'],
    ['rds', 'Managed relational databases such as MySQL and PostgreSQL'],
    ['lambda', 'Runs your code in response to events without managing servers'],
  ],
  { sqs: 'sqs', iam: 'iam', s3: 's3', cw: 'cw', lambda: 'lambda', rds: 'rds', vpc: 'vpc', ec2: 'ec2' },
);

const matchAws = {
  subject: SUBJECT,
  type: 'match',
  difficulty: 'easy',
  title: 'Match the core AWS services',
  statement: 'Drag each **AWS service** onto the description that fits it best. A description can be used once, and one description is an extra.',
  marks: 10,
  time_mins: 3,
  tags: ['aws', 'basics', 'services'],
  config: { scenario: 'You are learning the everyday building blocks of Amazon Web Services.', left: E.left, right: E.right },
  reference: { pairs: E.pairs },
};

// ---------------------------------------------------------------------------------------------------------------------
// f) Match the core Azure services (easy, 3 min)
const F = matchSet(
  [
    ['sb', 'Azure Service Bus', 'queue', 'azure'],
    ['vm', 'Azure Virtual Machines', 'compute', 'azure'],
    ['entra', 'Microsoft Entra ID', 'identity', 'azure'],
    ['blob', 'Azure Blob Storage', 'storage', 'azure'],
    ['mon', 'Azure Monitor', 'monitoring', 'azure'],
    ['fn', 'Azure Functions', 'function', 'azure'],
    ['vnet', 'Azure Virtual Network', 'network', 'azure'],
    ['sql', 'Azure SQL Database', 'db-sql', 'azure'],
  ],
  [
    ['sql', 'Fully managed relational database built on SQL Server technology'],
    ['fn', 'Runs small pieces of code on demand without server management'],
    ['blob', 'Stores images, videos and backups as unstructured data'],
    ['aks', 'Hosts a managed Kubernetes cluster for containers'], // distractor (AKS)
    ['entra', 'Cloud identity service for sign-in, users, groups and access'],
    ['vnet', 'A private network where your Azure resources communicate securely'],
    ['sb', 'Messaging with queues and topics that connects applications'],
    ['vm', 'Virtual machines with the operating system you choose'],
    ['mon', 'Collects and analyzes metrics, logs and alerts from your applications'],
  ],
  { sb: 'sb', vm: 'vm', entra: 'entra', blob: 'blob', mon: 'mon', fn: 'fn', vnet: 'vnet', sql: 'sql' },
);

const matchAzure = {
  subject: SUBJECT,
  type: 'match',
  difficulty: 'easy',
  title: 'Match the core Azure services',
  statement: 'Drag each **Azure service** onto the description that fits it best. A description can be used once, and one description is an extra.',
  marks: 10,
  time_mins: 3,
  tags: ['azure', 'basics', 'services'],
  config: { scenario: 'You are learning the everyday building blocks of Microsoft Azure.', left: F.left, right: F.right },
  reference: { pairs: F.pairs },
};

// ---------------------------------------------------------------------------------------------------------------------
// g) Match the core GCP services (easy, 3 min)
const G = matchSet(
  [
    ['iam', 'Cloud IAM', 'identity', 'gcp'],
    ['pubsub', 'Pub/Sub', 'queue', 'gcp'],
    ['cf', 'Cloud Functions', 'function', 'gcp'],
    ['gcs', 'Cloud Storage', 'storage', 'gcp'],
    ['sql', 'Cloud SQL', 'db-sql', 'gcp'],
    ['vpc', 'VPC network', 'network', 'gcp'],
    ['mon', 'Cloud Monitoring', 'monitoring', 'gcp'],
    ['ce', 'Compute Engine', 'compute', 'gcp'],
  ],
  [
    ['mon', 'Dashboards, metrics and alerts for your cloud services'],
    ['iam', 'Defines who can do what on which cloud resources'],
    ['bq', 'Serverless data warehouse for large-scale SQL analytics'], // distractor (BigQuery)
    ['vpc', 'A private global network for your cloud resources'],
    ['ce', 'Virtual machines that you configure on Google infrastructure'],
    ['gcs', 'Object storage for files, media and backups in buckets'],
    ['pubsub', 'Asynchronous messaging that delivers events between services'],
    ['sql', 'Managed MySQL, PostgreSQL and SQL Server databases'],
    ['cf', 'Runs event-driven code without provisioning servers'],
  ],
  { iam: 'iam', pubsub: 'pubsub', cf: 'cf', gcs: 'gcs', sql: 'sql', vpc: 'vpc', mon: 'mon', ce: 'ce' },
);

const matchGcp = {
  subject: SUBJECT,
  type: 'match',
  difficulty: 'easy',
  title: 'Match the core GCP services',
  statement: 'Drag each **Google Cloud service** onto the description that fits it best. A description can be used once, and one description is an extra.',
  marks: 10,
  time_mins: 3,
  tags: ['gcp', 'basics', 'services'],
  config: { scenario: 'You are learning the everyday building blocks of Google Cloud.', left: G.left, right: G.right },
  reference: { pairs: G.pairs },
};

// ---------------------------------------------------------------------------------------------------------------------
// h) Same job, different cloud (medium, 4 min)
const H = matchSet(
  [
    ['cf', 'Amazon CloudFront', 'cdn', 'aws'],
    ['sqs', 'Amazon SQS', 'queue', 'aws'],
    ['s3', 'Amazon S3', 'storage', 'aws'],
    ['ddb', 'Amazon DynamoDB', 'db-nosql', 'aws'],
    ['ec2', 'Amazon EC2', 'compute', 'aws'],
    ['lambda', 'AWS Lambda', 'function', 'aws'],
  ],
  [
    ['ddb', 'Azure Cosmos DB / Google Cloud Firestore'],
    ['lambda', 'Azure Functions / Google Cloud Functions'],
    ['secrets', 'Azure Key Vault / Google Secret Manager'], // distractor (secrets management)
    ['s3', 'Azure Blob Storage / Google Cloud Storage'],
    ['cf', 'Azure Front Door / Google Cloud CDN'],
    ['sqldb', 'Azure SQL Database / Google Cloud SQL'], // distractor (managed relational database)
    ['sqs', 'Azure Queue Storage / Google Pub/Sub'],
    ['ec2', 'Azure Virtual Machines / Google Compute Engine'],
  ],
  { cf: 'cf', sqs: 'sqs', s3: 's3', ddb: 'ddb', ec2: 'ec2', lambda: 'lambda' },
);

const sameJob = {
  subject: SUBJECT,
  type: 'match',
  difficulty: 'medium',
  title: 'Same job, different cloud',
  statement: 'Each **AWS service** has a closest equivalent on **Azure and Google Cloud**. Drag every AWS service onto its equivalent pair. Two of the options are extras.',
  marks: 20,
  time_mins: 4,
  tags: ['multi-cloud', 'aws', 'azure', 'gcp', 'equivalents'],
  config: { scenario: 'Your team is moving a workload from AWS to another cloud and needs to find the matching services.', left: H.left, right: H.right },
  reference: { pairs: H.pairs },
};

export const cloud = [staticSite, threeTier, serverlessApi, dataPipeline, matchAws, matchAzure, matchGcp, sameJob];
