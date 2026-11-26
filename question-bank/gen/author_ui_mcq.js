// Authoring source for UI (Quick Dev) and MCQ (AI/ML) questions.
// UI: `files` = deliberately BUGGY starter, `fixed` = reference solution (validated with jsdom by validate_other.js).
// Checks run sequentially in ONE page, so each check is written to be state-independent.

const page = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${body}
  <script src="script.js"></script>
</body>
</html>
`;

export const uiAuthor = [
  // ───────────── EASY: broken counter ─────────────
  {
    difficulty: 'easy', title: 'Fix the Counter',
    statement: 'The counter widget is broken. Fix `script.js` so that **+** adds 1, **−** subtracts 1 but never goes below 0, and **Reset** sets the count back to 0. The number on screen (`#count`) must always reflect the current value.',
    constraints: ['Only edit the listed files', 'Display must always match the internal count', 'The count can never be negative'],
    tags: ['javascript', 'dom', 'events'],
    files: {
      'index.html': page('Counter', `  <div class="counter">
    <h1 id="count">0</h1>
    <div class="buttons">
      <button id="dec">-</button>
      <button id="inc">+</button>
      <button id="reset">Reset</button>
    </div>
  </div>`),
      'style.css': `body { font-family: sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #eef4f7; }
.counter { text-align: center; }
#count { font-size: 64px; margin: 0 0 12px; color: #173f59; }
button { font-size: 18px; padding: 8px 16px; margin: 0 4px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; cursor: pointer; }
`,
      'script.js': `let count = 0;
const out = document.querySelector('#count');

document.querySelector('#inc').addEventListener('click', () => {
  count--;
  out.textContent = count;
});

document.querySelector('#dec').addEventListener('click', () => {
  count--;
});

document.querySelector('#reset').addEventListener('click', () => {
  count = 0;
});
`,
    },
    fixed: {
      'script.js': `let count = 0;
const out = document.querySelector('#count');
const render = () => { out.textContent = count; };

document.querySelector('#inc').addEventListener('click', () => { count++; render(); });
document.querySelector('#dec').addEventListener('click', () => { if (count > 0) count--; render(); });
document.querySelector('#reset').addEventListener('click', () => { count = 0; render(); });
render();
`,
    },
    tests: [
      { hidden: false, name: 'Counter shows 0 on load', check: "return document.querySelector('#count').textContent.trim() === '0';" },
      { hidden: false, name: '+ increases the count by 1', check: "const o=document.querySelector('#count'); const b=Number(o.textContent); document.querySelector('#inc').click(); return Number(o.textContent) === b+1;" },
      { hidden: false, name: 'Clicking + three times adds 3', check: "const o=document.querySelector('#count'); const b=Number(o.textContent); const inc=document.querySelector('#inc'); inc.click(); inc.click(); inc.click(); return Number(o.textContent) === b+3;" },
      { hidden: true, name: '− decreases the count by 1 when above zero', check: "const o=document.querySelector('#count'); const inc=document.querySelector('#inc'); inc.click(); inc.click(); const b=Number(o.textContent); document.querySelector('#dec').click(); return Number(o.textContent) === b-1;" },
      { hidden: true, name: 'Count never goes below 0', check: "const o=document.querySelector('#count'); const dec=document.querySelector('#dec'); for (let i=0;i<30;i++) dec.click(); return Number(o.textContent) === 0;" },
      { hidden: true, name: 'Reset returns the display to 0', check: "const o=document.querySelector('#count'); const inc=document.querySelector('#inc'); inc.click(); inc.click(); document.querySelector('#reset').click(); return o.textContent.trim() === '0';" },
    ],
  },

  // ───────────── EASY: dark mode toggle ─────────────
  {
    difficulty: 'easy', title: 'Dark Mode Toggle',
    statement: 'The theme button does nothing useful. Make the button (`#theme`) toggle a `dark` class on `<body>`, update its label ("Switch to light" while dark, "Switch to dark" while light), and make the dark theme actually change the page background colour in `style.css`.',
    constraints: ['Toggle the class `dark` on document.body', 'Button label: "Switch to dark" / "Switch to light"', 'Dark mode must change body background-color'],
    tags: ['css', 'classList', 'dom'],
    files: {
      'index.html': page('Theme', `  <main>
    <h1>Welcome back</h1>
    <p>Pick the look that is easiest on your eyes.</p>
    <button id="theme" class="theme-btn">Switch to dark</button>
  </main>`),
      'style.css': `body { margin: 0; padding: 48px; font-family: sans-serif; background-color: #ffffff; color: #111827; }
button { padding: 10px 18px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; font-size: 15px; cursor: pointer; }
body.darkk { background-color: #111827; color: #f9fafb; }
`,
      'script.js': `const btn = document.querySelector('.themebtn');

btn.addEventListener('click', () => {
  document.body.classList.add('dark');
});
`,
    },
    fixed: {
      'style.css': `body { margin: 0; padding: 48px; font-family: sans-serif; background-color: #ffffff; color: #111827; }
button { padding: 10px 18px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; font-size: 15px; cursor: pointer; }
body.dark { background-color: #111827; color: #f9fafb; }
`,
      'script.js': `const btn = document.querySelector('#theme');

btn.addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  btn.textContent = dark ? 'Switch to light' : 'Switch to dark';
});
`,
    },
    tests: [
      { hidden: false, name: 'Button starts as "Switch to dark"', check: "return document.querySelector('#theme').textContent.trim() === 'Switch to dark';" },
      { hidden: false, name: 'Clicking the button adds the "dark" class to body', check: "const b=document.body, t=document.querySelector('#theme'); if (b.classList.contains('dark')) t.click(); t.click(); return b.classList.contains('dark');" },
      { hidden: false, name: 'Label becomes "Switch to light" in dark mode', check: "const b=document.body, t=document.querySelector('#theme'); if (!b.classList.contains('dark')) t.click(); return t.textContent.trim() === 'Switch to light';" },
      { hidden: true, name: 'Dark mode changes the background colour', check: "const b=document.body, t=document.querySelector('#theme'); if (b.classList.contains('dark')) t.click(); const light=getComputedStyle(b).backgroundColor; t.click(); const dark=getComputedStyle(b).backgroundColor; return !!light && !!dark && light !== dark;" },
      { hidden: true, name: 'Second click removes the class again (toggle)', check: "const b=document.body, t=document.querySelector('#theme'); if (b.classList.contains('dark')) t.click(); t.click(); const was=b.classList.contains('dark'); t.click(); return was && !b.classList.contains('dark');" },
      { hidden: true, name: 'Label returns to "Switch to dark" in light mode', check: "const b=document.body, t=document.querySelector('#theme'); if (b.classList.contains('dark')) t.click(); t.click(); const darkLabel=t.textContent.trim(); t.click(); return darkLabel==='Switch to light' && t.textContent.trim()==='Switch to dark';" },
    ],
  },

  // ───────────── EASY: CSS centering ─────────────
  {
    difficulty: 'easy', title: 'Centre the Card',
    statement: 'The welcome card sticks to the top of the page and stretches too wide. Fix **only `style.css`** so the `.card` is centred **horizontally and vertically** in the viewport (use flexbox or grid on `.wrapper`), the wrapper fills the full viewport height, and the card is at most **400px wide**. Keep the card\'s white background and 12px rounded corners.',
    constraints: ['Edit style.css only', 'Wrapper must be at least 100vh tall', 'Card max width 400px'],
    tags: ['css', 'flexbox', 'layout'],
    files: {
      'index.html': page('Welcome', `  <div class="wrapper">
    <div class="card">
      <h2>Welcome to HPAI</h2>
      <p>Your assessment is ready. Take a breath and begin when you are ready.</p>
      <button>Get started</button>
    </div>
  </div>`),
      'style.css': `body { margin: 0; font-family: sans-serif; background-color: #eef4f7; }
.wrapper { display: block; justify-content: centre; align-items: center; min-height: 100%; }
.card { width: 90%; max-width: 900px; padding: 24px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.1); }
button { padding: 10px 18px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; }
`,
      'script.js': '// No JavaScript needed for this task.\n',
    },
    editable: ['style.css'],
    fixed: {
      'style.css': `body { margin: 0; font-family: sans-serif; background-color: #eef4f7; }
.wrapper { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.card { width: 90%; max-width: 400px; padding: 24px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.1); }
button { padding: 10px 18px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; }
`,
    },
    tests: [
      { hidden: false, name: 'Wrapper uses flexbox or grid', check: "const d=getComputedStyle(document.querySelector('.wrapper')).display; return d==='flex' || d==='grid' || d==='inline-flex' || d==='inline-grid';" },
      { hidden: false, name: 'Card is centred horizontally', check: "const w=document.querySelector('.wrapper'), c=document.querySelector('.card'); const r=c.getBoundingClientRect(); if (r.width>0) return Math.abs((r.left + r.width/2) - window.innerWidth/2) < 3; const s=getComputedStyle(w); return s.display==='flex' ? s.justifyContent==='center' : (s.justifyContent==='center' || s.justifyItems==='center' || s.placeItems==='center');" },
      { hidden: false, name: 'Card is centred vertically', check: "const w=document.querySelector('.wrapper'), c=document.querySelector('.card'); const r=c.getBoundingClientRect(); if (r.width>0) return Math.abs((r.top + r.height/2) - window.innerHeight/2) < 3; const s=getComputedStyle(w); return s.alignItems==='center' || s.placeItems==='center' || s.alignContent==='center';" },
      { hidden: true, name: 'Wrapper fills the viewport height', check: "const w=document.querySelector('.wrapper'); const r=w.getBoundingClientRect(); if (r.height>0) return r.height >= window.innerHeight - 1; const s=getComputedStyle(w); return s.minHeight==='100vh' || s.height==='100vh';" },
      { hidden: true, name: 'Card is at most 400px wide', check: "const c=document.querySelector('.card'); const r=c.getBoundingClientRect(); if (r.width>0) return r.width <= 400.5; return parseFloat(getComputedStyle(c).maxWidth) <= 400;" },
      { hidden: true, name: 'Card keeps white background and 12px radius', check: "const s=getComputedStyle(document.querySelector('.card')); return !!s.backgroundColor && s.borderRadius==='12px';" },
    ],
  },

  // ───────────── MEDIUM: form validation ─────────────
  {
    difficulty: 'medium', title: 'Signup Form Validation',
    statement: 'The signup form validates nothing properly. Fix `script.js` so that on submit it: prevents the page reload; shows **"Enter a valid email"** in `#email-error` for an invalid email (must contain `@` and a dot in the domain); shows **"Password must be at least 8 characters"** in `#password-error` for short passwords; **clears old errors** on every submit; and, when everything is valid, reveals `#success` with text containing the email.',
    constraints: ['Use the submit event on #signup', 'Errors must be cleared when input becomes valid', '#success is hidden unless the form is valid'],
    tags: ['javascript', 'forms', 'validation', 'events'],
    files: {
      'index.html': page('Sign up', `  <form id="signup" novalidate>
    <label>Email <input id="email" type="text" placeholder="you@company.com"></label>
    <div id="email-error" class="error"></div>
    <label>Password <input id="password" type="password"></label>
    <div id="password-error" class="error"></div>
    <button type="submit">Sign up</button>
  </form>
  <p id="success" hidden></p>`),
      'style.css': `body { font-family: sans-serif; max-width: 380px; margin: 48px auto; }
label { display: block; margin-top: 12px; font-weight: 600; }
input { display: block; width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; }
.error { color: #b53b50; font-size: 13px; min-height: 16px; }
#success { color: #168456; font-weight: 700; }
button { margin-top: 16px; padding: 10px 18px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; }
`,
      'script.js': `const form = document.querySelector('#signup');

form.addEventListener('submit', (e) => {
  const email = document.querySelector('#email').value;
  const password = document.querySelector('#password').value;

  if (!/^\\S+$/.test(email)) {
    document.querySelector('#email-error').textContent = 'Enter a valid email';
  }
  if (password.length < 6) {
    document.querySelector('#password-error').textContent = 'Password too short';
  }
});
`,
    },
    fixed: {
      'script.js': `const form = document.querySelector('#signup');
const emailEl = document.querySelector('#email');
const passEl = document.querySelector('#password');
const emailErr = document.querySelector('#email-error');
const passErr = document.querySelector('#password-error');
const success = document.querySelector('#success');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = emailEl.value.trim();
  const password = passEl.value;

  emailErr.textContent = '';
  passErr.textContent = '';
  success.hidden = true;

  let ok = true;
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { emailErr.textContent = 'Enter a valid email'; ok = false; }
  if (password.length < 8) { passErr.textContent = 'Password must be at least 8 characters'; ok = false; }

  if (ok) {
    success.textContent = 'Welcome, ' + email + '!';
    success.hidden = false;
  }
});
`,
    },
    tests: [
      { hidden: false, name: 'Submit handler prevents the default page reload', check: "document.querySelector('#email').value='dev@hpai.com'; document.querySelector('#password').value='password123'; const ev=new Event('submit',{cancelable:true,bubbles:true}); const notPrevented=document.querySelector('#signup').dispatchEvent(ev); return notPrevented === false;" },
      { hidden: false, name: 'Invalid email shows "Enter a valid email"', check: "document.querySelector('#email').value='abc'; document.querySelector('#password').value='longenough1'; document.querySelector('#signup').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return document.querySelector('#email-error').textContent.trim() === 'Enter a valid email';" },
      { hidden: false, name: 'Short password shows the 8-character message', check: "document.querySelector('#email').value='a@b.co'; document.querySelector('#password').value='1234567'; document.querySelector('#signup').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return document.querySelector('#password-error').textContent.trim() === 'Password must be at least 8 characters';" },
      { hidden: true, name: 'Valid input: no errors and #success is visible with the email', check: "document.querySelector('#email').value='dev@hpai.com'; document.querySelector('#password').value='password123'; document.querySelector('#signup').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); const s=document.querySelector('#success'); return document.querySelector('#email-error').textContent.trim()==='' && document.querySelector('#password-error').textContent.trim()==='' && s.hidden===false && s.textContent.includes('dev@hpai.com');" },
      { hidden: true, name: 'Errors are cleared after the input is corrected', check: "const f=document.querySelector('#signup'); const send=(e,p)=>{document.querySelector('#email').value=e; document.querySelector('#password').value=p; f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));}; send('bad','short'); send('ok@x.io','longpassword'); return document.querySelector('#email-error').textContent.trim()==='' && document.querySelector('#password-error').textContent.trim()==='';" },
      { hidden: true, name: 'Email without a domain dot (a@b) is rejected and success stays hidden', check: "document.querySelector('#email').value='a@b'; document.querySelector('#password').value='longpassword'; document.querySelector('#signup').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return document.querySelector('#email-error').textContent.trim() !== '' && document.querySelector('#success').hidden === true;" },
    ],
  },

  // ───────────── MEDIUM: todo list ─────────────
  {
    difficulty: 'medium', title: 'Todo List Add & Remove',
    statement: 'Fix the todo app in `script.js`. Requirements: clicking **Add** (or pressing **Enter** in the input) appends a task; the text is trimmed, shown as plain text (never interpreted as HTML), and blank tasks are ignored; the input is cleared after adding; each task\'s **x** button removes **that** task only; and `#count` always reads `N items left` (`1 item left` for one, `0 items left` when empty).',
    constraints: ['Each task is an <li> inside #list', 'Delete button has class "delete"', 'Counter text: "0 items left", "1 item left", "2 items left" ...'],
    tags: ['javascript', 'dom', 'events', 'security'],
    files: {
      'index.html': page('Todos', `  <h1>Todos</h1>
  <div class="row">
    <input id="todo-input" placeholder="Add a task">
    <button id="add-btn">Add</button>
  </div>
  <ul id="list"></ul>
  <p id="count">0 items left</p>`),
      'style.css': `body { font-family: sans-serif; max-width: 420px; margin: 40px auto; }
.row { display: flex; gap: 8px; }
.row input { flex: 1; padding: 8px; }
button { padding: 8px 14px; border: 0; border-radius: 8px; background: #1f6688; color: #fff; cursor: pointer; }
li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dce8ed; list-style: none; }
ul { padding: 0; }
#count { color: #718895; font-size: 13px; }
`,
      'script.js': `const input = document.querySelector('#todo-input');
const list = document.querySelector('#list');
const count = document.querySelector('#count');

document.querySelector('#add-btn').addEventListener('click', () => {
  const li = document.createElement('li');
  li.innerHTML = '<span>' + input.value + '</span> <button class="delete">x</button>';
  list.appendChild(li);
  li.querySelector('.delete').addEventListener('click', () => {
    list.lastChild.remove();
  });
});
`,
    },
    fixed: {
      'script.js': `const input = document.querySelector('#todo-input');
const list = document.querySelector('#list');
const count = document.querySelector('#count');

function updateCount() {
  const n = list.children.length;
  count.textContent = n + (n === 1 ? ' item' : ' items') + ' left';
}

function addTodo() {
  const text = input.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  const span = document.createElement('span');
  span.textContent = text;
  const del = document.createElement('button');
  del.className = 'delete';
  del.textContent = 'x';
  del.addEventListener('click', () => { li.remove(); updateCount(); });
  li.append(span, del);
  list.appendChild(li);
  input.value = '';
  updateCount();
  input.focus();
}

document.querySelector('#add-btn').addEventListener('click', addTodo);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
updateCount();
`,
    },
    tests: [
      { hidden: false, name: 'Adds a task as plain text (HTML is not interpreted)', check: "const list=document.querySelector('#list'); list.innerHTML=''; const i=document.querySelector('#todo-input'); i.value='Buy milk'; document.querySelector('#add-btn').click(); const ok1 = list.children.length===1 && list.textContent.includes('Buy milk'); list.innerHTML=''; i.value='<b>bold</b>'; document.querySelector('#add-btn').click(); return ok1 && list.querySelector('b')===null && list.textContent.includes('<b>bold</b>');" },
      { hidden: false, name: 'Input is cleared after adding', check: "document.querySelector('#list').innerHTML=''; const i=document.querySelector('#todo-input'); i.value='task'; document.querySelector('#add-btn').click(); return i.value === '';" },
      { hidden: false, name: 'Blank or whitespace-only tasks are ignored', check: "const list=document.querySelector('#list'); list.innerHTML=''; const i=document.querySelector('#todo-input'), b=document.querySelector('#add-btn'); i.value='   '; b.click(); i.value=''; b.click(); return list.children.length === 0;" },
      { hidden: true, name: 'Counter reads "1 item left" then "2 items left"', check: "const list=document.querySelector('#list'); list.innerHTML=''; const i=document.querySelector('#todo-input'), b=document.querySelector('#add-btn'), c=document.querySelector('#count'); i.value='a'; b.click(); const one=c.textContent.trim(); i.value='b'; b.click(); return one==='1 item left' && c.textContent.trim()==='2 items left';" },
      { hidden: true, name: 'Delete removes only its own task and updates the counter', check: "const list=document.querySelector('#list'); list.innerHTML=''; const i=document.querySelector('#todo-input'), b=document.querySelector('#add-btn'); for (const t of ['a','b','c']) { i.value=t; b.click(); } list.children[0].querySelector('.delete').click(); const texts=[...list.children].map(li=>li.querySelector('span') ? li.querySelector('span').textContent : li.textContent.replace('x','').trim()); return texts.join(',')==='b,c' && document.querySelector('#count').textContent.trim()==='2 items left';" },
      { hidden: true, name: 'Pressing Enter in the input adds a task', check: "const list=document.querySelector('#list'); list.innerHTML=''; const i=document.querySelector('#todo-input'); i.value='Enter task'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return list.children.length===1;" },
    ],
  },

  // ───────────── HARD: accessible tabs ─────────────
  {
    difficulty: 'hard', title: 'Accessible Tabs with Keyboard Support',
    statement: 'The pricing tabs only toggle a CSS class. Implement a proper tab widget in `script.js`: clicking a tab shows **only** its panel (use the `hidden` property) and sets `aria-selected="true"` on it (`"false"` on the others); the active tab has `tabindex="0"` and the rest `-1` (roving tabindex); **ArrowRight / ArrowLeft** move to the next/previous tab (wrapping around) and focus it; **Home / End** jump to the first / last tab. Initially, tab 1 must be selected and the other panels hidden.',
    constraints: ['Panels are found through each tab\'s aria-controls', 'Keyboard handling on the tab buttons (keydown)', 'Use element.hidden to hide panels', 'Initial state: first tab active'],
    tags: ['javascript', 'accessibility', 'aria', 'keyboard'],
    files: {
      'index.html': page('Plans', `  <div class="tabs">
    <div role="tablist" aria-label="Plans" id="tablist">
      <button role="tab" id="tab-1" aria-controls="panel-1" aria-selected="true" tabindex="0">Basic</button>
      <button role="tab" id="tab-2" aria-controls="panel-2" aria-selected="false" tabindex="-1">Pro</button>
      <button role="tab" id="tab-3" aria-controls="panel-3" aria-selected="false" tabindex="-1">Team</button>
    </div>
    <div role="tabpanel" id="panel-1" aria-labelledby="tab-1">Basic: 1 user, community support.</div>
    <div role="tabpanel" id="panel-2" aria-labelledby="tab-2">Pro: 10 users, email support.</div>
    <div role="tabpanel" id="panel-3" aria-labelledby="tab-3">Team: unlimited users, priority support.</div>
  </div>`),
      'style.css': `body { font-family: sans-serif; max-width: 480px; margin: 40px auto; }
[role="tablist"] { display: flex; gap: 4px; border-bottom: 2px solid #dce8ed; }
[role="tab"] { padding: 10px 16px; border: 0; background: none; cursor: pointer; color: #718895; font-weight: 700; }
[role="tab"].active, [role="tab"][aria-selected="true"] { color: #173f59; border-bottom: 3px solid #0bd37a; }
[role="tabpanel"] { padding: 16px 4px; }
[hidden] { display: none !important; }
`,
      'script.js': `const tabs = [...document.querySelectorAll('[role="tab"]')];

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
  });
});
`,
    },
    fixed: {
      'script.js': `const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

function select(index, focus) {
  tabs.forEach((tab, i) => {
    const on = i === index;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    tab.classList.toggle('active', on);
    panels[i].hidden = !on;
  });
  if (focus) tabs[index].focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(i));
  tab.addEventListener('keydown', (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) { e.preventDefault(); select(next, true); }
  });
});

select(0);
`,
    },
    tests: [
      { hidden: false, name: 'Selecting Tab 2 shows only panel 2', check: "const t=(n)=>document.getElementById('tab-'+n), p=(n)=>document.getElementById('panel-'+n); t(2).click(); return p(2).hidden===false && p(1).hidden===true && p(3).hidden===true;" },
      { hidden: false, name: 'aria-selected follows the active tab', check: "const t=(n)=>document.getElementById('tab-'+n); t(3).click(); return t(3).getAttribute('aria-selected')==='true' && t(1).getAttribute('aria-selected')==='false' && t(2).getAttribute('aria-selected')==='false';" },
      { hidden: false, name: 'Roving tabindex: active tab 0, others -1', check: "const t=(n)=>document.getElementById('tab-'+n); t(2).click(); return t(2).getAttribute('tabindex')==='0' && t(1).getAttribute('tabindex')==='-1' && t(3).getAttribute('tabindex')==='-1';" },
      { hidden: true, name: 'ArrowRight selects and focuses the next tab', check: "const t=(n)=>document.getElementById('tab-'+n), p=(n)=>document.getElementById('panel-'+n); t(1).click(); t(1).dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})); return t(2).getAttribute('aria-selected')==='true' && document.activeElement===t(2) && p(2).hidden===false && p(1).hidden===true;" },
      { hidden: true, name: 'Arrow keys wrap around at both ends', check: "const t=(n)=>document.getElementById('tab-'+n); const key=(el,k)=>el.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true})); t(3).click(); key(t(3),'ArrowRight'); const wrapped = t(1).getAttribute('aria-selected')==='true'; key(t(1),'ArrowLeft'); return wrapped && t(3).getAttribute('aria-selected')==='true';" },
      { hidden: true, name: 'Home and End jump to first and last tab', check: "const t=(n)=>document.getElementById('tab-'+n); const key=(el,k)=>el.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true})); t(2).click(); key(t(2),'End'); const last = t(3).getAttribute('aria-selected')==='true' && document.activeElement===t(3); key(t(3),'Home'); return last && t(1).getAttribute('aria-selected')==='true' && document.activeElement===t(1);" },
    ],
  },
];

// ═════════════ MCQ (AI/ML scenario based) ═════════════
export const mcqAuthor = [
  // ───── EASY (marks 5, ~1 min)
  { difficulty: 'easy', title: 'Spot the Overfit', tags: ['overfitting', 'evaluation'],
    scenario: 'A team trains a claim-denial classifier. After 40 epochs, training accuracy is 99% while validation accuracy has stalled at 71% and validation loss keeps rising.',
    statement: 'What is the most likely problem?',
    options: ['Underfitting: the model is too simple', 'Overfitting: the model memorised the training data', 'The validation set is too large to be reliable', 'The learning rate is too low to make progress'], correct: [1] },
  { difficulty: 'easy', title: 'Accuracy on Rare Fraud', tags: ['imbalance', 'metrics'],
    scenario: 'Only 0.5% of 200,000 transactions are fraudulent. A model that labels every transaction "not fraud" reports 99.5% accuracy.',
    statement: 'Which evaluation approach best reflects real usefulness?',
    options: ['Keep using accuracy; 99.5% is excellent', 'Evaluate only on the majority class', 'Use mean squared error on the labels', 'Report precision, recall and F1 (or PR-AUC) for the fraud class'], correct: [3] },
  { difficulty: 'easy', title: 'Mixed Feature Scales', tags: ['preprocessing', 'scaling', 'knn'],
    scenario: 'A kNN model uses "age" (18-90) and "annual_income" (20,000-2,000,000). Predictions seem to depend almost entirely on income.',
    statement: 'What is the right fix?',
    options: ['Drop age because it has a small range', 'Standardise or min-max scale both features', 'Increase k to the size of the dataset', 'Convert income into a free-text string'], correct: [1] },
  { difficulty: 'easy', title: 'Screening Priority', tags: ['metrics', 'recall', 'healthcare'],
    scenario: 'A model screens patients for a serious but treatable condition. A missed case (false negative) can be life-threatening, while a false alarm only leads to one extra test.',
    statement: 'Which metric should the team prioritise?',
    options: ['Precision', 'Accuracy', 'Recall (sensitivity)', 'Specificity'], correct: [2] },
  { difficulty: 'easy', title: 'Read the Confusion Matrix', tags: ['metrics', 'confusion matrix'],
    scenario: 'A claims-fraud classifier produced: TP = 40, FP = 10, FN = 20, TN = 130.',
    statement: 'What is the precision of the model?',
    options: ['0.67', '0.93', '0.80', '0.50'], correct: [2] },
  { difficulty: 'easy', title: 'Cures for Overfitting', tags: ['overfitting', 'regularisation'], multiple: true,
    scenario: 'Your neural network scores far better on training data than on validation data.',
    statement: 'Select ALL techniques that typically reduce overfitting.',
    options: ['Add more (diverse) training data', 'Apply dropout or L2 regularisation', 'Significantly increase the number of layers', 'Use early stopping on validation loss'], correct: [0, 1, 3] },
  // ───── MEDIUM (marks 10, ~2 min)
  { difficulty: 'medium', title: 'Scaler Before the Split', tags: ['data leakage', 'preprocessing'],
    scenario: 'An analyst standardises the entire dataset (mean/std computed on all rows) and only then splits into train and test sets. Test performance looks excellent, but production results disappoint.',
    statement: 'What went wrong and how should it be fixed?',
    options: ['Nothing; scaling never affects evaluation', 'Test information leaked into the scaler; fit the scaler on the training split only and apply it to the test split', 'Standardisation must be applied after the model is trained', 'The test split is too small; add more features'], correct: [1] },
  { difficulty: 'medium', title: 'The Future-Only Feature', tags: ['data leakage', 'feature engineering', 'healthcare'],
    scenario: 'A readmission-risk model uses a field "final_claim_adjudication_code" that is only populated 30 days after discharge. Offline AUC is 0.97.',
    statement: 'What should you do?',
    options: ['Keep it; a high AUC proves it is a strong feature', 'Normalise the feature and retrain', 'Remove features that are not available at prediction time (target leakage)', 'Apply dropout so the model ignores it'], correct: [2] },
  { difficulty: 'medium', title: 'Exploding Loss', tags: ['optimisation', 'learning rate'],
    scenario: 'The training loss of a deep network goes 2.3 -> 9.8 -> 1e5 -> NaN within a few steps. The learning rate is 1.0 and there is no gradient clipping.',
    statement: 'Which is the most appropriate first step?',
    options: ['Increase the learning rate further', 'Remove the validation set', 'Add more output neurons', 'Reduce the learning rate and consider gradient clipping'], correct: [3] },
  { difficulty: 'medium', title: 'Policy Bot Hallucinations', tags: ['llm', 'rag', 'hallucination'],
    scenario: 'A clinic\'s chat assistant built on a general-purpose LLM confidently quotes insurance policies that do not exist. The real policy documents change every month.',
    statement: 'Which approach best reduces hallucinations while staying current?',
    options: ['Retrieval-augmented generation (RAG) over the current policy documents, with citations', 'Fine-tune once on last year\'s policies and never update', 'Raise the sampling temperature for more creative answers', 'Switch to a bigger model without giving it any documents'], correct: [0] },
  { difficulty: 'medium', title: 'Both Curves Stay High', tags: ['bias-variance', 'learning curves'],
    scenario: 'Learning curves show high training error and high validation error that plateau close together as more data is added.',
    statement: 'What does this indicate and what is a sensible response?',
    options: ['High variance; collect even more data', 'Data leakage; shuffle the labels', 'High bias (underfitting); use a more expressive model, richer features or less regularisation', 'A good fit; deploy as is'], correct: [2] },
  { difficulty: 'medium', title: 'Fairness Audit on Rural Members', tags: ['fairness', 'evaluation', 'healthcare'], multiple: true,
    scenario: 'A claims-triage model has an overall AUC of 0.92, but members in rural ZIP codes suffer far more false negatives.',
    statement: 'Select ALL appropriate next steps.',
    options: ['Evaluate recall and calibration per subgroup', 'Collect or reweight data to represent rural members better', 'Report only the overall AUC to stakeholders', 'Review per-subgroup thresholds and the cost of errors'], correct: [0, 1, 3] },
  { difficulty: 'medium', title: 'SMOTE Before Cross-Validation', tags: ['imbalance', 'data leakage', 'cross-validation'],
    scenario: 'With a 1:99 class ratio, a data scientist applies SMOTE to the whole dataset and then runs 5-fold cross-validation. CV recall is 0.97, but live recall is 0.40.',
    statement: 'Why is the cross-validation score inflated?',
    options: ['Synthetic samples built from validation-fold neighbours leak into training; resample inside each training fold only', 'SMOTE always lowers recall', 'Cross-validation cannot be used with imbalanced data', 'Five folds is too few; use leave-one-out'], correct: [0] },
  // ───── HARD (marks 15, ~3 min)
  { difficulty: 'hard', title: 'Choosing the Denial Threshold', tags: ['thresholds', 'precision-recall', 'operations'],
    scenario: 'A claim-denial model (2% positives) at threshold 0.5 has precision 80% and recall 15%. Operations wants to catch at least 60% of denials and can review roughly three times as many claims as there are true denials per week.',
    statement: 'What is the best next step?',
    options: ['Keep the threshold at 0.5; precision is high', 'Retrain using accuracy as the objective', 'Use the precision-recall curve to pick a lower threshold with at least 60% recall, then check the implied review volume against capacity', 'Raise the threshold to 0.9 to improve recall'], correct: [2] },
  { difficulty: 'hard', title: 'Why Scale Attention?', tags: ['transformers', 'attention', 'deep learning'],
    scenario: 'While implementing a transformer from scratch, training is unstable when d_k is large: softmax outputs are nearly one-hot and gradients vanish. The original paper divides QK^T by sqrt(d_k).',
    statement: 'Why does the sqrt(d_k) scaling help?',
    options: ['It reduces the number of trainable parameters', 'It keeps dot-product magnitudes from growing with dimension, avoiding saturated softmax and tiny gradients', 'It makes the attention causal', 'It replaces positional encodings'], correct: [1] },
  { difficulty: 'hard', title: 'Forecast Looks Great Offline', tags: ['time series', 'data leakage', 'cross-validation'],
    scenario: 'For daily claim-volume forecasting, random 5-fold cross-validation gives a MAPE of 4%, but in production the MAPE is 15%.',
    statement: 'What is the most likely cause and the fix?',
    options: ['Too few folds; use 50 random folds', 'MAPE is invalid for forecasting; switch to accuracy', 'The model is underfitting; remove all lag features', 'Temporal leakage from shuffling time-ordered data; use walk-forward / time-based splits'], correct: [3] },
  { difficulty: 'hard', title: 'Improving RAG Retrieval', tags: ['rag', 'retrieval', 'llm'], multiple: true,
    scenario: 'A RAG assistant often retrieves irrelevant chunks, so answers cite the wrong policy sections.',
    statement: 'Select ALL changes likely to improve retrieval quality.',
    options: ['Tune chunk size/overlap and keep section titles inside chunks', 'Combine keyword (BM25) and embedding search, then rerank', 'Raise the generation temperature', 'Measure recall@k on a labelled set of real questions to guide changes'], correct: [0, 1, 3] },
  { difficulty: 'hard', title: 'Is Model B Really Better?', tags: ['evaluation', 'statistics', 'model comparison'],
    scenario: 'Model B\'s AUC is 0.81 versus 0.79 for model A on the same 5,000-row test set. A stakeholder wants to ship B immediately.',
    statement: 'What should you do before claiming B is better?',
    options: ['Ship B; 0.81 is greater than 0.79', 'Estimate the uncertainty of the AUC difference (e.g. paired bootstrap or DeLong test on the same samples) and weigh it against business impact', 'Retrain A until its AUC exceeds 0.81', 'Compare accuracy at one arbitrary threshold only'], correct: [1] },
];
