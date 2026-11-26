# HPAI Assessment Platform — Question Bank & Marking Scheme

> Generated from the question-bank source (`question-bank/`). This document deliberately **does not contain answers, hidden test cases or solutions**, so it is safe to share with proctors.

## 1. Bank at a glance

**54 questions · 845 marks in total · 5 subjects · 3 difficulty levels**

| Subject | Type | Easy | Medium | Hard | Total questions | Total marks |
|---|---|---:|---:|---:|---:|---:|
| Programming (DSA) | coding | 6 | 6 | 4 | 16 | 300 |
| SQL | sql | 3 | 3 | 2 | 8 | 150 |
| NoSQL (MongoDB) | nosql | 2 | 2 | 2 | 6 | 120 |
| Quick Dev (UI Debug) | ui | 3 | 2 | 1 | 6 | 100 |
| AI/ML | mcq | 6 | 7 | 5 | 18 | 175 |
| **All** | | 20 | 20 | 14 | **54** | **845** |

### Difficulty, marks and time

| Level | Marks (coding / SQL / NoSQL / UI) | Marks (AI/ML MCQ) | Target time per question |
|---|---:|---:|---|
| Easy | 10 | 5 | 2–4 min (MCQ: 1 min) |
| Medium | 20 | 10 | 5–7 min (MCQ: 2 min) |
| Hard | 30 | 15 | 9–10 min (MCQ: 3 min) |

Questions were written in the style of LeetCode, GeeksforGeeks, HackerRank and CodeChef (and MongoDB University / Amazon-style UI debugging) as **original** problems — statements are not copied from those sites.

## 2. How a session picks questions

The proctor builds a session in one of three modes:

- **Random** — for each subject the proctor sets how many Easy / Medium / Hard questions; the server picks them at random (each candidate gets their own set, ordered by subject, then Easy → Hard).
- **Pick manually (fixed paper)** — the proctor ticks exact questions; every candidate gets the same paper.
- **Mix** — fixed questions plus random fill from the subject counts (random picks never repeat a fixed question).

A proctor can only use the subjects the admin assigned to them. The session duration is set by the proctor (the wizard suggests `sum of question times × 1.2`).

## 3. Marking scheme

All marking is **automatic, done by the portal** — there is no manual marking. Questions are marked in the candidate's browser; the server stores the result and recomputes the score itself.

### 3.1 Universal formula (partial marking)

```
question score = round( question marks × tests_passed ÷ tests_total , 2 )
attempt total  = sum of question scores        max = sum of question marks
percentage     = total ÷ max × 100
```

- `tests_passed` / `tests_total` are computed in the browser over **all** tests of the question, **including hidden ones**. The server clamps `tests_passed` to `tests_total` and calculates the marks itself, using the marks defined in the server catalog.
- Every test of a question carries equal weight (no weighted tests are used in the current bank), so one test is worth `marks ÷ number of tests`.
- An unanswered question scores 0. There is **no negative marking**.
- Hidden tests are never shown to the candidate during the test; they only appear as "Hidden test n: passed/failed". This is what stops hard-coding the sample outputs.
- When the timer ends, or the 3rd screen leave happens, everything saved so far is graded and the test is auto-submitted.

**Worked example** — a Medium coding question (20 marks) with 8 tests (3 visible + 5 hidden). A candidate whose code passes 6 of 8 gets `20 × 6 ÷ 8 = 15` marks.

### 3.2 Marking by question type

| Type | What counts as one "test" | How it is checked |
|---|---|---|
| **Coding (DSA)** — Python, JavaScript, TypeScript | One input → expected output case (8 per question: 3 visible + 5 hidden) | The candidate's function runs in a browser Web Worker (Python via Pyodide). The returned value is compared with the expected value by deep equality (numbers within a tolerance when the question sets one). A crash, wrong output or syntax error fails that test. Time limit: **4 s** per run for JavaScript/TypeScript, **8 s** for Python; on timeout the worker is stopped and the remaining tests fail ("Time limit exceeded"). |
| **Coding — other languages** (C, C++, Java, C#, Go, Rust, Ruby, PHP, Kotlin, Swift, Bash) | One of 4 checks (see 3.3) | Not executed. Parsed with tree-sitter in the browser. |
| **SQL** | One dataset (a fresh in-memory SQLite database built from the schema plus that dataset) | Only a single `SELECT` / `WITH` statement is accepted. Result **row values** must match the expected rows; column names are ignored; row order is ignored unless the question requires `ORDER BY`; numbers within 1e-6. Datasets include empty tables, ties and boundary cases. 5–6 datasets per question. |
| **NoSQL (MongoDB-style)** | One dataset (a collection of documents) | The candidate writes either a `find` spec `{ filter, projection, sort, limit }` or an aggregation pipeline `[ … ]`, run with the `mingo` engine; the result documents must deep-equal the expected documents (order-sensitive when the question sorts). 5 datasets per question. |
| **Quick Dev (UI Debug)** | One behavioural check | The candidate fixes buggy HTML/CSS/JS with a live preview. Checks run inside a sandboxed iframe (click buttons, type into inputs, read the DOM and computed styles). Score = `checks passed ÷ checks total`. The broken starter passes at most a couple of checks, so doing nothing scores close to 0. |
| **AI/ML MCQ (scenario-based)** | The question itself | **Single answer:** all-or-nothing (full marks if the chosen option is right, else 0). **Multiple answers:** `correct picks − wrong picks` (never below 0) out of the number of correct options, i.e. partial credit with a penalty for wrong ticks. |

### 3.3 Syntax-checked languages (full marks possible)

C, C++, Java, C#, Go, Rust, Ruby, PHP, Kotlin, Swift and Bash cannot run in the browser on the free tier, so they are **syntax-checked** (not executed). Four equal checks are applied:

1. The code parses with **no syntax errors**.
2. It is a **non-trivial implementation** (more than the starter, at least a few real lines).
3. It uses a **loop or conditional** (where the problem needs one).
4. It **produces a result** (a return / print statement).

`marks = question marks × checks passed ÷ 4`. Passing all four earns **full marks**; an untouched starter or empty answer earns 0. Because nothing is executed, the correctness of the logic is *not* verified for these languages — candidates are told on screen that **Python / JavaScript / TypeScript** give real test-case marking. Syntax errors show as red squiggles while typing. R is not offered because no browser-side R grammar was available.

### 3.4 Result bands and certificate

| Percentage | Grade |
|---|---|
| 80 % and above | Excellent |
| 60 % – 79 % | Good |
| 40 % – 59 % | Fair |
| below 40 % | Needs Improvement |

The candidate sees **only** their total, percentage, grade and per-subject marks (plus the result PDF and the HPAI certificate with a unique code, verifiable at `/verify/<code>`). Code, answers and tests are never shown to candidates. Proctors and admins additionally see per-question marks, tests passed/total, time spent, the integrity event timeline and (on demand) a time/space complexity estimate — which is informational and does **not** change marks.

### 3.5 Integrity rules (not scored, but enforced)

- A test can be started **once**; an invite link works for one start only. Reloading does not reset the timer.
- The candidate may leave the test screen (tab switch / window blur / fullscreen exit) **at most 2 times**; each gets a warning and the **3rd leave auto-submits** the test.
- Screenshot / print / copy attempts are blocked where the browser allows and always logged; the page carries an identity watermark and hides content while the window is not focused.

## 4. Question catalogue

Columns: **Marks** = full marks · **Time** = target minutes · **Tests** = visible + hidden test cases · **Per test** = marks earned per passed test. For MCQ the table shows the number of options; for UI the number of behavioural checks.

### 4.1 Programming (DSA)

Data structures & algorithms problems in Python / JavaScript with multiple test cases and partial marking. — **16 questions, 300 marks** (Easy 6, Medium 6, Hard 4).

| # | Level | Title | Marks | Time | Tests (visible + hidden) | Per test | Summary | Topics |
|---:|---|---|---:|---:|---|---:|---|---|
| 1 | Easy | Reverse the Words | 10 | 3 min | 8 (3 + 5) | 1.25 | Given a sentence, return a new sentence with the words in reverse order. | string, two-pointers |
| 2 | Easy | Second Largest Distinct Value | 10 | 3 min | 8 (3 + 5) | 1.25 | Return the second largest **distinct** value in an array of integers. | array, math |
| 3 | Easy | Fizz Buzz Sequence | 10 | 2 min | 8 (3 + 5) | 1.25 | Return a list of strings for the numbers 1 to n. | math, simulation |
| 4 | Easy | Move Zeros to the End | 10 | 4 min | 8 (3 + 5) | 1.25 | Move all zeros in the array to the end while keeping the relative order of the non-zero elements. | array, two-pointers |
| 5 | Easy | Anagram Check | 10 | 3 min | 8 (3 + 5) | 1.25 | Two strings are anagrams if one can be rearranged to form the other using every character exactly once. | string, hashing |
| 6 | Easy | Valid Palindrome (Ignore Symbols) | 10 | 4 min | 8 (3 + 5) | 1.25 | A phrase is a palindrome if, after converting letters to lowercase and removing every character that is not a letter or digit, it reads the same forward and backward. | string, two-pointers |
| 7 | Medium | Pair With Target Sum | 20 | 6 min | 8 (3 + 5) | 2.5 | Given an integer array nums and an integer target, find the two different positions whose values add up to target. | array, hashing |
| 8 | Medium | Longest Substring Without Repeats | 20 | 6 min | 8 (3 + 5) | 2.5 | Return the length of the longest contiguous substring of text in which no character appears more than once. | string, sliding-window, hashing |
| 9 | Medium | Merge Overlapping Intervals | 20 | 7 min | 8 (3 + 5) | 2.5 | Given a list of intervals [start, end], merge all overlapping intervals and return the merged list sorted by start. | array, sorting, intervals |
| 10 | Medium | Balanced Brackets | 20 | 5 min | 8 (3 + 5) | 2.5 | The string text contains only the characters (, ), {, }, [ and ]. | string, stack |
| 11 | Medium | Product of Array Except Self | 20 | 7 min | 8 (3 + 5) | 2.5 | Return an array out where out[i] is the product of all elements of nums except nums[i]. | array, prefix-sum |
| 12 | Medium | Search Insert Position | 20 | 5 min | 8 (3 + 5) | 2.5 | Given a sorted array of distinct integers nums (ascending) and an integer target, return the index of target if it exists. | binary-search, array |
| 13 | Hard | Longest Increasing Subsequence | 30 | 9 min | 8 (3 + 5) | 3.75 | Return the length of the longest **strictly increasing** subsequence of nums. | dp, binary-search, array |
| 14 | Hard | Trapping Rain Water | 30 | 9 min | 8 (3 + 5) | 3.75 | An elevation map is given as an array height, where each bar has width 1. | array, two-pointers, dp |
| 15 | Hard | Minimum Coins for Amount | 30 | 9 min | 8 (3 + 5) | 3.75 | You have an unlimited supply of each coin denomination in coins. | dp, unbounded-knapsack |
| 16 | Hard | Word Break | 30 | 10 min | 8 (3 + 5) | 3.75 | Given a string text and a list of words words, decide whether text can be split into a sequence of one or more dictionary words. | dp, string, memoization |

### 4.2 SQL

Relational queries (SQLite dialect) validated against multiple datasets. — **8 questions, 150 marks** (Easy 3, Medium 3, Hard 2).

| # | Level | Title | Marks | Time | Tests (visible + hidden) | Per test | Summary | Topics |
|---:|---|---|---:|---:|---|---:|---|---|
| 1 | Easy | High Earners | 10 | 3 min | 5 (2 + 3) | 2 | The employees table lists staff and their salaries. | filter, order by |
| 2 | Easy | Orders per Customer | 10 | 3 min | 5 (2 + 3) | 2 | The orders table records every order. | group by, count |
| 3 | Easy | Books and Their Authors | 10 | 3 min | 5 (2 + 3) | 2 | Join authors and books to list every book together with its author. | join |
| 4 | Medium | Departments Paying Above 60k | 20 | 6 min | 5 (2 + 3) | 4 | Return every department whose **average salary is greater than 60000**. | join, group by, having |
| 5 | Medium | Second Highest Salary | 20 | 6 min | 6 (2 + 4) | 3.33 | Write a query returning the **second highest distinct salary** from employees as a single column named second_highest. | subquery, distinct, limit offset |
| 6 | Medium | Rank Reps Within Region | 20 | 6 min | 5 (2 + 3) | 4 | For each region, rank sales reps by their **total sales amount** (highest first) using dense ranking (ties share a rank, next rank is not skipped). | window function, dense_rank |
| 7 | Hard | Top Customer of Each Month | 30 | 9 min | 5 (2 + 3) | 6 | For every calendar month (formatted YYYY-MM) that has at least one order, find the customer with the **highest total revenue** in that month. | cte, join, window function, group by |
| 8 | Hard | Three-Day Login Streaks | 30 | 9 min | 5 (2 + 3) | 6 | The logins table records the dates each user logged in (a user can log in several times a day). | cte, window function, gaps and islands |

### 4.3 NoSQL (MongoDB)

MongoDB-style find and aggregation pipelines. — **6 questions, 120 marks** (Easy 2, Medium 2, Hard 2).

| # | Level | Title | Marks | Time | Tests (visible + hidden) | Per test | Summary | Topics |
|---:|---|---|---:|---:|---|---:|---|---|
| 1 | Easy | Affordable Electronics | 10 | 3 min | 5 (2 + 3) | 2 | The products collection has documents { _id, name, category, price, stock }. | find, projection, sort |
| 2 | Easy | Premium Users in Metro Cities | 10 | 3 min | 5 (2 + 3) | 2 | The users collection has { _id, name, city, active, tags: [..] }. | find, $in, arrays, limit |
| 3 | Medium | Revenue per Customer | 20 | 6 min | 5 (2 + 3) | 4 | The orders collection has { _id, customer, status, amount }. | aggregate, $group, $sort |
| 4 | Medium | Busy Departments | 20 | 6 min | 5 (2 + 3) | 4 | The employees collection has { _id, name, dept, salary }. | aggregate, $group, $match, $round |
| 5 | Hard | Trending Tags | 30 | 9 min | 5 (2 + 3) | 6 | The posts collection has { _id, author, likes, tags: [..] }. | aggregate, $unwind, $group, $limit |
| 6 | Hard | Subject Toppers | 30 | 9 min | 5 (2 + 3) | 6 | The students collection has { _id, name, scores: [ { subject, marks } ] }. | aggregate, $unwind, $group, $first |

### 4.4 Quick Dev (UI Debug)

Fix a broken UI with live preview; behaviour is verified by automated checks. — **6 questions, 100 marks** (Easy 3, Medium 2, Hard 1).

| # | Level | Title | Marks | Time | Checks | Per check | What the candidate fixes |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | Easy | Fix the Counter | 10 | 4 min | 6 | 1.67 | The counter widget is broken. |
| 2 | Easy | Dark Mode Toggle | 10 | 4 min | 6 | 1.67 | The theme button does nothing useful. |
| 3 | Easy | Centre the Card | 10 | 4 min | 6 | 1.67 | The welcome card sticks to the top of the page and stretches too wide. |
| 4 | Medium | Signup Form Validation | 20 | 7 min | 6 | 3.33 | The signup form validates nothing properly. |
| 5 | Medium | Todo List Add & Remove | 20 | 7 min | 6 | 3.33 | Fix the todo app in script.js. |
| 6 | Hard | Accessible Tabs with Keyboard Support | 30 | 10 min | 6 | 5 | The pricing tabs only toggle a CSS class. |

### 4.5 AI/ML

Scenario-based multiple-choice questions on applied machine learning. — **18 questions, 175 marks** (Easy 6, Medium 7, Hard 5).

| # | Level | Title | Marks | Time | Options | Selection | Topics |
|---:|---|---|---:|---:|---:|---|---|
| 1 | Easy | Spot the Overfit | 5 | 1 min | 4 | Single | overfitting, evaluation |
| 2 | Easy | Accuracy on Rare Fraud | 5 | 1 min | 4 | Single | imbalance, metrics |
| 3 | Easy | Mixed Feature Scales | 5 | 1 min | 4 | Single | preprocessing, scaling, knn |
| 4 | Easy | Screening Priority | 5 | 1 min | 4 | Single | metrics, recall, healthcare |
| 5 | Easy | Read the Confusion Matrix | 5 | 1 min | 4 | Single | metrics, confusion matrix |
| 6 | Easy | Cures for Overfitting | 5 | 1 min | 4 | Multiple | overfitting, regularisation |
| 7 | Medium | Scaler Before the Split | 10 | 2 min | 4 | Single | data leakage, preprocessing |
| 8 | Medium | The Future-Only Feature | 10 | 2 min | 4 | Single | data leakage, feature engineering, healthcare |
| 9 | Medium | Exploding Loss | 10 | 2 min | 4 | Single | optimisation, learning rate |
| 10 | Medium | Policy Bot Hallucinations | 10 | 2 min | 4 | Single | llm, rag, hallucination |
| 11 | Medium | Both Curves Stay High | 10 | 2 min | 4 | Single | bias-variance, learning curves |
| 12 | Medium | Fairness Audit on Rural Members | 10 | 2 min | 4 | Multiple | fairness, evaluation, healthcare |
| 13 | Medium | SMOTE Before Cross-Validation | 10 | 2 min | 4 | Single | imbalance, data leakage, cross-validation |
| 14 | Hard | Choosing the Denial Threshold | 15 | 3 min | 4 | Single | thresholds, precision-recall, operations |
| 15 | Hard | Why Scale Attention? | 15 | 3 min | 4 | Single | transformers, attention, deep learning |
| 16 | Hard | Forecast Looks Great Offline | 15 | 3 min | 4 | Single | time series, data leakage, cross-validation |
| 17 | Hard | Improving RAG Retrieval | 15 | 3 min | 4 | Multiple | rag, retrieval, llm |
| 18 | Hard | Is Model B Really Better? | 15 | 3 min | 4 | Single | evaluation, statistics, model comparison |

## 5. Sample papers (for planning)

Marks per question are fixed by level, so a paper's total depends only on its mix:

| Paper (example) | Questions | Total marks | Suggested duration (×1.2) |
|---|---:|---:|---|
| Quick screening: 2 DSA Easy + 1 DSA Medium + 3 MCQ Easy | 6 | 55 | ~18 min |
| Standard: 1 DSA Easy + 1 DSA Medium + 1 SQL Medium + 1 UI Easy + 3 MCQ Medium | 7 | 90 | ~30 min |
| Advanced: 1 DSA Medium + 1 DSA Hard + 1 SQL Hard + 1 NoSQL Medium + 1 UI Medium + 3 MCQ Hard | 8 | 165 | ~55 min |

## 6. Known limits of the marking

- **Marking runs in the browser.** A technically skilled candidate could tamper with their own result before it is sent. The server recomputes marks from `tests_passed ÷ tests_total` and stores the code, so results can be audited, but this cannot be made tamper-proof without server-side execution.
- **Syntax-checked languages are not executed**, so full marks there mean "clean syntax and a complete-looking implementation", not "correct". Python / JavaScript / TypeScript are the languages with true correctness marking.
- **Answers are sealed (AES-GCM).** A candidate receives the keys only for the questions assigned to them while their attempt is running; admins reveal answers by re-entering their admin password; proctors never can.
- **Question ids are derived from titles.** Do not rename a question after attempts exist.
- To add or change a question: edit `question-bank/`, run `npm run validate-bank` and `npm run build-bank`, commit the generated files and deploy frontend and backend together.
