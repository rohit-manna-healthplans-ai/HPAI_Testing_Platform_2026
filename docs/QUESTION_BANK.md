# HPAI Assessment Platform — Question Bank & Marking Scheme

> **Version 1.1 bank.** Generated from the question-bank source. This document deliberately **does not contain answers, hidden test cases or solutions**, so it is safe to share with proctors.

## 1. Bank at a glance

**86 questions · 1385 marks in total · 7 subjects · 3 difficulty levels**

| Subject | Question type | Easy | Medium | Hard | Total questions | Total marks |
|---|---|---:|---:|---:|---:|---:|
| Programming (DSA) | coding | 14 | 14 | 8 | 36 | 660 |
| SQL | sql | 3 | 3 | 2 | 8 | 150 |
| NoSQL (MongoDB) | nosql | 2 | 2 | 2 | 6 | 120 |
| Quick Dev (UI Debug) | ui | 3 | 2 | 1 | 6 | 100 |
| AI/ML | mcq | 6 | 7 | 5 | 18 | 175 |
| ML Workflow (Drag & Drop) | drag & drop (sequence) | 2 | 2 | 0 | 4 | 60 |
| Cloud (AWS, Azure, GCP) | drag & drop (architecture, matching) | 4 | 4 | 0 | 8 | 120 |
| **All** | | 34 | 34 | 18 | **86** | **1385** |

**New in v1.1:** 20 short coding questions (10 tests each) and 12 drag-and-drop questions (4 ML Workflow + 8 Cloud). Every question added in v1.1 is designed to take **2–4 minutes**. The original 54 questions are unchanged.

### Difficulty, marks and time

| Level | Marks (coding, SQL, NoSQL, UI, drag & drop) | Marks (AI/ML MCQ) | Target time — original questions | Target time — new questions |
|---|---:|---:|---|---|
| Easy | 10 | 5 | 2–4 min (MCQ: 1 min) | 2–3 min |
| Medium | 20 | 10 | 5–7 min (MCQ: 2 min) | 3–4 min |
| Hard | 30 | 15 | 9–10 min (MCQ: 3 min) | 4 min |

Questions were written in the style of LeetCode, GeeksforGeeks, HackerRank and CodeChef (and MongoDB University / Amazon-style UI debugging) as **original** problems — statements are not copied from those sites.

## 2. How a session picks questions

The proctor builds a session in one of three modes:

- **Random** — for each subject the proctor sets how many Easy / Medium / Hard questions; the platform picks them at random (each candidate gets their own set, ordered by subject, then Easy → Hard).
- **Pick manually (fixed paper)** — the proctor ticks exact questions; every candidate gets the same paper.
- **Mix** — fixed questions plus random fill from the subject counts (random picks never repeat a fixed question).

A proctor can only use the subjects that are available to their account. The two v1.1 subjects, **ML Workflow (Drag & Drop)** and **Cloud (AWS, Azure, GCP)**, appear in the wizard like any other subject and are previewed in **Review paper** with **Preview** (the proctor sees the scenario and the items, never the answers). The session duration is set by the proctor (the wizard suggests `sum of question times × 1.2`).

## 3. Marking scheme

All marking is **automatic, done by the portal** — there is no manual marking. Questions are marked in the candidate's browser; the platform stores the result and recomputes the score itself.

### 3.1 Universal formula (partial marking)

```
question score = round( question marks × units_passed ÷ units_total , 2 )
attempt total  = sum of question scores        max = sum of question marks
percentage     = total ÷ max × 100
```

- A **unit** is the smallest thing that can be right or wrong: a test case for coding, SQL, NoSQL and UI questions; an ordering rule, a match or a filled slot for the drag-and-drop questions (see 3.2).
- Units are computed in the browser over **all** units of the question, **including hidden ones**. The platform clamps the passed count to the total and calculates the marks itself, using the marks defined for the question.
- Every unit of a question carries equal weight, so one test is worth `marks ÷ number of tests`.
- An unanswered question scores 0. There is **no negative marking**.
- Hidden tests are never shown to the candidate during the test; they only appear as "Hidden test n: passed/failed". This is what stops hard-coding the sample outputs.
- When the timer ends, or the 3rd screen leave happens, everything saved so far is graded and the test is auto-submitted.

**Worked example** — an original Medium coding question (20 marks) with 8 tests (3 visible + 5 hidden). A candidate whose code passes 6 of 8 gets `20 × 6 ÷ 8 = 15` marks. A new Medium coding question has 10 tests (3 visible + 7 hidden): passing 7 of 10 gives `20 × 7 ÷ 10 = 14` marks.

### 3.2 Marking by question type

| Type | What counts as one unit | How it is checked |
|---|---|---|
| **Coding (DSA)** | One input → expected output test. Original questions: 8 tests (3 visible + 5 hidden). **New questions: 10 tests (3 visible + 7 hidden).** | Code written in **Python, JavaScript or TypeScript** runs in the browser against the tests. The returned value is compared with the expected value by deep equality (numbers within a tolerance when the question sets one; order ignored when several orders are valid). A crash or a wrong output fails that test. Any correct approach passes (brute force, optimised, recursive, iterative…). Time limit: **4 s** per run for JavaScript/TypeScript, **8 s** for Python; on timeout the remaining tests fail ("Time limit exceeded"). The editor's language list shows what is available for each question. |
| **SQL** | One dataset (a fresh in-memory SQLite database built from the schema plus that dataset) | Only a single `SELECT` / `WITH` statement is accepted. Result **row values** must match the expected rows; column names are ignored; row order is ignored unless the question requires `ORDER BY`; numbers within 1e-6. Datasets include empty tables, ties and boundary cases. 5–6 datasets per question. |
| **NoSQL (MongoDB-style)** | One dataset (a collection of documents) | The candidate writes either a `find` spec `{ filter, projection, sort, limit }` or an aggregation pipeline `[ … ]`; the result documents must deep-equal the expected documents (order-sensitive when the question sorts). 5 datasets per question. |
| **Quick Dev (UI Debug)** | One behavioural check | The candidate fixes buggy HTML/CSS/JS with a live preview. Checks run inside a sandboxed frame (click buttons, type into inputs, read the page and its styles). Score = `checks passed ÷ checks total`. The broken starter passes at most a couple of checks, so doing nothing scores close to 0. |
| **AI/ML MCQ (scenario-based)** | The question itself | **Single answer:** all-or-nothing (full marks if the chosen option is right, else 0). **Multiple answers:** `correct picks − wrong picks` (never below 0) out of the number of correct options, i.e. partial credit with a penalty for wrong ticks. |
| **ML Workflow — sequence (drag & drop)** | One **ordering rule**: "step A must come before step B" | The candidate drags the step cards into the order they would run them. See 3.3. |
| **Cloud — architecture builder (drag & drop)** | One **slot** on the diagram | The candidate drags services from a palette into the slots of an architecture. See 3.4. |
| **Cloud — matching (drag & drop)** | One **service chip** | The candidate drags each service onto the description that fits it. See 3.4. |

### 3.3 Sequence questions (ML Workflow)

The candidate gets a scenario, a visual (for example a scatter plot, a confusion matrix, a loss curve or a data-split bar) and a tray of step cards. They drag the cards into **Your sequence**; a **live pipeline diagram** lights up each stage as soon as a step from that stage is placed.

- Marking checks **ordering rules** ("step A must come before step B"), not one fixed list. Where two orders are equally valid (for example a step that can sensibly happen either before or after another), **both are accepted**.
- A rule counts as satisfied only if **both steps are placed** and A is above B. Steps left in the tray satisfy nothing.
- Raw ordering rules are satisfied by chance about half the time, so the score is **chance-corrected**:

```
score = marks × max( 0 , 2 × rules_satisfied − total_rules ) ÷ total_rules
```

**Worked example** — a 20-mark question with **13 rules**:

| Candidate result | Rules satisfied | Score |
|---|---:|---:|
| Everything in a correct order | 13 of 13 | **20.0** (100 %) |
| One step in the wrong place | 12 of 13 | 20 × 11 ÷ 13 ≈ **16.9** (about 85 %) |
| Cards dragged in a random order | around half of the rules (6–7 of 13) | on average only about **9 %** (roughly 1.8 marks) |
| Order reversed, or nothing placed | 0 | **0** |

So guessing does not pay, while a nearly right order keeps most of the marks.

### 3.4 Architecture and matching questions (Cloud)

- **Architecture builder:** `score = marks × correctly filled slots ÷ total slots`. A slot is correct when the service placed in it is an acceptable answer; where a slot has **more than one reasonable service, any of them is accepted**. An empty slot or a service from the palette that does not belong (the palette always contains a few extras) scores nothing for that slot.
- **Matching:** `score = marks × correct matches ÷ number of service chips`. Each description can hold one chip, and there are one or two extra descriptions that match nothing.
- Services are named as in the provider's own catalogue (AWS, Azure, Google Cloud); the icons are generic symbols tinted in the provider's colour, not official logos.
- Like every drag-and-drop question, **the candidate is never told whether a placement is right** during the test, and answers autosave.

### 3.5 Result bands and certificate

| Percentage | Grade |
|---|---|
| 80 % and above | Excellent |
| 60 % – 79 % | Good |
| 40 % – 59 % | Fair |
| below 40 % | Needs Improvement |

The candidate sees **only** their total, percentage, grade and per-subject marks (plus the result PDF and the HPAI certificate with a unique code, verifiable at `/verify/<code>`). Code, answers and tests are never shown to candidates. Proctors additionally see per-question marks, tests passed/total, time spent, the integrity event timeline and (on demand) a time/space complexity estimate for coding answers — which is informational and does **not** change marks.

### 3.6 Integrity rules (not scored, but enforced)

- A test can be started **once**; an invite link works for one start only. Reloading does not reset the timer.
- The candidate may leave the test screen (tab switch / window blur / fullscreen exit) **at most 2 times**; each gets a warning and the **3rd leave auto-submits** the test.
- Screenshot / print / copy attempts are blocked where the browser allows and always logged; the page carries an identity watermark and hides content while the window is not focused.

## 4. Question catalogue

Columns: **Marks** = full marks · **Time** = target minutes · **Tests** = visible + hidden test cases · **Per test** = marks earned per passed test. For MCQ the tables show the number of options; for UI the number of behavioural checks; for drag-and-drop the number of steps, rules, slots or chips.

### 4.1 Programming (DSA)

Data structures & algorithms problems in Python / JavaScript with multiple test cases and partial marking. — **36 questions, 660 marks** (Easy 14, Medium 14, Hard 8).

**Original coding questions (16; 8 tests each: 3 visible + 5 hidden)**

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

**New short coding questions (20; 10 tests each: 3 visible + 7 hidden; 2–4 minutes)** — any valid approach passes, and each question was checked with several different solutions.

| # | Level | Title | Marks | Time | Tests (visible + hidden) | Per test | Summary | Topics |
|---:|---|---|---:|---:|---|---:|---|---|
| 1 | Easy | Integer Square Root | 10 | 2 min | 10 (3 + 7) | 1 | Return the integer part of the square root of a non-negative integer, i.e. | math, binary-search |
| 2 | Easy | First Unique Character | 10 | 3 min | 10 (3 + 7) | 1 | Return the first character of the text that appears exactly once. | string, hashing |
| 3 | Easy | Claim Line Total | 10 | 2 min | 10 (3 + 7) | 1 | A claim has several lines. | array, healthcare |
| 4 | Easy | Valid Member ID | 10 | 3 min | 10 (3 + 7) | 1 | A member ID is valid when it has exactly 8 characters: two upper-case letters (A-Z) followed by six digits (0-9), with nothing else (no spaces, no lower-case letters). | string, parsing, healthcare |
| 5 | Easy | Find the Missing Number | 10 | 3 min | 10 (3 + 7) | 1 | The array contains n distinct integers taken from the range 0..n, so exactly one number of that range is missing. | array, math, bit-manipulation |
| 6 | Easy | Rotate Array Right | 10 | 3 min | 10 (3 + 7) | 1 | Rotate the array to the right by k steps and return the result as a new array. | array, simulation |
| 7 | Easy | Count Set Bits | 10 | 2 min | 10 (3 + 7) | 1 | Return the number of 1 bits in the binary representation of a non-negative integer. | bit-manipulation, math |
| 8 | Easy | Duplicate Claim IDs | 10 | 3 min | 10 (3 + 7) | 1 | Return the claim IDs that appear more than once in the list. | hashing, sorting, healthcare |
| 9 | Medium | Top K Frequent Words | 20 | 4 min | 10 (3 + 7) | 2 | Return the k most frequent words of the text. | hashing, sorting |
| 10 | Medium | Coverage Overlap Days | 20 | 4 min | 10 (3 + 7) | 2 | Two coverage periods are given as inclusive date ranges in YYYY-MM-DD format. | date-time, parsing, healthcare |
| 11 | Medium | Spiral Order of a Matrix | 20 | 4 min | 10 (3 + 7) | 2 | Return all elements of the matrix in clockwise spiral order, starting at the top-left cell. | matrix, simulation |
| 12 | Medium | Subarray Sum Equals K | 20 | 4 min | 10 (3 + 7) | 2 | Count the contiguous, non-empty subarrays whose elements add up to exactly k. | array, hashing, prefix-sum |
| 13 | Medium | Decode Run-Length String | 20 | 3 min | 10 (3 + 7) | 2 | A string is run-length encoded as a sequence of pairs: a positive count (one or more digits) followed by a letter. | string, parsing |
| 14 | Medium | Next Greater Element | 20 | 3 min | 10 (3 + 7) | 2 | For every element, find the first element to its right that is strictly greater. | stack, array |
| 15 | Medium | Count Islands in a Grid | 20 | 4 min | 10 (3 + 7) | 2 | The grid contains 1 (land) and 0 (water). | matrix, dfs, bfs |
| 16 | Medium | Maximum Non-Adjacent Sum | 20 | 3 min | 10 (3 + 7) | 2 | Choose some elements of the array so that no two chosen elements are next to each other, and make their sum as large as possible. | dp, array |
| 17 | Hard | Longest Palindromic Substring Length | 30 | 4 min | 10 (3 + 7) | 3 | Return the length of the longest substring of the text that reads the same forwards and backwards. | string, dp, two-pointers |
| 18 | Hard | Shortest Window Covering Letters | 30 | 4 min | 10 (3 + 7) | 3 | Find the length of the shortest contiguous part of text that contains every letter of letters, counting repeats (if letters has two "a" characters, the part mus | string, sliding-window, hashing |
| 19 | Hard | Count Inversions | 30 | 4 min | 10 (3 + 7) | 3 | An inversion is a pair of positions i < j with nums[i] > nums[j] (strictly greater). | array, sorting, divide-and-conquer |
| 20 | Hard | Count Subsets With Target Sum | 30 | 4 min | 10 (3 + 7) | 3 | Count the subsets of nums whose elements add up to exactly target. | dp, backtracking, recursion |

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

### 4.6 ML Workflow (Drag & Drop)

Arrange the steps of a machine-learning pipeline in the right order, with visuals. — **4 questions, 60 marks** (Easy 2, Medium 2, Hard 0).

| # | Level | Title | Marks | Time | Steps | Ordering rules | Visual | What the candidate does |
|---:|---|---|---:|---:|---:|---:|---|---|
| 1 | Easy | Gradient Descent Training Loop | 10 | 3 min | 8 | 10 | training / validation loss curves | Order the steps of one gradient-descent training run, from initialising weights to keeping the best model. |
| 2 | Easy | Train, Validation and Test Split Without Leakage | 10 | 3 min | 8 | 10 | train / validation / test split bar | Order a clean train / validation / test workflow so the final score can be trusted. |
| 3 | Medium | Linear Regression Pipeline: Predict Property Prices | 20 | 4 min | 12 | 13 | scatter plot with a fitted line | Put the full regression workflow in order, from importing the data to saving the model (cleaning, encoding, splitting, scaling, training, evaluating). |
| 4 | Medium | Classification Pipeline: Claim Approved or Denied | 20 | 4 min | 12 | 13 | confusion matrix | Put the full classification workflow in order, including class imbalance, evaluation metrics and threshold tuning. |

### 4.7 Cloud (AWS, Azure, GCP)

Drag and drop services to design a simple architecture, or match services to what they do. — **8 questions, 120 marks** (Easy 4, Medium 4, Hard 0).

| # | Format | Level | Title | Cloud | Marks | Time | Units | Extras offered | What the candidate does |
|---:|---|---|---|---|---:|---:|---|---|---|
| 1 | Architecture builder | Easy | Host a static website on AWS | AWS | 10 | 3 min | 5 slots | up to 3 extra services | Place the services for a fast, serverless marketing website (delivery, storage, domain, alarms). |
| 2 | Matching | Easy | Match the core AWS services | AWS | 10 | 3 min | 8 chips | 1 extra description | Match everyday AWS services to what they do. |
| 3 | Matching | Easy | Match the core Azure services | Azure | 10 | 3 min | 8 chips | 1 extra description | Match everyday Azure services to what they do. |
| 4 | Matching | Easy | Match the core GCP services | Google Cloud | 10 | 3 min | 8 chips | 1 extra description | Match everyday Google Cloud services to what they do. |
| 5 | Architecture builder | Medium | Three-tier web app on Azure | Azure | 20 | 4 min | 7 slots | up to 4 extra services | Complete a three-tier web application: traffic distribution, application tier, database, cache and file storage. |
| 6 | Architecture builder | Medium | Serverless REST API on AWS | AWS | 20 | 4 min | 6 slots | up to 3 extra services | Design a serverless REST API: entry point, code, NoSQL table, queue for slow work and monitoring. |
| 7 | Architecture builder | Medium | Event data pipeline on GCP | Google Cloud | 20 | 4 min | 6 slots | up to 4 extra services | Build an event analytics pipeline: ingestion, stream processing, raw storage, warehouse and dashboards. |
| 8 | Matching | Medium | Same job, different cloud | AWS | 20 | 4 min | 6 chips | 2 extra descriptions | Match AWS services to their closest equivalents on Azure and Google Cloud. |

## 5. Sample papers (for planning)

Marks per question are fixed by level, so a paper's total depends only on its mix. Times are the average target time of the questions in that mix:

| Paper (example) | Questions | Total marks | Suggested duration (×1.2, rounded up to 5) |
|---|---:|---:|---|
| Quick screening: 2 DSA Easy + 1 DSA Medium + 3 MCQ Easy | 6 | 55 | ~20 min |
| Standard: 1 DSA Easy + 1 DSA Medium + 1 SQL Medium + 1 UI Easy + 3 MCQ Medium | 7 | 90 | ~30 min |
| Advanced: 1 DSA Medium + 1 DSA Hard + 1 SQL Hard + 1 NoSQL Medium + 1 UI Medium + 3 MCQ Hard | 8 | 165 | ~55 min |
| Short-question mix: 2 new coding Easy + 2 new coding Medium + 1 ML Workflow Easy + 1 ML Workflow Medium + 1 Cloud Easy + 1 Cloud Medium | 8 | 120 | ~35 min |
| Cloud & ML focus: 1 ML Workflow Easy + 1 ML Workflow Medium + 2 Cloud Easy + 2 Cloud Medium | 6 | 90 | ~30 min |

## 6. Known limits of the marking

- **Marking runs in the candidate's browser.** A technically skilled candidate could tamper with their own result before it is sent. The platform recomputes the marks from the reported unit counts and keeps the submitted answers, so results can be audited, but this cannot be made fully tamper-proof.
- **Answers are protected.** A candidate receives access only to the questions assigned to them while their attempt is running. Proctors can read the questions (and preview them in the wizard) but never the answers or hidden tests.
- **Drag-and-drop questions give no feedback during the test** (no "Run" button), so candidates cannot learn the answer by trying. Steps or services left unplaced score nothing.
- **Sequence scoring is chance-corrected**, so random dragging earns almost nothing; questions with a single natural order (for example the training loop) accept only that order.
- **Complexity estimates** shown to proctors for coding answers are indicative (measured in the reviewer's browser) and never change marks.
- **Question titles identify questions in saved attempts**; they are not changed once attempts exist.
- To add or change a question, ask the HPAI team.
