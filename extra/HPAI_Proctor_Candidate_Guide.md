# HPAI Assessment Platform — Proctor & Candidate Guide

**HPAI Assessment Platform v1.0.0**

A step-by-step guide to running a timed coding assessment with the HPAI Assessment Platform: how a **proctor** creates a session and shares one-time links, how a **candidate** takes the test, and how results are read.

> **Prefer to watch?** Open `HPAI_Test_Walkthrough_Video.html` (in this same folder) in Microsoft Edge or Chrome and press **Play guide**. It is a narrated, animated walkthrough of exactly the steps below (16 chapters, about 9–10 minutes). Turn your sound on. The chapter numbers in the video match the table in [section 9](#9-video-chapters-and-where-to-read-more).

---

## 1. The two roles

| Role | What they do |
|---|---|
| **Proctor** | Signs in, builds a session (choosing the questions and the time), shares one-time links, watches the test live, helps candidates, and reviews every attempt. |
| **Candidate** | Opens a one-time link, accepts the rules, takes the timed test, and then sees **only their marks** — with a result PDF and an HPAI certificate. |

**How a test flows**

1. The proctor creates a **session** (name, number of candidates, subjects, paper, time).
2. The platform generates **one unique, one-time link per candidate**, each with its own **Tester ID** (for example `HPAI-T-K7M2QX`).
3. Candidates open their link, press **Start assessment**, and take the test in fullscreen.
4. Everything is **marked automatically by the platform** (no manual marking).
5. The candidate sees their marks, downloads the PDF and certificate. The proctor reviews the attempts and exports the results.

---

## 2. Before you start

**Proctors**
- Your sign-in email and password.
- The subjects you want to use must be available to your account. You will see them in **New session → Subjects**. If the wizard says **No subjects assigned**, ask the HPAI team.
- A list of your candidates — names and emails, one per line — is helpful but optional.

**Candidates**
- A laptop or desktop with a stable internet connection and a recent **Microsoft Edge** or **Google Chrome**.
- Your personal **one-time link** from your proctor. Do not share it.
- A quiet place. You will be in fullscreen and will not be able to leave the test screen more than twice (see [section 6](#6-integrity-rules)).

---

## 3. Proctor guide

### 3.1 Sign in
1. Open the platform and enter your **Email** and **Password**, then press **Sign in**.
2. Forgot your password? Use **Forgot password?** on the sign-in page.
3. You land on your **Dashboard**.

### 3.2 The dashboard
- Cards: **Sessions**, **Live now** (attempts in progress), **Submitted**, **Candidates**.
- **My sessions** lists your sessions and their progress.
- Menu: **Dashboard**, **Sessions**, **Question bank**, **Candidates**.
- The **Question bank** is read-only. You can read every question (statement, constraints, examples, sample tests, marks, time) but **never the answers or hidden tests**.
- Press **+ New session** to start.

### 3.3 Create a session (5 steps)

The wizard shows five steps: **Basics → Subjects → Review paper → Time → Summary**.

**Step 1 — Basics**
- **Session name**, for example `Campus Drive — Batch A`.
- Optional **Opens at** / **Closes at**.
- **How many candidates will take this test?** — use the − / + stepper (**max 50 per session**). Every candidate gets their own one-time link.
- Or paste **names and emails** (one per line: `name,email` or just `name`). You can also upload a CSV. The count then follows the list.
- **Lock the name on the link** — when ticked, candidates cannot change the name/email you entered.
- **Each link is valid for** — 1 hour, 6 hours, 24 hours, 2 days, 3 days or 7 days.

**Step 2 — Subjects**
- Choose the **paper type**:
  - **Same paper for everyone** — the system proposes random questions; you review them and swap any you do not like. Everyone gets exactly this paper.
  - **Different random set per candidate** — each candidate gets their own random questions from the counts you set. There is no review step.
- Set how many **Easy**, **Medium** and **Hard** questions you want from each subject. The summary shows questions, marks and minutes of work.
- Press **Generate paper →** (same-paper mode) or **Next →**.

**Step 3 — Review paper** *(same-paper mode)*

The system shows its proposed paper grouped by subject, with live totals of questions, marks and minutes. For each question:

| Button | What it does |
|---|---|
| **Preview** | Read the question (statement, constraints, sample tests). Answers and hidden tests are never shown. |
| **Keep** | Mark it as one you like; **Shuffle all** will not touch it. |
| **↻ Shuffle** | Swap it for another question of the **same subject and level**. |
| **Replace…** | Choose any question of that subject yourself. |
| **Remove** | Take it out of the paper. |

Also: **+ Add question** (or **+ Add** per subject) and **↻ Shuffle all unlocked (N)**.

**Step 4 — Time**
- The duration is worked out **after** you finalise the questions: question time × 1.2, rounded up to the next 5 minutes (at least 10). Example: 18 minutes of questions → **25 minutes**.
- Adjust with **−5 / +5**, or press **Use suggested**. A warning appears if the time is shorter than the questions' total time.

**Step 5 — Summary**
- Check the session name, paper, questions, total marks, duration and number of candidates, then press **Create session**.

### 3.4 Links ready
After creation you see **Links ready**: one row per candidate with the **Tester ID**, the **Candidate**, and the **Link**.

- **Links are shown only once.** Copy or download them now.
- **Copy all**, **Copy selected (N)**, **⬇ Download CSV**, **🖨 Print sheet**; per row: **Copy**, **Mail**, **WhatsApp** (these only open your own app with the text filled in).
- **Tip — release links in waves of 10–15 candidates** so everyone can start calmly and you can help each candidate if needed.
- Every link works for **one start only**. If a link is lost, use **Reissue** (see [section 7](#7-troubleshooting)).

### 3.5 The live board
Open the session to see every candidate's link and progress. It refreshes by itself.

- **Status chips** (they also filter the list): **Total**, **Not opened**, **Opened**, **In progress**, **Submitted**, **Needs attention**, **Average**. Revoked/expired links are hidden by default; use **Show revoked / expired** to see them.
- **Highlights** tell you who needs attention: a link **opened but not started** (10+ minutes), a candidate with **no activity for 5+ minutes**, or **2 screen leaves**.
- **Search** by name, email or Tester ID.
- **Per candidate:** **Review**, **+ Time** (extend), **Resume link**, **Revoke**, **Reissue**, **Remove** (for revoked/expired links).
- **Bulk actions:**
  - **⏱ Extend time (all in progress)** — 1–60 minutes; a reason is required.
  - **Revoke unused links (N)**.
  - **Remove revoked & expired links (N)** — permanently deletes links that were never used (used links and results are never deleted).
  - **Close session**.
- **⬇ Export results** downloads a CSV.

### 3.6 Reviewing an attempt
Press **Review** on a candidate to open **Review — {name}**:
- Tester ID, Session, Proctor, Status and **Score**.
- **Answers**: marks per question and **tests passed / total**.
- **Proctoring events**: every tab switch or screen leave, with the time.
- For coding answers, **Analyze complexity** estimates **Time** and **Space** with graphs. It is an estimate to support your review and **never changes the marks**.

### 3.7 Finishing
When everyone has finished, press **Close session** and **⬇ Export results**. A closed session can be reopened from its page with **Reopen session**.

---

## 4. Candidate guide

### 4.1 Open your link
- You will see the **assessment name**, **duration**, **number of questions**, **total marks** and your **Tester ID**.
- If your proctor locked your name, it is already filled in (🔒). If it is wrong, tell your proctor before you start.
- If the test has not opened yet, a countdown is shown and the Start button appears by itself.

### 4.2 Read the rules, then start
Read the rules, tick **I have read and agree to follow these rules.**, and press **Start assessment**. The rules are:

1. The test can be **started only once**. Closing or reloading the page does not restart it or reset the timer.
2. The test runs in **fullscreen**. You may leave the test screen (switch tab / window or exit fullscreen) **at most 2 times**. You get a warning each time, and on the **3rd time your test is submitted automatically**.
3. **Screenshots, screen recording, printing and copying questions are strictly prohibited.** The page is watermarked with your identity, content is hidden whenever you leave the window, and any attempt is recorded and reported to your proctor.
4. **Tab switches, window changes and copy/paste** are monitored and reported to your proctor. Violations may lead to disqualification.
5. Your answers autosave. If you lose connection, keep working and reconnect — you can resume.
6. Code is run and marked in your browser; partial marks are given for passing test cases.
7. The test auto-submits when time runs out. You will see only your marks afterwards.

Then press **Enter fullscreen to begin**. The timer is already running.

### 4.3 The test screen
- **Top bar:** the countdown timer (⏱) and **Screen leaves: x/2**.
- **Question navigator:** **Q1, Q2, …** — a ✓ shows what you have answered, and the counter shows how many (for example `3/6 answered`).
- **Left:** the problem — statement, constraints, examples and sample tests (hidden tests are only counted, not shown).
- **Right:** the code editor with **colour highlighting** and **automatic indentation**.
- **Language menu:**
  - **Run & auto-mark:** Python, JavaScript, TypeScript — your code runs on real test cases.
  - **Syntax check only:** C, C++, Java, C#, Go, Rust, Ruby, PHP, Kotlin, Swift, Bash — the code is checked for correct syntax and a complete implementation (not executed).
- **▶ Run sample tests** shows how your code does on the sample tests. **More hidden tests run when you submit.** (The first Python run takes a few seconds to prepare.)
- **← Prev / Next →** move between questions; **Submit assessment** finishes the test.

**Other question types**
- **SQL:** you see the sample tables and write one `SELECT` / `WITH` query.
- **NoSQL (MongoDB-style):** you write a `find` specification or an aggregation pipeline.
- **Quick Dev (UI Debug):** you fix a broken page and watch a **live preview**; use **▶ Run checks**.
- **AI/ML:** scenario-based multiple-choice questions.

### 4.4 Warnings and automatic submission
- **1st time you leave the screen:** *Warning 1 of 2* — press **I understand — return to the test**.
- **2nd time:** *Final warning*.
- **3rd time:** the test is **submitted automatically** with whatever you have saved.

### 4.5 Submit and your result
1. Press **Submit assessment**. You will see any questions you have not attempted. You **cannot change answers after submitting**. Choose **Keep working** or **Yes, submit**.
2. The platform marks everything automatically ("Grading your answers…").
3. You see **only your marks**: total, percentage, **grade**, and **Marks by subject**. You never see the code, answers or test cases.
4. Press **⬇ Download result PDF** or **🏅 Download certificate**. The certificate carries a unique **Certificate ID** that anyone can verify.

---

## 5. How marking works (in brief)

All marking is **automatic**. For each question:

> **Question score = marks × tests passed ÷ total tests** (partial marking; hidden tests included)

Marks per question: **Easy 10, Medium 20, Hard 30** (AI/ML multiple-choice: 5 / 10 / 15). There is **no negative marking**; an unanswered question scores 0.

| Question type | What counts as one "test" |
|---|---|
| **Coding — Python, JavaScript, TypeScript** | One input → expected output case (8 per question: 3 visible + 5 hidden). |
| **Coding — other languages** (syntax-checked) | Four equal checks: clean syntax, a non-trivial answer, a loop/condition where needed, and a result (return/print). **All four = full marks.** |
| **SQL** | One data set (5–6 per question). Row values must match; row order is ignored unless the question needs `ORDER BY`. |
| **NoSQL** | One data set (5 per question); the result documents must match. |
| **Quick Dev (UI Debug)** | One behaviour check on the live page. |
| **AI/ML multiple-choice** | Single answer: all or nothing. Multiple answers: correct picks − wrong picks (never below 0), out of the number of correct options. |

**Grades:** 80 % and above — **Excellent** · 60–79 % — **Good** · 40–59 % — **Fair** · below 40 % — **Needs Improvement**.

---

## 6. Integrity rules

- **One start per link.** A link cannot be used to begin again after Start.
- **Fullscreen.** Leaving the test screen (switch tab / window or exit fullscreen) counts as a **screen leave**. **2 are allowed; the 3rd submits the test automatically.** Reloading the page does not reset the count.
- **No screenshots, recording, printing or copying.** These are blocked or logged where possible, the page carries an identity watermark, and content is hidden whenever the window is not in focus.
- **Everything is recorded** for the proctor (screen leaves, paste/copy attempts) and shown in the attempt's **Proctoring events**.

---

## 7. Troubleshooting

| What you see | What it means / what to do |
|---|---|
| **"This link has already been used"** | Every link works once. Proctor: open the live board and use **Reissue** to give that Tester ID a fresh link. If the candidate had already started and lost their browser, use **Resume link** instead. |
| **Candidate closed the browser or lost the page mid-test** | The attempt and timer continue. Proctor: use **Resume link** on the live board; the same attempt continues and the timer is **not** reset. |
| **"This link has expired"** | Proctor: **Reissue** — you choose how long the new link is valid. |
| **"This link is no longer active"** | The proctor revoked or replaced it. Send the latest link. |
| **"This assessment is not open right now"** | The session is closed or has finished. Proctor: open the session page; if it was closed by mistake use **Reopen session**, otherwise create a new session. |
| **"Your assessment has not opened yet"** | The session has an **Opens at** time. Keep the page open — **Start assessment** appears by itself. |
| **Candidate lost internet during the test** | Keep working and reconnect — answers autosave and the test can be resumed. If the browser was closed, the proctor creates a **Resume link**. |
| **Candidate got a warning** | They left the test screen. Two leaves are allowed; the 3rd submits the test automatically. |
| **The test submitted by itself** | Either time ran out or the 3rd screen leave happened. Answers saved so far are marked; the candidate sees their marks. It cannot be restarted. |
| **"A session can have at most 50 candidates"** | Create another session for the remaining candidates. |
| **Cannot see a subject in New session** | You can only use the subjects available to your account. If the wizard says **No subjects assigned**, ask the HPAI team. |
| **Forgot your password** | Use **Forgot password?** on the sign-in page. |
| **A Python question seems slow the first time** | The first Python run takes a few seconds to prepare. After that it is quick. |
| **Cannot find a link after leaving "Links ready"** | Links are shown only once. Use **Reissue** on the live board to create a fresh link for that Tester ID. |

---

## 8. Checklist for the day

- [ ] Create the session a day early and check the paper in **Review paper**.
- [ ] Decide the number of candidates (up to 50 per session) and prepare the names/emails list.
- [ ] Release links in waves of **10–15** candidates, so everyone starts calmly.
- [ ] Ask candidates to use a laptop with a stable internet connection and **Edge** or **Chrome**.
- [ ] Read the rules out loud: **one start, two screen leaves, no screenshots**.
- [ ] Keep an eye on the **live board** highlights (opened but not started, idle, screen leaves).
- [ ] Keep **Reissue** and **Resume link** in mind for lost links or browsers.
- [ ] When everyone has finished: **Close session** and **⬇ Export results**.

---

## 9. Video chapters and where to read more

| # | Chapter | Approx. length | Guide section |
|---|---|---|---|
| 1 | Welcome & the two roles | 0:30 | [1](#1-the-two-roles) |
| 2 | The proctor signs in | 0:20 | [3.1](#31-sign-in) |
| 3 | The proctor dashboard | 0:25 | [3.2](#32-the-dashboard) |
| 4 | New session: the basics | 0:40 | [3.3](#33-create-a-session-5-steps) |
| 5 | Subjects and paper type | 0:30 | [3.3](#33-create-a-session-5-steps) |
| 6 | Review the proposed paper | 0:45 | [3.3](#33-create-a-session-5-steps) |
| 7 | Set the time | 0:25 | [3.3](#33-create-a-session-5-steps) |
| 8 | Summary and create | 0:15 | [3.3](#33-create-a-session-5-steps) |
| 9 | Links ready | 0:30 | [3.4](#34-links-ready) |
| 10 | The candidate opens the link | 0:50 | [4.1–4.2](#41-open-your-link) |
| 11 | Taking the test | 1:15 | [4.3](#43-the-test-screen) |
| 12 | Integrity: screen leaves | 0:35 | [4.4](#44-warnings-and-automatic-submission), [6](#6-integrity-rules) |
| 13 | Submit and results | 0:40 | [4.5](#45-submit-and-your-result) |
| 14 | The live board | 0:55 | [3.5](#35-the-live-board) |
| 15 | Reviewing an attempt | 0:35 | [3.6](#36-reviewing-an-attempt) |
| 16 | Tips and checklist | 0:45 | [7](#7-troubleshooting), [8](#8-checklist-for-the-day) |

*Chapter lengths are approximate; the narrator's pace depends on the voice and speed you choose. In the video you can change the voice and speed (⚙), toggle captions (C), voice (V) and music (M), jump between chapters (← →, or ☰ Chapters), and go fullscreen (F).*

---

**Need help? Ask your proctor or the HPAI team.**

*HPAI Assessment Platform v1.0.0*
