// ML Workflow (drag & drop `sequence`) questions - ORIGINAL scenarios, healthcare-claims / facilities flavour.
// Contract: docs/INTERACTIVE_TYPES.md. `reference` (canonical order + precedence constraints) is dev-only and never emitted.
//
// Scoring unit = one precedence constraint [a, b]: step a must come BEFORE step b (both placed). Constraints deliberately do NOT
// force a single total order where the field accepts alternatives (e.g. encoding before or after the split).
// Item ids are semantic (not numbered) so they reveal nothing about the order; the PUBLIC item order is a fixed shuffle.

const STAGES_PIPELINE = [
  { id: 'data', label: 'Data' },
  { id: 'clean', label: 'Clean' },
  { id: 'features', label: 'Features' },
  { id: 'split', label: 'Split' },
  { id: 'model', label: 'Model' },
  { id: 'evaluate', label: 'Evaluate' },
  { id: 'deploy', label: 'Ship' },
];

// tiny deterministic PRNG so the generated chart data is identical on every build
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const arrange = (items, perm) => perm.map((i) => items[i]);

// ---------- visual data ----------
function housePoints() {
  const rnd = prng(20261127);
  const pts = [];
  for (let i = 0; i < 25; i += 1) {
    const size = Math.round((650 + rnd() * 1700) / 10) * 10;
    const noise = (rnd() + rnd() + rnd() - 1.5) * 16; // roughly bell-shaped
    pts.push([size, round(18 + 0.052 * size + noise, 1)]);
  }
  return pts;
}
function fitLine(points) {
  const n = points.length;
  const sx = points.reduce((s, p) => s + p[0], 0);
  const sy = points.reduce((s, p) => s + p[1], 0);
  const sxx = points.reduce((s, p) => s + p[0] * p[0], 0);
  const sxy = points.reduce((s, p) => s + p[0] * p[1], 0);
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { m: round(m, 4), b: round((sy - m * sx) / n, 2) };
}
const points = housePoints();

const epochs = Array.from({ length: 20 }, (_, i) => i + 1);
const trainLoss = epochs.map((e) => round(1.9 * Math.exp(-0.22 * e) + 0.18, 3));
const valLoss = epochs.map((e) => round(2.0 * Math.exp(-0.2 * e) + 0.26 + 0.012 * Math.pow(Math.max(0, e - 11), 1.3), 3));

// ---------- 1. Linear regression ----------
const regItems = [
  { id: 'load', label: 'Import libraries and load the dataset', detail: "import pandas as pd; df = pd.read_csv('properties.csv')", stage: 'data' },
  { id: 'explore', label: 'Explore the data', detail: 'df.head(), df.info(), df.describe() and a size-vs-price scatter plot', stage: 'data' },
  { id: 'clean', label: 'Handle missing values and duplicates', detail: 'Fill or drop empty cells and remove repeated rows', stage: 'clean' },
  { id: 'outliers', label: 'Inspect and treat outliers', detail: 'Spot extreme prices with a box plot, then cap or remove them', stage: 'clean' },
  { id: 'encode', label: 'Encode the categorical columns', detail: 'One-hot encode columns such as neighbourhood or property type', stage: 'features' },
  { id: 'xy', label: 'Define the features (X) and the target (y)', detail: 'X = every column except price, y = price', stage: 'features' },
  { id: 'split', label: 'Split into train and test sets', detail: 'train_test_split(X, y, test_size=0.2, random_state=42)', stage: 'split' },
  { id: 'scale', label: 'Scale the numeric features', detail: 'Fit the scaler on the training data only, then transform both sets', stage: 'features' },
  { id: 'train', label: 'Train the linear regression model', detail: 'model = LinearRegression().fit(X_train, y_train)', stage: 'model' },
  { id: 'predict', label: 'Predict on the test set', detail: 'y_pred = model.predict(X_test)', stage: 'model' },
  { id: 'evaluate', label: 'Evaluate the predictions', detail: 'Compute MAE, RMSE and R-squared against y_test', stage: 'evaluate' },
  { id: 'save', label: 'Inspect residuals and coefficients, then save the model', detail: "Plot the residuals, read the coefficients, joblib.dump(model, 'price_model.pkl')", stage: 'deploy' },
];
const regCanonical = regItems.map((i) => i.id);

// ---------- 2. Classification ----------
const clsItems = [
  { id: 'load', label: 'Import libraries and load the claims data', detail: "df = pd.read_csv('claims.csv') with billed amount, procedure code, plan type and decision", stage: 'data' },
  { id: 'explore', label: 'Explore the data and check the class balance', detail: "df['decision'].value_counts() shows how many claims were denied versus approved", stage: 'data' },
  { id: 'clean', label: 'Handle missing values and duplicates', detail: 'Impute or drop empty fields and remove repeated claim rows', stage: 'clean' },
  { id: 'encode', label: 'Encode the categorical features', detail: 'One-hot encode procedure type, provider network and plan type', stage: 'features' },
  { id: 'xy', label: 'Define the features (X) and the target (y)', detail: 'y = decision (denied / approved), X = all the other columns', stage: 'features' },
  { id: 'split', label: 'Make a stratified train/test split', detail: 'train_test_split(..., stratify=y) keeps the denied share equal in both sets', stage: 'split' },
  { id: 'scale', label: 'Scale the numeric features', detail: 'Fit the scaler on the training data only, then transform train and test', stage: 'features' },
  { id: 'imbalance', label: 'Handle the class imbalance on the training set only', detail: 'Use class weights or SMOTE on X_train and y_train; never touch the test set', stage: 'features' },
  { id: 'train', label: 'Train the classifier', detail: "clf = LogisticRegression(class_weight='balanced').fit(X_train, y_train)", stage: 'model' },
  { id: 'predict', label: 'Predict on the test set', detail: 'Get labels with predict() and probabilities with predict_proba()', stage: 'model' },
  { id: 'evaluate', label: 'Evaluate with a confusion matrix, precision, recall and F1', detail: 'Compare with y_test; accuracy alone hides weak detection of denied claims', stage: 'evaluate' },
  { id: 'tune', label: 'Tune the decision threshold and save the model', detail: 'Pick the probability cut-off that balances precision and recall, then save the model', stage: 'deploy' },
];
const clsCanonical = clsItems.map((i) => i.id);

// ---------- 3. Gradient descent ----------
const gdStages = [
  { id: 'setup', label: 'Setup' },
  { id: 'forward', label: 'Forward' },
  { id: 'loss', label: 'Loss' },
  { id: 'backward', label: 'Gradients' },
  { id: 'update', label: 'Update' },
  { id: 'check', label: 'Check' },
  { id: 'finish', label: 'Finish' },
];
const gdItems = [
  { id: 'init', label: 'Initialise the weights and bias', detail: 'Start from small random numbers (or zeros) and choose a learning rate', stage: 'setup' },
  { id: 'forward', label: 'Run a forward pass', detail: 'Compute the predictions y_hat = X.w + b for the training batch', stage: 'forward' },
  { id: 'loss', label: 'Compute the loss', detail: 'Measure the error, for example mean squared error between y_hat and y', stage: 'loss' },
  { id: 'grads', label: 'Compute the gradients', detail: 'Find how the loss changes with each weight (d loss / d w)', stage: 'backward' },
  { id: 'update', label: 'Update the weights', detail: 'w = w - learning_rate * gradient', stage: 'update' },
  { id: 'validate', label: 'Evaluate on the validation data', detail: 'Measure the loss on data the model was not trained on', stage: 'check' },
  { id: 'repeat', label: 'Check convergence and start the next epoch', detail: 'While the loss is still improving, go back and repeat the loop', stage: 'check' },
  { id: 'keep', label: 'Stop and keep the best weights', detail: 'Return the weights from the epoch with the lowest validation loss', stage: 'finish' },
];
const gdCanonical = gdItems.map((i) => i.id);

// ---------- 4. Train / validation / test ----------
const ttvStages = [
  { id: 'data', label: 'Data' },
  { id: 'split', label: 'Split' },
  { id: 'prep', label: 'Prepare' },
  { id: 'train', label: 'Train' },
  { id: 'tune', label: 'Tune' },
  { id: 'select', label: 'Select' },
  { id: 'test', label: 'Test' },
  { id: 'report', label: 'Report' },
];
const ttvItems = [
  { id: 'collect', label: 'Collect the full labelled dataset', detail: 'Gather all past claims with their final outcomes in one table', stage: 'data' },
  { id: 'split', label: 'Split into train, validation and test sets', detail: 'Do this first, for example 70% / 15% / 15%, before fitting anything', stage: 'split' },
  { id: 'prep', label: 'Fit the scaler and encoders on the training set only', detail: 'Learn the statistics from train, then apply them to validation and test', stage: 'prep' },
  { id: 'train', label: 'Train the candidate models', detail: 'Fit a few models or settings on the training data', stage: 'train' },
  { id: 'tune', label: 'Tune the hyper-parameters on the validation set', detail: 'Compare the candidates with validation scores, not test scores', stage: 'tune' },
  { id: 'pick', label: 'Select the final model', detail: 'Choose the best candidate and freeze its settings', stage: 'select' },
  { id: 'test', label: 'Evaluate once on the test set', detail: 'Use the test set a single time to estimate real-world performance', stage: 'test' },
  { id: 'report', label: 'Report the result', detail: 'Share the test-set metrics and explain how the data was split', stage: 'report' },
];
const ttvCanonical = ttvItems.map((i) => i.id);

const HOW = 'Drag the steps into the order you would run them, from the first step to the last. Some steps can swap places when both orders are valid.';

export const ml = [
  {
    subject: 'ML Workflow (Drag & Drop)',
    type: 'sequence',
    difficulty: 'medium',
    title: 'Linear Regression Pipeline: Predict Property Prices',
    statement: `${HOW} Build the complete regression pipeline, from importing the data to saving the model.`,
    marks: 20,
    time_mins: 4,
    tags: ['machine-learning', 'regression', 'preprocessing', 'pipeline'],
    config: {
      scenario: 'A facilities team is planning new clinic locations and wants to predict property prices from size, number of rooms and neighbourhood. '
        + 'You have a CSV of 5,000 past sales that contains a few empty cells, some repeated rows, a handful of extreme prices and text columns such as neighbourhood.',
      items: arrange(regItems, [7, 2, 10, 5, 0, 9, 3, 11, 6, 1, 8, 4]),
      stages: STAGES_PIPELINE,
      visual: { kind: 'scatter-regression', title: 'Property size vs sale price', xLabel: 'Size (sq ft)', yLabel: 'Price (₹ lakh)', points, line: fitLine(points) },
    },
    reference: {
      order: regCanonical,
      constraints: [
        ['load', 'explore'],
        ['explore', 'clean'],
        ['explore', 'outliers'],
        ['clean', 'encode'],
        ['clean', 'xy'],
        ['xy', 'split'],
        ['outliers', 'train'],
        ['encode', 'train'],
        ['split', 'scale'],
        ['scale', 'train'],
        ['train', 'predict'],
        ['predict', 'evaluate'],
        ['evaluate', 'save'],
      ],
    },
  },
  {
    subject: 'ML Workflow (Drag & Drop)',
    type: 'sequence',
    difficulty: 'medium',
    title: 'Classification Pipeline: Claim Approved or Denied',
    statement: `${HOW} Build the complete classification pipeline, from importing the claims to saving the tuned model.`,
    marks: 20,
    time_mins: 4,
    tags: ['machine-learning', 'classification', 'imbalance', 'pipeline'],
    config: {
      scenario: 'A health plan wants a model that predicts whether a submitted claim will be approved or denied, using the billed amount, procedure type, provider network and plan type. '
        + 'Only about 15% of past claims were denied, some fields are missing and several columns are text categories.',
      items: arrange(clsItems, [9, 3, 11, 0, 6, 8, 2, 10, 5, 1, 7, 4]),
      stages: STAGES_PIPELINE,
      visual: {
        kind: 'confusion-matrix',
        title: 'Test-set results (1,000 claims)',
        labels: ['Denied', 'Approved'],
        matrix: [[118, 32], [61, 789]],
      },
    },
    reference: {
      order: clsCanonical,
      constraints: [
        ['load', 'explore'],
        ['explore', 'clean'],
        ['clean', 'encode'],
        ['clean', 'xy'],
        ['xy', 'split'],
        ['split', 'scale'],
        ['split', 'imbalance'],
        ['scale', 'train'],
        ['imbalance', 'train'],
        ['encode', 'train'],
        ['train', 'predict'],
        ['predict', 'evaluate'],
        ['evaluate', 'tune'],
      ],
    },
  },
  {
    subject: 'ML Workflow (Drag & Drop)',
    type: 'sequence',
    difficulty: 'easy',
    title: 'Gradient Descent Training Loop',
    statement: `${HOW} Put the steps of one gradient-descent training run in order.`,
    marks: 10,
    time_mins: 3,
    tags: ['machine-learning', 'gradient-descent', 'training'],
    config: {
      scenario: 'You are training a small model that predicts claim processing time. The chart shows the training loss falling every epoch while the validation loss stops improving and starts to rise after about epoch 11.',
      items: arrange(gdItems, [4, 7, 1, 5, 0, 3, 6, 2]),
      stages: gdStages,
      visual: {
        kind: 'loss-curve',
        title: 'Loss per epoch',
        xLabel: 'Epoch',
        yLabel: 'Loss',
        series: [
          { name: 'Training loss', values: trainLoss },
          { name: 'Validation loss', values: valLoss },
        ],
      },
    },
    reference: {
      order: gdCanonical,
      constraints: [
        ['init', 'forward'],
        ['forward', 'loss'],
        ['loss', 'grads'],
        ['grads', 'update'],
        ['update', 'validate'],
        ['validate', 'repeat'],
        ['repeat', 'keep'],
        ['forward', 'grads'],
        ['loss', 'update'],
        ['update', 'repeat'],
      ],
    },
  },
  {
    subject: 'ML Workflow (Drag & Drop)',
    type: 'sequence',
    difficulty: 'easy',
    title: 'Train, Validation and Test Split Without Leakage',
    statement: `${HOW} Put the steps of a clean workflow in order so that the final test score can be trusted.`,
    marks: 10,
    time_mins: 3,
    tags: ['machine-learning', 'data-leakage', 'validation', 'evaluation'],
    config: {
      scenario: 'A data scientist trained a claim-fraud model and reported 99% accuracy, but the score came from data that had already influenced the scaler and the model settings. '
        + 'Rebuild the workflow so every number you report is honest.',
      items: arrange(ttvItems, [6, 2, 5, 0, 7, 3, 1, 4]),
      stages: ttvStages,
      visual: {
        kind: 'data-split',
        title: 'How the data is divided',
        segments: [
          { label: 'Train', percent: 70, tone: 'blue' },
          { label: 'Validation', percent: 15, tone: 'sky' },
          { label: 'Test', percent: 15, tone: 'green' },
        ],
      },
    },
    reference: {
      order: ttvCanonical,
      constraints: [
        ['collect', 'split'],
        ['split', 'prep'],
        ['prep', 'train'],
        ['train', 'tune'],
        ['tune', 'pick'],
        ['pick', 'test'],
        ['test', 'report'],
        ['split', 'train'],
        ['prep', 'tune'],
        ['tune', 'test'],
      ],
    },
  },
];
