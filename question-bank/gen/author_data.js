// Authoring source for SQL + NoSQL questions. Expected outputs are NOT written here:
// gen/build.js computes them by running `reference` and emits backend/seed/q_other.js with literal values.
// Dataset `h` = hidden test.

export const sqlAuthor = [
  // ───────────── EASY ─────────────
  {
    difficulty: 'easy', title: 'High Earners',
    statement: 'The `employees` table lists staff and their salaries. Return the `name` and `salary` of every employee earning **strictly more than 50000**, ordered by salary (highest first). If two employees have the same salary, order them by name alphabetically.',
    schema_sql: 'CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, department TEXT, salary INTEGER);',
    ordered: true, tags: ['filter', 'order by'], constraints: ['Return exactly two columns: name, salary', 'salary must be strictly greater than 50000'],
    reference_sql: 'SELECT name, salary FROM employees WHERE salary > 50000 ORDER BY salary DESC, name ASC;',
    datasets: [
      { h: false, sql: "INSERT INTO employees VALUES (1,'Asha','Eng',72000),(2,'Ravi','Ops',48000),(3,'Meera','Eng',91000),(4,'Karan','HR',55000);" },
      { h: false, sql: "INSERT INTO employees VALUES (1,'Zoya','Eng',60000),(2,'Aman','Eng',60000),(3,'Neel','Ops',60000),(4,'Ira','HR',75000);" },
      { h: true, sql: "INSERT INTO employees VALUES (1,'Dev','Ops',50000),(2,'Sana','HR',50001),(3,'Omar','Ops',49999);" },
      { h: true, sql: "INSERT INTO employees VALUES (1,'Lia','Eng',30000),(2,'Tom','Ops',45000);" },
      { h: true, sql: '' },
    ],
  },
  {
    difficulty: 'easy', title: 'Orders per Customer',
    statement: 'The `orders` table records every order. For each customer who has placed **at least one** order, return `customer_id` and the number of orders as `order_count`. Sort by `order_count` descending, then `customer_id` ascending.',
    schema_sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL, status TEXT);',
    ordered: true, tags: ['group by', 'count'], constraints: ['Columns: customer_id, order_count', 'Cancelled orders still count'],
    reference_sql: 'SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id ORDER BY order_count DESC, customer_id ASC;',
    datasets: [
      { h: false, sql: "INSERT INTO orders VALUES (1,10,250,'paid'),(2,11,90,'paid'),(3,10,40,'cancelled'),(4,12,500,'paid'),(5,10,75,'paid');" },
      { h: false, sql: "INSERT INTO orders VALUES (1,5,10,'paid'),(2,3,20,'paid'),(3,5,30,'paid'),(4,3,40,'paid');" },
      { h: true, sql: "INSERT INTO orders VALUES (1,7,99.5,'paid');" },
      { h: true, sql: "INSERT INTO orders VALUES (1,1,5,'paid'),(2,2,5,'paid'),(3,3,5,'paid'),(4,3,5,'paid'),(5,2,5,'paid'),(6,1,5,'paid'),(7,4,5,'paid');" },
      { h: true, sql: '' },
    ],
  },
  {
    difficulty: 'easy', title: 'Books and Their Authors',
    statement: 'Join `authors` and `books` to list every book together with its author. Return `author_name` and `title`, ordered by author name and then by title. Authors without books must not appear.',
    schema_sql: 'CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE books (id INTEGER PRIMARY KEY, author_id INTEGER, title TEXT);',
    ordered: true, tags: ['join'], constraints: ['Columns: author_name, title'],
    reference_sql: 'SELECT a.name AS author_name, b.title FROM books b JOIN authors a ON a.id = b.author_id ORDER BY a.name, b.title;',
    datasets: [
      { h: false, sql: "INSERT INTO authors VALUES (1,'Orwell'),(2,'Austen'),(3,'Tolstoy');\nINSERT INTO books VALUES (1,1,'1984'),(2,2,'Emma'),(3,1,'Animal Farm'),(4,2,'Persuasion');" },
      { h: false, sql: "INSERT INTO authors VALUES (1,'Rao'),(2,'Das');\nINSERT INTO books VALUES (1,2,'Zero'),(2,2,'Alpha');" },
      { h: true, sql: "INSERT INTO authors VALUES (1,'Solo');\nINSERT INTO books VALUES (1,1,'Only One');" },
      { h: true, sql: "INSERT INTO authors VALUES (1,'A'),(2,'B');" },
      { h: true, sql: "INSERT INTO authors VALUES (1,'Kafka'),(2,'Camus');\nINSERT INTO books VALUES (1,1,'The Trial'),(2,2,'The Plague'),(3,2,'The Stranger'),(4,1,'The Castle');" },
    ],
  },
  // ───────────── MEDIUM ─────────────
  {
    difficulty: 'medium', title: 'Departments Paying Above 60k',
    statement: 'Return every department whose **average salary is greater than 60000**. Output `department` (the department name) and `avg_salary` rounded to 2 decimals, sorted by `avg_salary` descending then `department` ascending. Departments with no employees must not appear.',
    schema_sql: 'CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary INTEGER);',
    ordered: true, tags: ['join', 'group by', 'having'], constraints: ['Columns: department, avg_salary', 'Round with ROUND(x, 2)'],
    reference_sql: 'SELECT d.name AS department, ROUND(AVG(e.salary), 2) AS avg_salary FROM departments d JOIN employees e ON e.dept_id = d.id GROUP BY d.id, d.name HAVING AVG(e.salary) > 60000 ORDER BY avg_salary DESC, department ASC;',
    datasets: [
      { h: false, sql: "INSERT INTO departments VALUES (1,'Eng'),(2,'Ops'),(3,'HR');\nINSERT INTO employees VALUES (1,'A',1,90000),(2,'B',1,70000),(3,'C',2,50000),(4,'D',2,65000),(5,'E',3,40000);" },
      { h: false, sql: "INSERT INTO departments VALUES (1,'Data'),(2,'Legal');\nINSERT INTO employees VALUES (1,'A',1,60000),(2,'B',1,60001),(3,'C',2,60000);" },
      { h: true, sql: "INSERT INTO departments VALUES (1,'X'),(2,'Y'),(3,'Empty');\nINSERT INTO employees VALUES (1,'A',1,61000),(2,'B',1,62000),(3,'C',1,64500),(4,'D',2,61000),(5,'E',2,61000);" },
      { h: true, sql: "INSERT INTO departments VALUES (1,'Alpha'),(2,'Beta');\nINSERT INTO employees VALUES (1,'A',1,70000),(2,'B',2,70000);" },
      { h: true, sql: "INSERT INTO departments VALUES (1,'Solo');" },
    ],
  },
  {
    difficulty: 'medium', title: 'Second Highest Salary',
    statement: 'Write a query returning the **second highest distinct salary** from `employees` as a single column named `second_highest`. If there is no second highest salary (fewer than two distinct salaries), return a single row with `NULL`.',
    schema_sql: 'CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, salary INTEGER);',
    ordered: false, tags: ['subquery', 'distinct', 'limit offset'], constraints: ['Always return exactly one row, one column: second_highest', 'Duplicates of the top salary must not count as the second'],
    reference_sql: 'SELECT (SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1) AS second_highest;',
    datasets: [
      { h: false, sql: "INSERT INTO employees VALUES (1,'A',100),(2,'B',200),(3,'C',300);" },
      { h: false, sql: "INSERT INTO employees VALUES (1,'A',300),(2,'B',300),(3,'C',200),(4,'D',200);" },
      { h: true, sql: "INSERT INTO employees VALUES (1,'A',500);" },
      { h: true, sql: "INSERT INTO employees VALUES (1,'A',100),(2,'B',100),(3,'C',100);" },
      { h: true, sql: '' },
      { h: true, sql: "INSERT INTO employees VALUES (1,'A',-5),(2,'B',0);" },
    ],
  },
  {
    difficulty: 'medium', title: 'Rank Reps Within Region',
    statement: 'For each region, rank sales reps by their **total sales amount** (highest first) using dense ranking (ties share a rank, next rank is not skipped). Return `region`, `rep`, `total` and `rank_in_region`, ordered by `region`, `rank_in_region`, `rep`.',
    schema_sql: 'CREATE TABLE sales (id INTEGER PRIMARY KEY, region TEXT, rep TEXT, amount INTEGER);',
    ordered: true, tags: ['window function', 'dense_rank'], constraints: ['Columns: region, rep, total, rank_in_region', 'Rank 1 = highest total'],
    reference_sql: 'SELECT region, rep, SUM(amount) AS total, DENSE_RANK() OVER (PARTITION BY region ORDER BY SUM(amount) DESC) AS rank_in_region FROM sales GROUP BY region, rep ORDER BY region, rank_in_region, rep;',
    datasets: [
      { h: false, sql: "INSERT INTO sales VALUES (1,'North','Anil',100),(2,'North','Bela',300),(3,'North','Anil',250),(4,'South','Chen',50),(5,'South','Dia',80);" },
      { h: false, sql: "INSERT INTO sales VALUES (1,'East','P',100),(2,'East','Q',100),(3,'East','R',40);" },
      { h: true, sql: "INSERT INTO sales VALUES (1,'West','Solo',10);" },
      { h: true, sql: "INSERT INTO sales VALUES (1,'N','A',5),(2,'N','B',9),(3,'N','C',9),(4,'N','D',1),(5,'S','E',7),(6,'S','F',3),(7,'S','E',1);" },
      { h: true, sql: '' },
    ],
  },
  // ───────────── HARD ─────────────
  {
    difficulty: 'hard', title: 'Top Customer of Each Month',
    statement: 'For every calendar month (formatted `YYYY-MM`) that has at least one order, find the customer with the **highest total revenue** in that month. Revenue of an order is the sum of `qty * price` over its `order_items`. If two customers tie, pick the one with the smaller `customer_id`. Return `month`, `customer_name`, `revenue`, ordered by `month`.',
    schema_sql: 'CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, order_date TEXT);\nCREATE TABLE order_items (order_id INTEGER, qty INTEGER, price REAL);',
    ordered: true, tags: ['cte', 'join', 'window function', 'group by'], constraints: ['Dates are ISO strings (YYYY-MM-DD); use strftime or substr', 'Columns: month, customer_name, revenue'],
    reference_sql: "WITH rev AS (SELECT strftime('%Y-%m', o.order_date) AS month, c.id AS cid, c.name AS customer_name, SUM(i.qty * i.price) AS revenue FROM orders o JOIN customers c ON c.id = o.customer_id JOIN order_items i ON i.order_id = o.id GROUP BY month, c.id, c.name), ranked AS (SELECT month, customer_name, revenue, ROW_NUMBER() OVER (PARTITION BY month ORDER BY revenue DESC, cid ASC) AS rn FROM rev) SELECT month, customer_name, revenue FROM ranked WHERE rn = 1 ORDER BY month;",
    datasets: [
      { h: false, sql: "INSERT INTO customers VALUES (1,'Asha'),(2,'Ben'),(3,'Cara');\nINSERT INTO orders VALUES (1,1,'2024-01-05'),(2,2,'2024-01-20'),(3,1,'2024-02-02'),(4,3,'2024-02-15');\nINSERT INTO order_items VALUES (1,2,50),(1,1,20),(2,1,100),(3,3,10),(4,1,45),(4,1,5);" },
      { h: false, sql: "INSERT INTO customers VALUES (1,'Zed'),(2,'Amy');\nINSERT INTO orders VALUES (1,1,'2024-03-01'),(2,2,'2024-03-02');\nINSERT INTO order_items VALUES (1,2,50),(2,4,25);" },
      { h: true, sql: "INSERT INTO customers VALUES (1,'Solo');\nINSERT INTO orders VALUES (1,1,'2023-12-31'),(2,1,'2024-01-01');\nINSERT INTO order_items VALUES (1,1,10),(2,5,2);" },
      { h: true, sql: "INSERT INTO customers VALUES (1,'A'),(2,'B');\nINSERT INTO orders VALUES (1,1,'2024-05-10'),(2,2,'2024-05-11'),(3,2,'2024-05-30'),(4,1,'2024-06-01'),(5,2,'2024-06-02');\nINSERT INTO order_items VALUES (1,10,1.5),(2,1,5),(3,2,5.25),(4,1,1),(5,1,2);" },
      { h: true, sql: "INSERT INTO customers VALUES (1,'Idle');\nINSERT INTO orders VALUES (1,1,'2024-07-07');" },
    ],
  },
  {
    difficulty: 'hard', title: 'Three-Day Login Streaks',
    statement: 'The `logins` table records the dates each user logged in (a user can log in several times a day). Return the `user_id` of every user who logged in on **at least 3 consecutive calendar days** at some point. Each user appears once, ordered by `user_id`.',
    schema_sql: 'CREATE TABLE logins (user_id INTEGER, login_date TEXT);',
    ordered: true, tags: ['cte', 'window function', 'gaps and islands'], constraints: ['Column: user_id', 'Duplicate logins on the same day count once', 'Dates are ISO strings (YYYY-MM-DD); date(d, "-N days") works in SQLite'],
    reference_sql: "WITH d AS (SELECT DISTINCT user_id, login_date FROM logins), g AS (SELECT user_id, DATE(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp FROM d) SELECT DISTINCT user_id FROM g GROUP BY user_id, grp HAVING COUNT(*) >= 3 ORDER BY user_id;",
    datasets: [
      { h: false, sql: "INSERT INTO logins VALUES (1,'2024-01-01'),(1,'2024-01-02'),(1,'2024-01-03'),(2,'2024-01-01'),(2,'2024-01-03'),(2,'2024-01-04');" },
      { h: false, sql: "INSERT INTO logins VALUES (7,'2024-02-27'),(7,'2024-02-28'),(7,'2024-02-29'),(7,'2024-03-01'),(8,'2024-02-28'),(8,'2024-02-28'),(8,'2024-02-29');" },
      { h: true, sql: "INSERT INTO logins VALUES (3,'2024-12-30'),(3,'2024-12-31'),(3,'2025-01-01');" },
      { h: true, sql: "INSERT INTO logins VALUES (4,'2024-05-01'),(4,'2024-05-02'),(4,'2024-05-04'),(4,'2024-05-05'),(5,'2024-05-01'),(5,'2024-05-02'),(5,'2024-05-03'),(5,'2024-05-10'),(5,'2024-05-11'),(5,'2024-05-12'),(5,'2024-05-13');" },
      { h: true, sql: '' },
    ],
  },
];

// ═════════════ NoSQL ═════════════
// ref is a JS literal string (evaluated by the same rule as the candidate code).
export const nosqlAuthor = [
  {
    difficulty: 'easy', title: 'Affordable Electronics', mode: 'find', collection: 'products', ordered: true, tags: ['find', 'projection', 'sort'],
    statement: 'The `products` collection has documents `{ _id, name, category, price, stock }`. Find all products in the **"electronics"** category with a **price below 500**. Return only `name` and `price` (hide `_id`), sorted by price ascending.',
    constraints: ['Use a find query: { filter, projection, sort }', 'price must be strictly less than 500'],
    reference: "{ filter: { category: 'electronics', price: { $lt: 500 } }, projection: { _id: 0, name: 1, price: 1 }, sort: { price: 1 } }",
    datasets: [
      { h: false, data: [{ _id: 1, name: 'Phone', category: 'electronics', price: 450, stock: 5 }, { _id: 2, name: 'Laptop', category: 'electronics', price: 900, stock: 2 }, { _id: 3, name: 'Desk', category: 'furniture', price: 200, stock: 9 }, { _id: 4, name: 'Earbuds', category: 'electronics', price: 80, stock: 30 }] },
      { h: false, data: [{ _id: 1, name: 'Cable', category: 'electronics', price: 499, stock: 100 }, { _id: 2, name: 'Monitor', category: 'electronics', price: 500, stock: 4 }, { _id: 3, name: 'Mouse', category: 'electronics', price: 25, stock: 0 }] },
      { h: true, data: [{ _id: 1, name: 'Chair', category: 'furniture', price: 120, stock: 3 }] },
      { h: true, data: [] },
      { h: true, data: [{ _id: 1, name: 'Tablet', category: 'electronics', price: 300, stock: 1 }, { _id: 2, name: 'Watch', category: 'electronics', price: 150, stock: 8 }, { _id: 3, name: 'Speaker', category: 'electronics', price: 220, stock: 6 }] },
    ],
  },
  {
    difficulty: 'easy', title: 'Premium Users in Metro Cities', mode: 'find', collection: 'users', ordered: true, tags: ['find', '$in', 'arrays', 'limit'],
    statement: 'The `users` collection has `{ _id, name, city, active, tags: [..] }`. Find users that are **active**, live in **"Mumbai" or "Delhi"**, and have the tag **"premium"** in their `tags` array. Return only `name` and `city` (no `_id`), sorted by name ascending, and keep at most the **first 3** results.',
    constraints: ['Use { filter, projection, sort, limit }', 'tags is an array - plain equality matches array elements'],
    reference: "{ filter: { active: true, city: { $in: ['Mumbai', 'Delhi'] }, tags: 'premium' }, projection: { _id: 0, name: 1, city: 1 }, sort: { name: 1 }, limit: 3 }",
    datasets: [
      { h: false, data: [{ _id: 1, name: 'Zara', city: 'Mumbai', active: true, tags: ['premium', 'new'] }, { _id: 2, name: 'Arun', city: 'Delhi', active: true, tags: ['premium'] }, { _id: 3, name: 'Bina', city: 'Pune', active: true, tags: ['premium'] }, { _id: 4, name: 'Chet', city: 'Delhi', active: false, tags: ['premium'] }, { _id: 5, name: 'Dina', city: 'Mumbai', active: true, tags: ['basic'] }] },
      { h: false, data: [{ _id: 1, name: 'E', city: 'Delhi', active: true, tags: ['premium'] }, { _id: 2, name: 'D', city: 'Delhi', active: true, tags: ['premium'] }, { _id: 3, name: 'C', city: 'Mumbai', active: true, tags: ['premium'] }, { _id: 4, name: 'B', city: 'Mumbai', active: true, tags: ['premium'] }, { _id: 5, name: 'A', city: 'Mumbai', active: true, tags: ['premium'] }] },
      { h: true, data: [{ _id: 1, name: 'Solo', city: 'Delhi', active: true, tags: ['premium', 'vip'] }] },
      { h: true, data: [{ _id: 1, name: 'Nope', city: 'Chennai', active: true, tags: ['premium'] }] },
      { h: true, data: [] },
    ],
  },
  {
    difficulty: 'medium', title: 'Revenue per Customer', mode: 'aggregate', collection: 'orders', ordered: true, tags: ['aggregate', '$group', '$sort'],
    statement: 'The `orders` collection has `{ _id, customer, status, amount }`. Compute the **total amount of completed orders** per customer. Output documents shaped `{ customer, total }` (no `_id`), sorted by `total` descending and then `customer` ascending.',
    constraints: ['Pipeline: $match -> $group -> $project -> $sort', 'Only status "completed" counts'],
    reference: "[ { $match: { status: 'completed' } }, { $group: { _id: '$customer', total: { $sum: '$amount' } } }, { $project: { _id: 0, customer: '$_id', total: 1 } }, { $sort: { total: -1, customer: 1 } } ]",
    datasets: [
      { h: false, data: [{ _id: 1, customer: 'Asha', status: 'completed', amount: 100 }, { _id: 2, customer: 'Ben', status: 'completed', amount: 250 }, { _id: 3, customer: 'Asha', status: 'completed', amount: 90 }, { _id: 4, customer: 'Ben', status: 'cancelled', amount: 1000 }] },
      { h: false, data: [{ _id: 1, customer: 'Cy', status: 'completed', amount: 50 }, { _id: 2, customer: 'Al', status: 'completed', amount: 50 }, { _id: 3, customer: 'Bo', status: 'pending', amount: 80 }] },
      { h: true, data: [{ _id: 1, customer: 'X', status: 'pending', amount: 10 }] },
      { h: true, data: [] },
      { h: true, data: [{ _id: 1, customer: 'Q', status: 'completed', amount: 12.5 }, { _id: 2, customer: 'Q', status: 'completed', amount: 7.5 }, { _id: 3, customer: 'R', status: 'completed', amount: 19 }] },
    ],
  },
  {
    difficulty: 'medium', title: 'Busy Departments', mode: 'aggregate', collection: 'employees', ordered: true, tags: ['aggregate', '$group', '$match', '$round'],
    statement: 'The `employees` collection has `{ _id, name, dept, salary }`. For each department with **at least 2 employees**, output `{ dept, headcount, avgSalary }` where `avgSalary` is the average salary rounded to 2 decimals (`$round`). Sort by `avgSalary` descending, then `dept` ascending. Do not output `_id`.',
    constraints: ['Use $group, then $match on the count', 'Round with { $round: [ expr, 2 ] }'],
    reference: "[ { $group: { _id: '$dept', headcount: { $sum: 1 }, avg: { $avg: '$salary' } } }, { $match: { headcount: { $gte: 2 } } }, { $project: { _id: 0, dept: '$_id', headcount: 1, avgSalary: { $round: ['$avg', 2] } } }, { $sort: { avgSalary: -1, dept: 1 } } ]",
    datasets: [
      { h: false, data: [{ _id: 1, name: 'A', dept: 'Eng', salary: 100 }, { _id: 2, name: 'B', dept: 'Eng', salary: 200 }, { _id: 3, name: 'C', dept: 'Ops', salary: 50 }, { _id: 4, name: 'D', dept: 'HR', salary: 80 }, { _id: 5, name: 'E', dept: 'HR', salary: 90 }] },
      { h: false, data: [{ _id: 1, name: 'A', dept: 'X', salary: 10 }, { _id: 2, name: 'B', dept: 'X', salary: 10 }, { _id: 3, name: 'C', dept: 'Y', salary: 10 }, { _id: 4, name: 'D', dept: 'Y', salary: 10 }] },
      { h: true, data: [{ _id: 1, name: 'A', dept: 'Solo', salary: 999 }] },
      { h: true, data: [{ _id: 1, name: 'A', dept: 'T', salary: 100 }, { _id: 2, name: 'B', dept: 'T', salary: 101 }, { _id: 3, name: 'C', dept: 'T', salary: 101 }] },
      { h: true, data: [] },
    ],
  },
  {
    difficulty: 'hard', title: 'Trending Tags', mode: 'aggregate', collection: 'posts', ordered: true, tags: ['aggregate', '$unwind', '$group', '$limit'],
    statement: 'The `posts` collection has `{ _id, author, likes, tags: [..] }`. Find the **top 3 tags by total likes**. Output `{ tag, totalLikes, posts }` where `posts` is the number of posts carrying the tag. Sort by `totalLikes` descending, then `tag` ascending, and keep only the first 3. Posts with an empty `tags` array contribute nothing. Hide `_id`.',
    constraints: ['Use $unwind on tags', 'A post counts once per tag', 'Final output has at most 3 documents'],
    reference: "[ { $unwind: '$tags' }, { $group: { _id: '$tags', totalLikes: { $sum: '$likes' }, posts: { $sum: 1 } } }, { $sort: { totalLikes: -1, _id: 1 } }, { $limit: 3 }, { $project: { _id: 0, tag: '$_id', totalLikes: 1, posts: 1 } } ]",
    datasets: [
      { h: false, data: [{ _id: 1, author: 'a', likes: 10, tags: ['js', 'web'] }, { _id: 2, author: 'b', likes: 30, tags: ['js', 'node'] }, { _id: 3, author: 'c', likes: 5, tags: ['css'] }, { _id: 4, author: 'd', likes: 8, tags: ['web', 'css', 'html'] }] },
      { h: false, data: [{ _id: 1, author: 'a', likes: 5, tags: ['x', 'y'] }, { _id: 2, author: 'b', likes: 5, tags: ['y', 'z'] }, { _id: 3, author: 'c', likes: 5, tags: ['z', 'x'] }] },
      { h: true, data: [{ _id: 1, author: 'a', likes: 100, tags: [] }, { _id: 2, author: 'b', likes: 1, tags: ['only'] }] },
      { h: true, data: [] },
      { h: true, data: [{ _id: 1, author: 'a', likes: 4, tags: ['a', 'b', 'c', 'd', 'e'] }, { _id: 2, author: 'b', likes: 3, tags: ['e', 'd'] }, { _id: 3, author: 'c', likes: 2, tags: ['e'] }] },
    ],
  },
  {
    difficulty: 'hard', title: 'Subject Toppers', mode: 'aggregate', collection: 'students', ordered: true, tags: ['aggregate', '$unwind', '$group', '$first'],
    statement: 'The `students` collection has `{ _id, name, scores: [ { subject, marks } ] }`. For **each subject**, output `{ subject, avgMarks, topScorer, topMarks }` where `avgMarks` is the average marks rounded to 2 decimals, and `topScorer`/`topMarks` is the student with the highest marks in that subject (if tied, the alphabetically first name). Sort by `subject` ascending. Hide `_id`.',
    constraints: ['Hint: $unwind, then $sort before $group so $first picks the top scorer', 'Round with $round'],
    reference: "[ { $unwind: '$scores' }, { $sort: { 'scores.marks': -1, name: 1 } }, { $group: { _id: '$scores.subject', avg: { $avg: '$scores.marks' }, topScorer: { $first: '$name' }, topMarks: { $first: '$scores.marks' } } }, { $project: { _id: 0, subject: '$_id', avgMarks: { $round: ['$avg', 2] }, topScorer: 1, topMarks: 1 } }, { $sort: { subject: 1 } } ]",
    datasets: [
      { h: false, data: [{ _id: 1, name: 'Ria', scores: [{ subject: 'math', marks: 90 }, { subject: 'sci', marks: 70 }] }, { _id: 2, name: 'Sam', scores: [{ subject: 'math', marks: 80 }, { subject: 'sci', marks: 85 }] }, { _id: 3, name: 'Tia', scores: [{ subject: 'math', marks: 70 }] }] },
      { h: false, data: [{ _id: 1, name: 'Zed', scores: [{ subject: 'art', marks: 60 }] }, { _id: 2, name: 'Amy', scores: [{ subject: 'art', marks: 60 }] }] },
      { h: true, data: [{ _id: 1, name: 'Nobody', scores: [] }] },
      { h: true, data: [] },
      { h: true, data: [{ _id: 1, name: 'K', scores: [{ subject: 'eng', marks: 33 }, { subject: 'hist', marks: 91 }] }, { _id: 2, name: 'L', scores: [{ subject: 'eng', marks: 34 }, { subject: 'hist', marks: 90 }, { subject: 'geo', marks: 50 }] }, { _id: 3, name: 'M', scores: [{ subject: 'eng', marks: 34 }] }] },
    ],
  },
];
