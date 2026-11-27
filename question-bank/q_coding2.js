// Additional SHORT coding questions (Programming / DSA): 20 originals, every one takes 2-4 minutes.
// Every question has EXACTLY 10 tests: the first 3 visible, the next 7 hidden.
// `reference` is the primary JS solution (dev-only, stripped by build.js like in q_coding.js).
// More valid approaches (alternative JS solutions, Python solutions) and deliberately WRONG solutions live in the separate
// export `SOLUTIONS` (keyed by title). It is only read by validate_coding2.js and is never imported by questions.js, so
// nothing but `coding2` can ever reach the generated bank.

const SUBJECT = 'Programming (DSA)';

const mk = (difficulty, o) => ({
  subject: SUBJECT,
  type: 'coding',
  difficulty,
  marks: { easy: 10, medium: 20, hard: 30 }[difficulty],
  ...o,
});

/** rows = [[args, expected], ...] (exactly 10). The first 3 are visible samples, the other 7 are hidden. */
const tests10 = (title, rows) => {
  if (rows.length !== 10) throw new Error(`"${title}": needs exactly 10 tests, got ${rows.length}`);
  return rows.map(([args, expected], i) => ({ args, expected, hidden: i >= 3 }));
};

const SMALL = [25, 50, 100, 200, 400, 800, 1600, 3200];
const LARGE = [100, 400, 1600, 6400, 25600, 102400];
const lower = (alphabet = 26) => `String.fromCharCode(97 + Math.floor(rnd() * ${alphabet}))`;

export const coding2 = [
  // ───────────────────────────── EASY (8) ─────────────────────────────
  mk('easy', {
    title: 'Integer Square Root',
    statement:
      'Return the integer part of the square root of a non-negative integer, i.e. the largest integer `r` with `r * r <= n`. Do not use a built-in square-root function if you can avoid it.\n\nInput: an integer `n`.\nOutput: the integer `r`.',
    time_mins: 2,
    tags: ['math', 'binary-search'],
    config: {
      fn: { js: 'integerSqrt', py: 'integer_sqrt', params: ['n'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= n <= 10^12'],
      examples: [
        { input: 'n = 16', output: '4' },
        { input: 'n = 15', output: '3', explanation: '3 * 3 = 9 and 4 * 4 = 16 > 15.' },
      ],
      bench: { sizes: [100, 10000, 1000000, 100000000, 10000000000, 1000000000000], gen: '(n) => [n]' },
    },
    tests: tests10('Integer Square Root', [
      [[0], 0], [[15], 3], [[16], 4],
      [[1], 1], [[2], 1], [[24], 4], [[25], 5], [[99], 9], [[1000000], 1000], [[999999999999], 999999],
    ]),
    reference: String.raw`function integerSqrt(n) { let lo = 0, hi = Math.min(n, 2000000); while (lo < hi) { const mid = Math.floor((lo + hi + 1) / 2); if (mid * mid <= n) lo = mid; else hi = mid - 1; } return lo; }`,
  }),

  mk('easy', {
    title: 'First Unique Character',
    statement:
      'Return the first character of the text that appears exactly once. The comparison is case-sensitive ("a" and "A" are different characters). If no character is unique, return an empty string.\n\nInput: a string `text`.\nOutput: a one-character string, or "".',
    time_mins: 3,
    tags: ['string', 'hashing'],
    config: {
      fn: { js: 'firstUniqueChar', py: 'first_unique_char', params: ['text'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 10,000', 'text contains letters and digits'],
      examples: [
        { input: 'text = "loveleetcode"', output: '"v"' },
        { input: 'text = "aabb"', output: '""', explanation: 'Every character repeats.' },
      ],
      bench: { sizes: LARGE, gen: "(n) => ['ab'.repeat(Math.floor(n / 2))]" },
    },
    tests: tests10('First Unique Character', [
      [['leetcode'], 'l'], [['aabb'], ''], [['loveleetcode'], 'v'],
      [[''], ''], [['z'], 'z'], [['abcabcd'], 'd'], [['aAbB'], 'a'], [['AaBbc'], 'A'], [['112233445'], '5'], [['xxyyzzxyz'], ''],
    ]),
    reference: String.raw`function firstUniqueChar(text) { const c = {}; for (const ch of text) c[ch] = (c[ch] || 0) + 1; for (const ch of text) if (c[ch] === 1) return ch; return ''; }`,
  }),

  mk('easy', {
    title: 'Claim Line Total',
    statement:
      'A claim has several lines. `amounts[i]` is the amount of line `i` in cents (it may be negative for an adjustment) and `statuses[i]` is its status. Return the total, in cents, of the lines whose status is exactly "approved" (lower-case; "Approved" or "denied" do not count).\n\nInput: an integer array `amounts` and a string array `statuses` of the same length.\nOutput: the total as an integer.',
    time_mins: 2,
    tags: ['array', 'healthcare'],
    config: {
      fn: { js: 'approvedTotal', py: 'approved_total', params: ['amounts', 'statuses'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= amounts.length <= 10,000', 'statuses.length == amounts.length', '-10^9 <= amounts[i] <= 10^9'],
      examples: [{ input: 'amounts = [1200, 500, 300], statuses = ["approved", "denied", "approved"]', output: '1500' }],
      bench: { sizes: LARGE, gen: "(n, rnd) => [Array.from({length:n},()=>Math.floor(rnd()*10000)), Array.from({length:n},()=> rnd() < 0.5 ? 'approved' : 'denied')]" },
    },
    tests: tests10('Claim Line Total', [
      [[[1200, 500, 300], ['approved', 'denied', 'approved']], 1500], [[[], []], 0], [[[100], ['denied']], 0],
      [[[250, 250], ['approved', 'approved']], 500],
      [[[1, 2, 3, 4], ['pending', 'approved', 'pending', 'approved']], 6],
      [[[500, -100], ['approved', 'approved']], 400],
      [[[1999, 1, 0], ['approved', 'approved', 'approved']], 2000],
      [[[1000, 2000], ['Approved', 'approved']], 2000],
      [[[300, 400], ['APPROVED', 'approved']], 400],
      [[[100000000, 200000000], ['approved', 'approved']], 300000000],
    ]),
    reference: String.raw`function approvedTotal(amounts, statuses) { let t = 0; for (let i = 0; i < amounts.length; i++) if (statuses[i] === 'approved') t += amounts[i]; return t; }`,
  }),

  mk('easy', {
    title: 'Valid Member ID',
    statement:
      'A member ID is valid when it has exactly 8 characters: two upper-case letters (A-Z) followed by six digits (0-9), with nothing else (no spaces, no lower-case letters).\n\nInput: a printable-ASCII string `code`.\nOutput: true if it is a valid member ID, otherwise false.',
    time_mins: 3,
    tags: ['string', 'parsing', 'healthcare'],
    config: {
      fn: { js: 'isValidMemberId', py: 'is_valid_member_id', params: ['code'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= code.length <= 100', 'code contains printable ASCII characters only'],
      examples: [
        { input: 'code = "AB123456"', output: 'true' },
        { input: 'code = "ab123456"', output: 'false', explanation: 'The letters must be upper-case.' },
      ],
      bench: { sizes: SMALL, gen: "(n) => ['AB' + '1'.repeat(n)]" },
    },
    tests: tests10('Valid Member ID', [
      [['AB123456'], true], [['ab123456'], false], [['AB12345'], false],
      [['AB1234567'], false], [['A1234567'], false], [['ZZ000000'], true], [['AB12345X'], false], [['AB 12345'], false],
      [['aB123456'], false], [['Ab000000'], false],
    ]),
    reference: String.raw`function isValidMemberId(code) { return /^[A-Z]{2}[0-9]{6}$/.test(code); }`,
  }),

  mk('easy', {
    title: 'Find the Missing Number',
    statement:
      'The array contains `n` distinct integers taken from the range `0..n`, so exactly one number of that range is missing. Return the missing number.\n\nInput: an integer array `nums` of length `n`.\nOutput: the missing integer.',
    time_mins: 3,
    tags: ['array', 'math', 'bit-manipulation'],
    config: {
      fn: { js: 'missingNumber', py: 'missing_number', params: ['nums'] },
      languages: ['python', 'javascript'],
      constraints: ['1 <= nums.length <= 10,000', 'all values are distinct and in the range 0..nums.length'],
      examples: [
        { input: 'nums = [3, 0, 1]', output: '2' },
        { input: 'nums = [0, 1]', output: '2', explanation: 'The range is 0..2 and 2 is missing.' },
      ],
      bench: { sizes: LARGE, gen: '(n, rnd) => { const a = Array.from({length: n + 1}, (_, i) => i); a.splice(Math.floor(n / 2), 1); return [a]; }' },
    },
    tests: tests10('Find the Missing Number', [
      [[[3, 0, 1]], 2], [[[0, 1]], 2], [[[0]], 1],
      [[[1]], 0], [[[9, 6, 4, 2, 3, 5, 7, 0, 1]], 8], [[[0, 1, 2, 3]], 4], [[[1, 2, 3, 4]], 0],
      [[[5, 4, 3, 2, 1, 0, 7, 8, 9]], 6], [[[2, 0]], 1], [[[0, 2, 3, 1, 5]], 4],
    ]),
    reference: String.raw`function missingNumber(nums) { const n = nums.length; let sum = 0; for (const x of nums) sum += x; return (n * (n + 1)) / 2 - sum; }`,
  }),

  mk('easy', {
    title: 'Rotate Array Right',
    statement:
      'Rotate the array to the right by `k` steps and return the result as a new array. `k` can be larger than the length of the array.\n\nInput: an integer array `arr` and a non-negative integer `k`.\nOutput: the rotated array.',
    time_mins: 3,
    tags: ['array', 'simulation'],
    config: {
      fn: { js: 'rotateRight', py: 'rotate_right', params: ['arr', 'k'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= arr.length <= 10,000', '0 <= k <= 10^9'],
      examples: [
        { input: 'arr = [1, 2, 3, 4, 5, 6, 7], k = 3', output: '[5, 6, 7, 1, 2, 3, 4]' },
        { input: 'arr = [1, 2, 3], k = 4', output: '[3, 1, 2]', explanation: '4 steps behave like 1 step.' },
      ],
      bench: { sizes: LARGE, gen: '(n) => [Array.from({length: n}, (_, i) => i), Math.floor(n / 3) + 1]' },
    },
    tests: tests10('Rotate Array Right', [
      [[[1, 2, 3, 4, 5, 6, 7], 3], [5, 6, 7, 1, 2, 3, 4]], [[[-1, -100, 3, 99], 2], [3, 99, -1, -100]], [[[], 5], []],
      [[[1], 10], [1]], [[[1, 2], 0], [1, 2]], [[[1, 2, 3], 3], [1, 2, 3]], [[[1, 2, 3], 4], [3, 1, 2]],
      [[[1, 2, 3, 4, 5], 7], [4, 5, 1, 2, 3]], [[[9, 8], 1], [8, 9]], [[[1, 2, 3, 4], 1000000], [1, 2, 3, 4]],
    ]),
    reference: String.raw`function rotateRight(arr, k) { const n = arr.length; if (n === 0) return []; const s = k % n; return arr.slice(n - s).concat(arr.slice(0, n - s)); }`,
  }),

  mk('easy', {
    title: 'Count Set Bits',
    statement:
      'Return the number of 1 bits in the binary representation of a non-negative integer.\n\nInput: an integer `n`.\nOutput: the number of 1 bits.',
    time_mins: 2,
    tags: ['bit-manipulation', 'math'],
    config: {
      fn: { js: 'countSetBits', py: 'count_set_bits', params: ['n'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= n <= 2^31 - 1'],
      examples: [
        { input: 'n = 5', output: '2', explanation: '5 is 101 in binary.' },
        { input: 'n = 7', output: '3' },
      ],
      bench: { sizes: [1000, 100000, 10000000, 1000000000, 2147483647], gen: '(n) => [n]' },
    },
    tests: tests10('Count Set Bits', [
      [[0], 0], [[5], 2], [[7], 3],
      [[8], 1], [[255], 8], [[1023], 10], [[1024], 1], [[2147483647], 31], [[12345], 6], [[1073741824], 1],
    ]),
    reference: String.raw`function countSetBits(n) { let c = 0; while (n > 0) { c += n % 2; n = Math.floor(n / 2); } return c; }`,
  }),

  mk('easy', {
    title: 'Duplicate Claim IDs',
    statement:
      'Return the claim IDs that appear more than once in the list. Each duplicated ID must be listed once, and the result must be sorted in ascending alphabetical (lexicographic) order. Comparison is case-sensitive.\n\nInput: a string array `ids`.\nOutput: a sorted string array of the duplicated IDs (empty if there are none).',
    time_mins: 3,
    tags: ['hashing', 'sorting', 'healthcare'],
    config: {
      fn: { js: 'duplicateClaimIds', py: 'duplicate_claim_ids', params: ['ids'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= ids.length <= 10,000', 'each id is a non-empty string of at most 20 ASCII characters'],
      examples: [
        { input: 'ids = ["C1", "C2", "C1", "C3", "C2", "C1"]', output: '["C1", "C2"]' },
        { input: 'ids = ["10", "9", "10", "9"]', output: '["10", "9"]', explanation: 'Alphabetical order: "10" comes before "9".' },
      ],
      bench: { sizes: LARGE, gen: "(n, rnd) => [Array.from({length: n}, () => 'C' + Math.floor(rnd() * n / 2))]" },
    },
    tests: tests10('Duplicate Claim IDs', [
      [[['C1', 'C2', 'C1', 'C3', 'C2', 'C1']], ['C1', 'C2']], [[[]], []], [[['A']], []],
      [[['B', 'A', 'B', 'A']], ['A', 'B']],
      [[['X1', 'X2', 'X3']], []],
      [[['Z', 'Z', 'Z', 'Z']], ['Z']],
      [[['c1', 'C1', 'c1']], ['c1']],
      [[['10', '9', '10', '9', '9']], ['10', '9']],
      [[['a1', 'b2', 'a1', 'c3', 'd4', 'b2', 'e5', 'a1']], ['a1', 'b2']],
      [[['m', 'n', 'm', 'k', 'n', 'k']], ['k', 'm', 'n']],
    ]),
    reference: String.raw`function duplicateClaimIds(ids) { const c = new Map(); for (const id of ids) c.set(id, (c.get(id) || 0) + 1); return [...c.entries()].filter(([, v]) => v > 1).map(([k]) => k).sort(); }`,
  }),

  // ───────────────────────────── MEDIUM (8) ─────────────────────────────
  mk('medium', {
    title: 'Top K Frequent Words',
    statement:
      'Return the `k` most frequent words of the text. Words are separated by single spaces. Sort the result by frequency (highest first); words with the same frequency are ordered alphabetically (lexicographically). If the text has fewer than `k` distinct words, return all of them.\n\nInput: a string `text` of lower-case words and an integer `k`.\nOutput: a string array of at most `k` words.',
    time_mins: 4,
    tags: ['hashing', 'sorting'],
    config: {
      fn: { js: 'topKWords', py: 'top_k_words', params: ['text', 'k'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 10,000', '0 <= k <= 1,000', 'text has lower-case words separated by single spaces (it may be empty)'],
      examples: [
        { input: 'text = "the day is sunny the the the sunny is is", k = 4', output: '["the", "is", "sunny", "day"]' },
        { input: 'text = "a b c", k = 2', output: '["a", "b"]', explanation: 'All counts tie, so alphabetical order decides.' },
      ],
      bench: { sizes: SMALL, gen: "(n, rnd) => [Array.from({length: n}, () => 'w' + Math.floor(rnd() * (n / 4 + 1))).join(' '), 10]" },
    },
    tests: tests10('Top K Frequent Words', [
      [['the day is sunny the the the sunny is is', 4], ['the', 'is', 'sunny', 'day']], [['a b c', 2], ['a', 'b']], [['', 3], []],
      [['i love code i love hpai', 2], ['i', 'love']],
      [['x y z', 5], ['x', 'y', 'z']],
      [['b b a a c', 1], ['a']],
      [['one', 1], ['one']],
      [['z z y y x x w', 3], ['x', 'y', 'z']],
      [['aa a aa a b', 2], ['a', 'aa']],
      [['cat dog cat bird dog cat', 0], []],
    ]),
    reference: String.raw`function topKWords(text, k) { const c = new Map(); for (const w of text.split(' ').filter(Boolean)) c.set(w, (c.get(w) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, k).map(e => e[0]); }`,
  }),

  mk('medium', {
    title: 'Coverage Overlap Days',
    statement:
      'Two coverage periods are given as inclusive date ranges in `YYYY-MM-DD` format. Return the number of calendar days that belong to both periods (0 if they do not overlap). Remember leap years.\n\nInput: strings `aStart`, `aEnd`, `bStart`, `bEnd` (each start is on or before its end).\nOutput: the number of shared days.',
    time_mins: 4,
    tags: ['date-time', 'parsing', 'healthcare'],
    config: {
      fn: { js: 'overlapDays', py: 'overlap_days', params: ['aStart', 'aEnd', 'bStart', 'bEnd'] },
      languages: ['python', 'javascript'],
      constraints: ['all dates are valid dates between 1990-01-01 and 2100-12-31', 'a start date is never after its end date'],
      examples: [
        { input: '"2024-01-01", "2024-01-31", "2024-01-15", "2024-02-15"', output: '17', explanation: 'Jan 15 to Jan 31 is 17 days.' },
        { input: '"2024-03-01", "2024-03-10", "2024-03-11", "2024-03-20"', output: '0' },
      ],
      bench: {
        sizes: [30, 100, 365, 1000, 3650, 10000],
        gen: "(n) => { const d = (k) => new Date(Date.UTC(2000, 0, 1 + k)).toISOString().slice(0, 10); return [d(0), d(n), d(Math.floor(n / 2)), d(2 * n)]; }",
      },
    },
    tests: tests10('Coverage Overlap Days', [
      [['2024-01-01', '2024-01-31', '2024-01-15', '2024-02-15'], 17],
      [['2024-03-01', '2024-03-10', '2024-03-11', '2024-03-20'], 0],
      [['2024-05-05', '2024-05-05', '2024-05-05', '2024-05-05'], 1],
      [['2023-12-25', '2024-01-05', '2023-12-31', '2024-02-01'], 6],
      [['2020-01-01', '2020-12-31', '2020-02-01', '2020-02-29'], 29],
      [['2019-01-01', '2019-12-31', '2019-02-01', '2019-02-28'], 28],
      [['2024-06-01', '2024-06-30', '2024-01-01', '2024-06-01'], 1],
      [['2023-01-01', '2025-12-31', '2024-01-01', '2024-12-31'], 366],
      [['2021-03-10', '2021-03-20', '2021-02-01', '2021-02-20'], 0],
      [['2022-01-01', '2022-01-10', '2022-02-01', '2022-02-10'], 0],
    ]),
    reference: String.raw`function overlapDays(aStart, aEnd, bStart, bEnd) {
  const day = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const lo = Math.max(day(aStart), day(bStart)), hi = Math.min(day(aEnd), day(bEnd));
  return Math.max(0, hi - lo + 1);
}`,
  }),

  mk('medium', {
    title: 'Spiral Order of a Matrix',
    statement:
      'Return all elements of the matrix in clockwise spiral order, starting at the top-left cell. The matrix is rectangular and may be empty.\n\nInput: a matrix `matrix` (an array of equal-length integer rows).\nOutput: the elements as a flat integer array.',
    time_mins: 4,
    tags: ['matrix', 'simulation'],
    config: {
      fn: { js: 'spiralOrder', py: 'spiral_order', params: ['matrix'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= rows, columns <= 100', '-1000 <= matrix[i][j] <= 1000'],
      examples: [
        { input: 'matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]', output: '[1, 2, 3, 6, 9, 8, 7, 4, 5]' },
        { input: 'matrix = [[1, 2], [3, 4], [5, 6]]', output: '[1, 2, 4, 6, 5, 3]' },
      ],
      bench: { sizes: [25, 100, 400, 1600, 6400, 25600], gen: '(n) => { const s = Math.max(1, Math.floor(Math.sqrt(n))); return [Array.from({length: s}, (_, i) => Array.from({length: s}, (_, j) => i * s + j))]; }' },
    },
    tests: tests10('Spiral Order of a Matrix', [
      [[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [1, 2, 3, 6, 9, 8, 7, 4, 5]],
      [[[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]], [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]],
      [[[]], []],
      [[[[7]]], [7]],
      [[[[1, 2, 3]]], [1, 2, 3]],
      [[[[1], [2], [3]]], [1, 2, 3]],
      [[[[1, 2], [3, 4]]], [1, 2, 4, 3]],
      [[[[1, 2], [3, 4], [5, 6]]], [1, 2, 4, 6, 5, 3]],
      [[[[1, 2, 3], [4, 5, 6]]], [1, 2, 3, 6, 5, 4]],
      [[[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]], [1, 2, 3, 4, 8, 12, 16, 15, 14, 13, 9, 5, 6, 7, 11, 10]],
    ]),
    reference: String.raw`function spiralOrder(matrix) {
  const out = []; if (!matrix.length || !matrix[0].length) return out;
  let top = 0, bottom = matrix.length - 1, left = 0, right = matrix[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let j = left; j <= right; j++) out.push(matrix[top][j]);
    top++;
    for (let i = top; i <= bottom; i++) out.push(matrix[i][right]);
    right--;
    if (top <= bottom) { for (let j = right; j >= left; j--) out.push(matrix[bottom][j]); bottom--; }
    if (left <= right) { for (let i = bottom; i >= top; i--) out.push(matrix[i][left]); left++; }
  }
  return out;
}`,
  }),

  mk('medium', {
    title: 'Subarray Sum Equals K',
    statement:
      'Count the contiguous, non-empty subarrays whose elements add up to exactly `k`. The array may contain negative numbers and zeros.\n\nInput: an integer array `nums` and an integer `k`.\nOutput: the number of such subarrays.',
    time_mins: 4,
    tags: ['array', 'hashing', 'prefix-sum'],
    config: {
      fn: { js: 'countSubarraysWithSum', py: 'count_subarrays_with_sum', params: ['nums', 'k'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 2,000', '-1000 <= nums[i] <= 1000', '-10^6 <= k <= 10^6'],
      examples: [
        { input: 'nums = [1, 1, 1], k = 2', output: '2' },
        { input: 'nums = [1, 2, 3], k = 3', output: '2', explanation: '[1, 2] and [3].' },
      ],
      bench: { sizes: SMALL, gen: '(n, rnd) => [Array.from({length: n}, () => Math.floor(rnd() * 5) - 2), 3]' },
    },
    tests: tests10('Subarray Sum Equals K', [
      [[[1, 1, 1], 2], 2], [[[1, 2, 3], 3], 2], [[[], 0], 0],
      [[[0, 0, 0], 0], 6],
      [[[1, -1, 0], 0], 3],
      [[[3, 4, 7, 2, -3, 1, 4, 2], 7], 4],
      [[[-1, -1, 1], 0], 1],
      [[[5], 5], 1],
      [[[5], 3], 0],
      [[[1, 2, 1, 2, 1], 3], 4],
    ]),
    reference: String.raw`function countSubarraysWithSum(nums, k) { const seen = new Map([[0, 1]]); let sum = 0, count = 0; for (const x of nums) { sum += x; count += seen.get(sum - k) || 0; seen.set(sum, (seen.get(sum) || 0) + 1); } return count; }`,
  }),

  mk('medium', {
    title: 'Decode Run-Length String',
    statement:
      'A string is run-length encoded as a sequence of pairs: a positive count (one or more digits) followed by a letter. Expand it, e.g. "3a2b" becomes "aaabb". Counts can have several digits ("12x" is twelve x characters). An empty string decodes to an empty string.\n\nInput: an encoded string `encoded`.\nOutput: the decoded string.',
    time_mins: 3,
    tags: ['string', 'parsing'],
    config: {
      fn: { js: 'decodeRle', py: 'decode_rle', params: ['encoded'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= encoded.length <= 200', 'counts are between 1 and 999', 'letters are a-z or A-Z'],
      examples: [
        { input: 'encoded = "3a2b1c"', output: '"aaabbc"' },
        { input: 'encoded = "10z"', output: '"zzzzzzzzzz"' },
      ],
      bench: { sizes: LARGE, gen: "(n) => ['3a'.repeat(Math.ceil(n / 3))]" },
    },
    tests: tests10('Decode Run-Length String', [
      [['3a2b1c'], 'aaabbc'], [['1x'], 'x'], [[''], ''],
      [['10z'], 'zzzzzzzzzz'],
      [['2a3A'], 'aaAAA'],
      [['1a1b1a'], 'aba'],
      [['12q'], 'qqqqqqqqqqqq'],
      [['5a'], 'aaaaa'],
      [['2x2y2z'], 'xxyyzz'],
      [['3a10b'], 'aaabbbbbbbbbb'],
    ]),
    reference: String.raw`function decodeRle(encoded) { let out = '', num = ''; for (const ch of encoded) { if (ch >= '0' && ch <= '9') num += ch; else { out += ch.repeat(Number(num)); num = ''; } } return out; }`,
  }),

  mk('medium', {
    title: 'Next Greater Element',
    statement:
      'For every element, find the first element to its right that is strictly greater. Return an array where position `i` holds that value, or -1 when no greater element exists to the right.\n\nInput: an integer array `nums`.\nOutput: an integer array of the same length.',
    time_mins: 3,
    tags: ['stack', 'array'],
    config: {
      fn: { js: 'nextGreater', py: 'next_greater', params: ['nums'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 10,000', '-10^9 <= nums[i] <= 10^9'],
      examples: [
        { input: 'nums = [4, 5, 2, 25]', output: '[5, 25, 25, -1]' },
        { input: 'nums = [2, 2, 2]', output: '[-1, -1, -1]', explanation: 'Equal values are not greater.' },
      ],
      bench: { sizes: LARGE, gen: '(n, rnd) => [Array.from({length: n}, () => Math.floor(rnd() * 1000))]' },
    },
    tests: tests10('Next Greater Element', [
      [[[4, 5, 2, 25]], [5, 25, 25, -1]], [[[3, 2, 1]], [-1, -1, -1]], [[[]], []],
      [[[1, 2, 3, 4]], [2, 3, 4, -1]],
      [[[2, 2, 2]], [-1, -1, -1]],
      [[[5, 4, 3, 4, 5]], [-1, 5, 4, 5, -1]],
      [[[1, 3, 2, 4]], [3, 4, 4, -1]],
      [[[9]], [-1]],
      [[[-1, -2, -3, 0]], [0, 0, 0, -1]],
      [[[1, 5, 3, 6, 4, 8, 2]], [5, 6, 6, 8, 8, -1, -1]],
    ]),
    reference: String.raw`function nextGreater(nums) { const res = new Array(nums.length).fill(-1), st = []; for (let i = 0; i < nums.length; i++) { while (st.length && nums[st[st.length - 1]] < nums[i]) res[st.pop()] = nums[i]; st.push(i); } return res; }`,
  }),

  mk('medium', {
    title: 'Count Islands in a Grid',
    statement:
      'The grid contains 1 (land) and 0 (water). An island is a group of land cells connected horizontally or vertically (not diagonally). Return the number of islands.\n\nInput: a grid `grid` of 0/1 integers (rows of equal length, may be empty).\nOutput: the number of islands.',
    time_mins: 4,
    tags: ['matrix', 'dfs', 'bfs'],
    config: {
      fn: { js: 'countIslands', py: 'count_islands', params: ['grid'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= rows, columns <= 50', 'grid[i][j] is 0 or 1'],
      examples: [
        { input: 'grid = [[1, 1, 0], [0, 1, 0], [1, 0, 1]]', output: '3' },
        { input: 'grid = [[1, 0], [0, 1]]', output: '2', explanation: 'Diagonal cells are not connected.' },
      ],
      bench: { sizes: [25, 100, 400, 1600, 6400], gen: '(n, rnd) => { const s = Math.max(1, Math.floor(Math.sqrt(n))); return [Array.from({length: s}, () => Array.from({length: s}, () => (rnd() < 0.4 ? 1 : 0)))]; }' },
    },
    tests: tests10('Count Islands in a Grid', [
      [[[[1, 1, 0], [0, 1, 0], [1, 0, 1]]], 3], [[[[0, 0], [0, 0]]], 0], [[[[1, 0], [0, 1]]], 2],
      [[[]], 0],
      [[[[1]]], 1],
      [[[[1, 0, 1, 0, 1]]], 3],
      [[[[1, 1, 1], [1, 1, 1]]], 1],
      [[[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]], 3],
      [[[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], 5],
      [[[[1], [0], [1], [1]]], 2],
    ]),
    reference: String.raw`function countIslands(grid) {
  const R = grid.length; if (!R) return 0; const C = grid[0].length; let count = 0;
  const seen = grid.map(r => r.map(() => false));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (grid[r][c] !== 1 || seen[r][c]) continue;
    count++; const st = [[r, c]]; seen[r][c] = true;
    while (st.length) { const [y, x] = st.pop(); for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ny = y + dy, nx = x + dx; if (ny >= 0 && ny < R && nx >= 0 && nx < C && grid[ny][nx] === 1 && !seen[ny][nx]) { seen[ny][nx] = true; st.push([ny, nx]); } } }
  }
  return count;
}`,
  }),

  mk('medium', {
    title: 'Maximum Non-Adjacent Sum',
    statement:
      'Choose some elements of the array so that no two chosen elements are next to each other, and make their sum as large as possible. Return that maximum sum (0 for an empty array). All values are non-negative.\n\nInput: an integer array `nums`.\nOutput: the maximum possible sum.',
    time_mins: 3,
    tags: ['dp', 'array'],
    config: {
      fn: { js: 'maxNonAdjacentSum', py: 'max_non_adjacent_sum', params: ['nums'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 1,000', '0 <= nums[i] <= 10,000'],
      examples: [
        { input: 'nums = [2, 7, 9, 3, 1]', output: '12', explanation: '2 + 9 + 1.' },
        { input: 'nums = [1, 2, 3, 1]', output: '4', explanation: '1 + 3.' },
      ],
      bench: { sizes: [25, 50, 100, 200, 400, 800], gen: '(n, rnd) => [Array.from({length: n}, () => Math.floor(rnd() * 100))]' },
    },
    tests: tests10('Maximum Non-Adjacent Sum', [
      [[[2, 7, 9, 3, 1]], 12], [[[1, 2, 3, 1]], 4], [[[]], 0],
      [[[5]], 5],
      [[[5, 6, 5]], 10],
      [[[1, 2]], 2],
      [[[0, 0, 0]], 0],
      [[[100, 1, 1, 100]], 200],
      [[[4, 1, 1, 4, 2, 1]], 9],
      [[[3, 2, 5, 10, 7]], 15],
    ]),
    reference: String.raw`function maxNonAdjacentSum(nums) { let take = 0, skip = 0; for (const x of nums) { const nt = skip + x; skip = Math.max(skip, take); take = nt; } return Math.max(take, skip); }`,
  }),

  // ───────────────────────────── HARD (4, still short) ─────────────────────────────
  mk('hard', {
    title: 'Longest Palindromic Substring Length',
    statement:
      'Return the length of the longest substring of the text that reads the same forwards and backwards. A single character is a palindrome. For an empty text return 0. The comparison is case-sensitive.\n\nInput: a string `text`.\nOutput: the length of the longest palindromic substring.',
    time_mins: 4,
    tags: ['string', 'dp', 'two-pointers'],
    config: {
      fn: { js: 'longestPalindromeLength', py: 'longest_palindrome_length', params: ['text'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 1,000'],
      examples: [
        { input: 'text = "babad"', output: '3', explanation: '"bab" (or "aba").' },
        { input: 'text = "cbbd"', output: '2', explanation: '"bb".' },
      ],
      bench: { sizes: [25, 50, 100, 200, 400, 800, 1600], gen: "(n, rnd) => [Array.from({length: n}, () => 'ab'[Math.floor(rnd() * 2)]).join('')]" },
    },
    tests: tests10('Longest Palindromic Substring Length', [
      [['babad'], 3], [['cbbd'], 2], [[''], 0],
      [['a'], 1],
      [['abc'], 1],
      [['racecar'], 7],
      [['abacdfgdcaba'], 3],
      [['aaaa'], 4],
      [['xabcbay'], 5],
      [['zzabbaq'], 4],
    ]),
    reference: String.raw`function longestPalindromeLength(text) {
  let best = 0;
  for (let c = 0; c < text.length; c++) for (const [l0, r0] of [[c, c], [c, c + 1]]) { let l = l0, r = r0; while (l >= 0 && r < text.length && text[l] === text[r]) { l--; r++; } best = Math.max(best, r - l - 1); }
  return best;
}`,
  }),

  mk('hard', {
    title: 'Shortest Window Covering Letters',
    statement:
      'Find the length of the shortest contiguous part of `text` that contains every letter of `letters`, counting repeats (if `letters` has two "a" characters, the part must contain at least two "a" characters). Return 0 if no such part exists. The comparison is case-sensitive.\n\nInput: strings `text` and `letters` (`letters` is not empty).\nOutput: the length of the shortest window, or 0.',
    time_mins: 4,
    tags: ['string', 'sliding-window', 'hashing'],
    config: {
      fn: { js: 'shortestWindow', py: 'shortest_window', params: ['text', 'letters'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 1,000', '1 <= letters.length <= 50'],
      examples: [
        { input: 'text = "ADOBECODEBANC", letters = "ABC"', output: '4', explanation: '"BANC".' },
        { input: 'text = "a", letters = "aa"', output: '0', explanation: 'Only one "a" is available.' },
      ],
      bench: { sizes: [25, 50, 100, 200, 400, 800, 1600], gen: "(n, rnd) => [Array.from({length: n}, () => String.fromCharCode(97 + Math.floor(rnd() * 4))).join(''), 'abcd']" },
    },
    tests: tests10('Shortest Window Covering Letters', [
      [['ADOBECODEBANC', 'ABC'], 4], [['a', 'a'], 1], [['abc', 'd'], 0],
      [['a', 'aa'], 0],
      [['aa', 'aa'], 2],
      [['abcabc', 'cba'], 3],
      [['xyzxyzw', 'zw'], 2],
      [['abbbbbcdd', 'abcdd'], 9],
      [['bba', 'ab'], 2],
      [['cabwefgewcwaefgcf', 'cae'], 4],
    ]),
    reference: String.raw`function shortestWindow(text, letters) {
  const need = new Map(); for (const ch of letters) need.set(ch, (need.get(ch) || 0) + 1);
  let missing = letters.length, best = 0, left = 0; const have = new Map();
  for (let right = 0; right < text.length; right++) {
    const ch = text[right]; have.set(ch, (have.get(ch) || 0) + 1);
    if (need.has(ch) && have.get(ch) <= need.get(ch)) missing--;
    while (missing === 0) {
      const len = right - left + 1; if (best === 0 || len < best) best = len;
      const lc = text[left]; have.set(lc, have.get(lc) - 1);
      if (need.has(lc) && have.get(lc) < need.get(lc)) missing++;
      left++;
    }
  }
  return best;
}`,
  }),

  mk('hard', {
    title: 'Count Inversions',
    statement:
      'An inversion is a pair of positions `i < j` with `nums[i] > nums[j]` (strictly greater). Return the total number of inversions in the array.\n\nInput: an integer array `nums`.\nOutput: the number of inversions.',
    time_mins: 4,
    tags: ['array', 'sorting', 'divide-and-conquer'],
    config: {
      fn: { js: 'countInversions', py: 'count_inversions', params: ['nums'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 2,000', '-10^6 <= nums[i] <= 10^6'],
      examples: [
        { input: 'nums = [2, 4, 1, 3, 5]', output: '3', explanation: '(2,1), (4,1), (4,3).' },
        { input: 'nums = [5, 4, 3, 2, 1]', output: '10' },
      ],
      bench: { sizes: SMALL, gen: '(n, rnd) => [Array.from({length: n}, () => Math.floor(rnd() * 100000))]' },
    },
    tests: tests10('Count Inversions', [
      [[[2, 4, 1, 3, 5]], 3], [[[1, 2, 3]], 0], [[[]], 0],
      [[[5, 4, 3, 2, 1]], 10],
      [[[1, 1, 1]], 0],
      [[[3, 1, 2]], 2],
      [[[2, 2, 1]], 2],
      [[[-1, -3, -2]], 2],
      [[[8, 4, 2, 1]], 6],
      [[[7, 3, 9, 1, 8, 2, 6, 5, 4, 0, 11, 10]], 31],
    ]),
    reference: String.raw`function countInversions(nums) {
  const a = nums.slice(), tmp = new Array(a.length);
  const sort = (lo, hi) => { if (hi - lo < 2) return 0; const mid = (lo + hi) >> 1; let inv = sort(lo, mid) + sort(mid, hi); let i = lo, j = mid, k = lo;
    while (i < mid && j < hi) { if (a[i] <= a[j]) tmp[k++] = a[i++]; else { tmp[k++] = a[j++]; inv += mid - i; } }
    while (i < mid) tmp[k++] = a[i++]; while (j < hi) tmp[k++] = a[j++];
    for (let t = lo; t < hi; t++) a[t] = tmp[t]; return inv; };
  return sort(0, a.length);
}`,
  }),

  mk('hard', {
    title: 'Count Subsets With Target Sum',
    statement:
      'Count the subsets of `nums` whose elements add up to exactly `target`. Subsets are chosen by position, so equal values at different positions count as different subsets. The empty subset (sum 0) counts only when `target` is 0.\n\nInput: an integer array `nums` of positive integers and an integer `target`.\nOutput: the number of subsets.',
    time_mins: 4,
    tags: ['dp', 'backtracking', 'recursion'],
    config: {
      fn: { js: 'countSubsets', py: 'count_subsets', params: ['nums', 'target'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 20', '1 <= nums[i] <= 100', '0 <= target <= 1,000'],
      examples: [
        { input: 'nums = [1, 2, 3, 4, 5], target = 5', output: '3', explanation: '{5}, {1, 4} and {2, 3}.' },
        { input: 'nums = [1, 1, 1], target = 2', output: '3', explanation: 'Three different pairs of positions.' },
      ],
      bench: { sizes: [10, 40, 160, 640, 1000], gen: '(n) => [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], n]' },
    },
    tests: tests10('Count Subsets With Target Sum', [
      [[[1, 2, 3, 4, 5], 5], 3], [[[1, 1, 1], 2], 3], [[[2, 4], 3], 0],
      [[[], 0], 1],
      [[[], 5], 0],
      [[[1, 2, 3], 0], 1],
      [[[5], 5], 1],
      [[[1, 1, 1, 1], 2], 6],
      [[[3, 34, 4, 12, 5, 2], 9], 2],
      [[[2, 2, 2, 2, 2], 4], 10],
    ]),
    reference: String.raw`function countSubsets(nums, target) { const dp = new Array(target + 1).fill(0); dp[0] = 1; for (const x of nums) for (let s = target; s >= x; s--) dp[s] += dp[s - x]; return dp[target]; }`,
  }),
];

// ───────────────────────── Dev-only solutions (NEVER imported by questions.js) ─────────────────────────
// alt: other valid JS approaches (>= 2 per question) · py: Python solutions (same parameter order) ·
// wrong: plausible-but-wrong JS solutions that at least two HIDDEN tests must catch (so partial marking is meaningful).
export const SOLUTIONS = {
  'Integer Square Root': {
    alt: [
      String.raw`function integerSqrt(n) { let r = Math.floor(Math.sqrt(n)); while (r * r > n) r--; while ((r + 1) * (r + 1) <= n) r++; return r; }`,
      String.raw`function integerSqrt(n) { if (n < 2) return n; let x = n; while (true) { const y = Math.floor((x + Math.floor(n / x)) / 2); if (y >= x) return x; x = y; } }`,
      String.raw`function integerSqrt(n) { let r = 0; while ((r + 1) * (r + 1) <= n) r++; return r; }`,
    ],
    py: [
      'import math\ndef integer_sqrt(n):\n    return math.isqrt(n)\n',
      'def integer_sqrt(n):\n    lo, hi = 0, min(n, 2000000)\n    while lo < hi:\n        mid = (lo + hi + 1) // 2\n        if mid * mid <= n:\n            lo = mid\n        else:\n            hi = mid - 1\n    return lo\n',
    ],
    wrong: [
      String.raw`function integerSqrt(n) { return Math.round(Math.sqrt(n)); }`,
      String.raw`function integerSqrt(n) { return Math.ceil(Math.sqrt(n)); }`,
    ],
  },

  'First Unique Character': {
    alt: [
      String.raw`function firstUniqueChar(text) { for (let i = 0; i < text.length; i++) if (text.indexOf(text[i]) === text.lastIndexOf(text[i])) return text[i]; return ''; }`,
      String.raw`function firstUniqueChar(text) { const cnt = new Array(128).fill(0); for (let i = 0; i < text.length; i++) cnt[text.charCodeAt(i)]++; for (let i = 0; i < text.length; i++) if (cnt[text.charCodeAt(i)] === 1) return text[i]; return ''; }`,
    ],
    py: [
      'from collections import Counter\ndef first_unique_char(text):\n    c = Counter(text)\n    for ch in text:\n        if c[ch] == 1:\n            return ch\n    return ""\n',
      'def first_unique_char(text):\n    for ch in text:\n        if text.count(ch) == 1:\n            return ch\n    return ""\n',
    ],
    wrong: [
      String.raw`function firstUniqueChar(text) { for (let i = text.length - 1; i >= 0; i--) if (text.indexOf(text[i]) === text.lastIndexOf(text[i])) return text[i]; return ''; }`,
      String.raw`function firstUniqueChar(text) { const t = text.toLowerCase(), c = {}; for (const ch of t) c[ch] = (c[ch] || 0) + 1; for (let i = 0; i < text.length; i++) if (c[t[i]] === 1) return text[i]; return ''; }`,
    ],
  },

  'Claim Line Total': {
    alt: [
      String.raw`function approvedTotal(amounts, statuses) { return amounts.reduce((t, a, i) => (statuses[i] === 'approved' ? t + a : t), 0); }`,
      String.raw`function approvedTotal(amounts, statuses) { return amounts.filter((_, i) => statuses[i] === 'approved').reduce((a, b) => a + b, 0); }`,
    ],
    py: [
      'def approved_total(amounts, statuses):\n    return sum(a for a, s in zip(amounts, statuses) if s == "approved")\n',
      'def approved_total(amounts, statuses):\n    total = 0\n    for i in range(len(amounts)):\n        if statuses[i] == "approved":\n            total += amounts[i]\n    return total\n',
    ],
    wrong: [
      String.raw`function approvedTotal(amounts, statuses) { return amounts.reduce((a, b) => a + b, 0); }`,
      String.raw`function approvedTotal(amounts, statuses) { let t = 0; for (let i = 0; i < amounts.length; i++) if (statuses[i].toLowerCase() === 'approved') t += amounts[i]; return t; }`,
    ],
  },

  'Valid Member ID': {
    alt: [
      String.raw`function isValidMemberId(code) { if (code.length !== 8) return false; for (let i = 0; i < 8; i++) { const c = code.charCodeAt(i); const ok = i < 2 ? c >= 65 && c <= 90 : c >= 48 && c <= 57; if (!ok) return false; } return true; }`,
      String.raw`function isValidMemberId(code) { return code.length === 8 && [...code.slice(0, 2)].every(c => c >= 'A' && c <= 'Z') && [...code.slice(2)].every(c => c >= '0' && c <= '9'); }`,
    ],
    py: [
      'import re\ndef is_valid_member_id(code):\n    return re.fullmatch(r"[A-Z]{2}[0-9]{6}", code) is not None\n',
      'def is_valid_member_id(code):\n    if len(code) != 8:\n        return False\n    for i, ch in enumerate(code):\n        if i < 2:\n            if not ("A" <= ch <= "Z"):\n                return False\n        elif not ("0" <= ch <= "9"):\n            return False\n    return True\n',
    ],
    wrong: [
      String.raw`function isValidMemberId(code) { return /^[A-Za-z]{2}[0-9]{6}$/.test(code); }`,
      String.raw`function isValidMemberId(code) { return code.length === 8; }`,
    ],
  },

  'Find the Missing Number': {
    alt: [
      String.raw`function missingNumber(nums) { let x = nums.length; for (let i = 0; i < nums.length; i++) x ^= i ^ nums[i]; return x; }`,
      String.raw`function missingNumber(nums) { const s = new Set(nums); for (let i = 0; i <= nums.length; i++) if (!s.has(i)) return i; return -1; }`,
      String.raw`function missingNumber(nums) { const a = [...nums].sort((x, y) => x - y); for (let i = 0; i < a.length; i++) if (a[i] !== i) return i; return a.length; }`,
    ],
    py: [
      'def missing_number(nums):\n    n = len(nums)\n    return n * (n + 1) // 2 - sum(nums)\n',
      'def missing_number(nums):\n    x = len(nums)\n    for i, v in enumerate(nums):\n        x ^= i ^ v\n    return x\n',
    ],
    wrong: [
      String.raw`function missingNumber(nums) { return nums.length; }`,
      String.raw`function missingNumber(nums) { const a = [...nums].sort((x, y) => x - y); for (let i = 0; i < a.length; i++) if (a[i] !== i) return i + 1; return a.length; }`,
    ],
  },

  'Rotate Array Right': {
    alt: [
      String.raw`function rotateRight(arr, k) { const n = arr.length, out = new Array(n); for (let i = 0; i < n; i++) out[(i + k) % n] = arr[i]; return out; }`,
      String.raw`function rotateRight(arr, k) { const a = arr.slice(), n = a.length; if (!n) return a; k %= n; const rev = (l, r) => { while (l < r) { [a[l], a[r]] = [a[r], a[l]]; l++; r--; } }; rev(0, n - 1); rev(0, k - 1); rev(k, n - 1); return a; }`,
      String.raw`function rotateRight(arr, k) { const a = arr.slice(); if (!a.length) return a; for (let s = 0; s < k % a.length; s++) a.unshift(a.pop()); return a; }`,
    ],
    py: [
      'def rotate_right(arr, k):\n    if not arr:\n        return []\n    k %= len(arr)\n    return arr[len(arr) - k:] + arr[:len(arr) - k]\n',
      'def rotate_right(arr, k):\n    n = len(arr)\n    out = [0] * n\n    for i, v in enumerate(arr):\n        out[(i + k) % n] = v\n    return out\n',
    ],
    wrong: [
      String.raw`function rotateRight(arr, k) { const n = arr.length; if (!n) return []; const s = k % n; return arr.slice(s).concat(arr.slice(0, s)); }`,
      String.raw`function rotateRight(arr, k) { if (!arr.length) return []; return arr.slice(-k).concat(arr.slice(0, arr.length - k)); }`,
    ],
  },

  'Count Set Bits': {
    alt: [
      String.raw`function countSetBits(n) { let c = 0; while (n) { n &= n - 1; c++; } return c; }`,
      String.raw`function countSetBits(n) { return n.toString(2).split('').filter(b => b === '1').length; }`,
      String.raw`function countSetBits(n) { let c = 0; for (let i = 0; i < 31; i++) if ((n >> i) & 1) c++; return c; }`,
    ],
    py: [
      'def count_set_bits(n):\n    return bin(n).count("1")\n',
      'def count_set_bits(n):\n    c = 0\n    while n:\n        n &= n - 1\n        c += 1\n    return c\n',
    ],
    wrong: [
      String.raw`function countSetBits(n) { return n.toString(2).length; }`,
      String.raw`function countSetBits(n) { return String(n).split('').filter(d => d === '1').length; }`,
    ],
  },

  'Duplicate Claim IDs': {
    alt: [
      String.raw`function duplicateClaimIds(ids) { const s = [...ids].sort(), out = []; for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1] && out[out.length - 1] !== s[i]) out.push(s[i]); return out; }`,
      String.raw`function duplicateClaimIds(ids) { const seen = new Set(), dup = new Set(); for (const id of ids) { if (seen.has(id)) dup.add(id); else seen.add(id); } return [...dup].sort(); }`,
    ],
    py: [
      'from collections import Counter\ndef duplicate_claim_ids(ids):\n    return sorted(k for k, v in Counter(ids).items() if v > 1)\n',
      'def duplicate_claim_ids(ids):\n    seen, dup = set(), set()\n    for i in ids:\n        if i in seen:\n            dup.add(i)\n        seen.add(i)\n    return sorted(dup)\n',
    ],
    wrong: [
      String.raw`function duplicateClaimIds(ids) { const c = new Map(); for (const id of ids) c.set(id, (c.get(id) || 0) + 1); return [...c.entries()].filter(([, v]) => v > 1).map(([k]) => k); }`,
      String.raw`function duplicateClaimIds(ids) { const c = new Map(); for (const id of ids) c.set(id, (c.get(id) || 0) + 1); return [...c.entries()].filter(([, v]) => v > 1).map(([k]) => k).sort((a, b) => a - b); }`,
      String.raw`function duplicateClaimIds(ids) { const out = []; const c = new Map(); for (const id of ids) { c.set(id, (c.get(id) || 0) + 1); if (c.get(id) > 1) out.push(id); } return out.sort(); }`,
    ],
  },

  'Top K Frequent Words': {
    alt: [
      String.raw`function topKWords(text, k) { const words = text.split(' ').filter(Boolean); const cnt = {}; for (const w of words) cnt[w] = (cnt[w] || 0) + 1; const buckets = {}; for (const w of Object.keys(cnt)) (buckets[cnt[w]] = buckets[cnt[w]] || []).push(w); const out = []; for (const f of Object.keys(buckets).map(Number).sort((a, b) => b - a)) { for (const w of buckets[f].sort()) { if (out.length < k) out.push(w); } } return out; }`,
      String.raw`function topKWords(text, k) { const words = [...new Set(text.split(' ').filter(Boolean))]; const f = (w) => text.split(' ').filter(x => x === w).length; words.sort((a, b) => f(b) - f(a) || a.localeCompare(b, 'en', { sensitivity: 'variant' }) ); return words.slice(0, k); }`,
    ],
    py: [
      'from collections import Counter\ndef top_k_words(text, k):\n    c = Counter(text.split())\n    return [w for w, _ in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:k]]\n',
      'import heapq\nfrom collections import Counter\ndef top_k_words(text, k):\n    c = Counter(text.split())\n    return heapq.nsmallest(k, c, key=lambda w: (-c[w], w))\n',
    ],
    wrong: [
      String.raw`function topKWords(text, k) { const c = new Map(); for (const w of text.split(' ').filter(Boolean)) c.set(w, (c.get(w) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(e => e[0]); }`,
      String.raw`function topKWords(text, k) { const c = new Map(); for (const w of text.split(' ').filter(Boolean)) c.set(w, (c.get(w) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(e => e[0]); }`,
    ],
  },

  'Coverage Overlap Days': {
    alt: [
      String.raw`function overlapDays(aStart, aEnd, bStart, bEnd) {
  const lo = aStart > bStart ? aStart : bStart, hi = aEnd < bEnd ? aEnd : bEnd;
  if (lo > hi) return 0;
  const toDays = (s) => { let [y, m, d] = s.split('-').map(Number); m = (m + 9) % 12; y -= Math.floor(m / 10); const era = Math.floor(y / 400), yoe = y - era * 400; const doy = Math.floor((153 * m + 2) / 5) + d - 1; const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; return era * 146097 + doe; };
  return toDays(hi) - toDays(lo) + 1;
}`,
      String.raw`function overlapDays(aStart, aEnd, bStart, bEnd) { let n = 0; const end = new Date(aEnd + 'T00:00:00Z'); for (let d = new Date(aStart + 'T00:00:00Z'); d <= end; d.setUTCDate(d.getUTCDate() + 1)) { const s = d.toISOString().slice(0, 10); if (s >= bStart && s <= bEnd) n++; } return n; }`,
    ],
    py: [
      'from datetime import date\ndef overlap_days(a_start, a_end, b_start, b_end):\n    lo = max(date.fromisoformat(a_start), date.fromisoformat(b_start))\n    hi = min(date.fromisoformat(a_end), date.fromisoformat(b_end))\n    return max(0, (hi - lo).days + 1)\n',
      'from datetime import date, timedelta\ndef overlap_days(a_start, a_end, b_start, b_end):\n    d = date.fromisoformat(a_start)\n    end = date.fromisoformat(a_end)\n    n = 0\n    while d <= end:\n        if b_start <= d.isoformat() <= b_end:\n            n += 1\n        d += timedelta(days=1)\n    return n\n',
    ],
    wrong: [
      String.raw`function overlapDays(aStart, aEnd, bStart, bEnd) { const day = (s) => Date.parse(s) / 86400000; return Math.max(0, Math.min(day(aEnd), day(bEnd)) - Math.max(day(aStart), day(bStart))); }`,
      String.raw`function overlapDays(aStart, aEnd, bStart, bEnd) { const day = (s) => Date.parse(s) / 86400000; return Math.min(day(aEnd), day(bEnd)) - Math.max(day(aStart), day(bStart)) + 1; }`,
    ],
  },

  'Spiral Order of a Matrix': {
    alt: [
      String.raw`function spiralOrder(matrix) { const R = matrix.length; if (!R) return []; const C = matrix[0].length, seen = matrix.map(r => r.map(() => false)), out = []; const dr = [0, 1, 0, -1], dc = [1, 0, -1, 0]; let r = 0, c = 0, d = 0; for (let i = 0; i < R * C; i++) { out.push(matrix[r][c]); seen[r][c] = true; let nr = r + dr[d], nc = c + dc[d]; if (nr < 0 || nr >= R || nc < 0 || nc >= C || seen[nr][nc]) { d = (d + 1) % 4; nr = r + dr[d]; nc = c + dc[d]; } r = nr; c = nc; } return out; }`,
      String.raw`function spiralOrder(matrix) { const m = matrix.map(r => r.slice()), out = []; while (m.length && m[0].length) { out.push(...m.shift()); for (const row of m) if (row.length) out.push(row.pop()); if (m.length) out.push(...m.pop().reverse()); for (let i = m.length - 1; i >= 0; i--) if (m[i].length) out.push(m[i].shift()); } return out; }`,
    ],
    py: [
      'def spiral_order(matrix):\n    out = []\n    m = [row[:] for row in matrix]\n    while m and m[0]:\n        out += m.pop(0)\n        m = [list(r) for r in zip(*m)][::-1]\n    return out\n',
      'def spiral_order(matrix):\n    if not matrix or not matrix[0]:\n        return []\n    top, bottom, left, right = 0, len(matrix) - 1, 0, len(matrix[0]) - 1\n    out = []\n    while top <= bottom and left <= right:\n        for j in range(left, right + 1):\n            out.append(matrix[top][j])\n        top += 1\n        for i in range(top, bottom + 1):\n            out.append(matrix[i][right])\n        right -= 1\n        if top <= bottom:\n            for j in range(right, left - 1, -1):\n                out.append(matrix[bottom][j])\n            bottom -= 1\n        if left <= right:\n            for i in range(bottom, top - 1, -1):\n                out.append(matrix[i][left])\n            left += 1\n    return out\n',
    ],
    wrong: [
      String.raw`function spiralOrder(m) { const r = []; if (!m.length) return r; let t = 0, b = m.length - 1, l = 0, rt = m[0].length - 1; while (t <= b && l <= rt) { for (let j = l; j <= rt; j++) r.push(m[t][j]); t++; for (let i = t; i <= b; i++) r.push(m[i][rt]); rt--; for (let j = rt; j >= l; j--) r.push(m[b][j]); b--; for (let i = b; i >= t; i--) r.push(m[i][l]); l++; } return r; }`,
      String.raw`function spiralOrder(matrix) { return matrix.flat(); }`,
    ],
  },

  'Subarray Sum Equals K': {
    alt: [
      String.raw`function countSubarraysWithSum(nums, k) { let c = 0; for (let i = 0; i < nums.length; i++) { let s = 0; for (let j = i; j < nums.length; j++) { s += nums[j]; if (s === k) c++; } } return c; }`,
      String.raw`function countSubarraysWithSum(nums, k) { const pre = [0]; for (const x of nums) pre.push(pre[pre.length - 1] + x); let c = 0; for (let i = 0; i < pre.length; i++) for (let j = i + 1; j < pre.length; j++) if (pre[j] - pre[i] === k) c++; return c; }`,
    ],
    py: [
      'from collections import defaultdict\ndef count_subarrays_with_sum(nums, k):\n    seen = defaultdict(int)\n    seen[0] = 1\n    s = c = 0\n    for x in nums:\n        s += x\n        c += seen[s - k]\n        seen[s] += 1\n    return c\n',
      'def count_subarrays_with_sum(nums, k):\n    c = 0\n    for i in range(len(nums)):\n        s = 0\n        for j in range(i, len(nums)):\n            s += nums[j]\n            if s == k:\n                c += 1\n    return c\n',
    ],
    wrong: [
      String.raw`function countSubarraysWithSum(nums, k) { let l = 0, s = 0, c = 0; for (let r = 0; r < nums.length; r++) { s += nums[r]; while (s > k && l <= r) s -= nums[l++]; if (s === k) c++; } return c; }`,
      String.raw`function countSubarraysWithSum(nums, k) { const seen = new Set([0]); let s = 0, c = 0; for (const x of nums) { s += x; if (seen.has(s - k)) c++; seen.add(s); } return c; }`,
    ],
  },

  'Decode Run-Length String': {
    alt: [
      String.raw`function decodeRle(encoded) { return encoded.replace(/(\d+)([A-Za-z])/g, (_, n, ch) => ch.repeat(Number(n))); }`,
      String.raw`function decodeRle(encoded) { const parts = encoded.match(/\d+[A-Za-z]/g) || []; return parts.map(p => p.slice(-1).repeat(parseInt(p, 10))).join(''); }`,
    ],
    py: [
      'import re\ndef decode_rle(encoded):\n    return "".join(ch * int(n) for n, ch in re.findall(r"([0-9]+)([A-Za-z])", encoded))\n',
      'def decode_rle(encoded):\n    out, num = [], ""\n    for ch in encoded:\n        if ch.isdigit():\n            num += ch\n        else:\n            out.append(ch * int(num))\n            num = ""\n    return "".join(out)\n',
    ],
    wrong: [
      String.raw`function decodeRle(encoded) { let out = ''; for (let i = 0; i < encoded.length; i += 2) out += encoded[i + 1].repeat(Number(encoded[i])); return out; }`,
      String.raw`function decodeRle(encoded) { let out = '', num = 0; for (const ch of encoded) { if (ch >= '0' && ch <= '9') num = Number(ch); else out += ch.repeat(num); } return out; }`,
    ],
  },

  'Next Greater Element': {
    alt: [
      String.raw`function nextGreater(nums) { const n = nums.length, res = new Array(n).fill(-1), st = []; for (let i = n - 1; i >= 0; i--) { while (st.length && st[st.length - 1] <= nums[i]) st.pop(); if (st.length) res[i] = st[st.length - 1]; st.push(nums[i]); } return res; }`,
      String.raw`function nextGreater(nums) { return nums.map((x, i) => { for (let j = i + 1; j < nums.length; j++) if (nums[j] > x) return nums[j]; return -1; }); }`,
    ],
    py: [
      'def next_greater(nums):\n    res = [-1] * len(nums)\n    st = []\n    for i, x in enumerate(nums):\n        while st and nums[st[-1]] < x:\n            res[st.pop()] = x\n        st.append(i)\n    return res\n',
      'def next_greater(nums):\n    res = []\n    for i, x in enumerate(nums):\n        nxt = -1\n        for y in nums[i + 1:]:\n            if y > x:\n                nxt = y\n                break\n        res.append(nxt)\n    return res\n',
    ],
    wrong: [
      String.raw`function nextGreater(nums) { return nums.map((x, i) => { for (let j = i + 1; j < nums.length; j++) if (nums[j] >= x) return nums[j]; return -1; }); }`,
      String.raw`function nextGreater(nums) { return nums.map((x, i) => (i + 1 < nums.length && nums[i + 1] > x ? nums[i + 1] : -1)); }`,
    ],
  },

  'Count Islands in a Grid': {
    alt: [
      String.raw`function countIslands(grid) { const g = grid.map(r => r.slice()); const R = g.length; let n = 0; const dfs = (r, c) => { if (r < 0 || c < 0 || r >= R || c >= g[0].length || g[r][c] !== 1) return; g[r][c] = 2; dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1); }; for (let r = 0; r < R; r++) for (let c = 0; c < g[0].length; c++) if (g[r][c] === 1) { n++; dfs(r, c); } return n; }`,
      String.raw`function countIslands(grid) { const R = grid.length; if (!R) return 0; const C = grid[0].length, p = Array.from({ length: R * C }, (_, i) => i); const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }; let land = 0, merges = 0; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { if (!grid[r][c]) continue; land++; for (const [dr, dc] of [[1, 0], [0, 1]]) { const nr = r + dr, nc = c + dc; if (nr < R && nc < C && grid[nr][nc]) { const a = find(r * C + c), b = find(nr * C + nc); if (a !== b) { p[a] = b; merges++; } } } } return land - merges; }`,
    ],
    py: [
      'from collections import deque\ndef count_islands(grid):\n    if not grid:\n        return 0\n    R, C = len(grid), len(grid[0])\n    seen = [[False] * C for _ in range(R)]\n    count = 0\n    for r in range(R):\n        for c in range(C):\n            if grid[r][c] == 1 and not seen[r][c]:\n                count += 1\n                q = deque([(r, c)])\n                seen[r][c] = True\n                while q:\n                    y, x = q.popleft()\n                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n                        ny, nx = y + dy, x + dx\n                        if 0 <= ny < R and 0 <= nx < C and grid[ny][nx] == 1 and not seen[ny][nx]:\n                            seen[ny][nx] = True\n                            q.append((ny, nx))\n    return count\n',
      'import sys\ndef count_islands(grid):\n    sys.setrecursionlimit(10000)\n    g = [row[:] for row in grid]\n    def dfs(r, c):\n        if r < 0 or c < 0 or r >= len(g) or c >= len(g[0]) or g[r][c] != 1:\n            return\n        g[r][c] = 2\n        dfs(r + 1, c)\n        dfs(r - 1, c)\n        dfs(r, c + 1)\n        dfs(r, c - 1)\n    n = 0\n    for r in range(len(g)):\n        for c in range(len(g[0])):\n            if g[r][c] == 1:\n                n += 1\n                dfs(r, c)\n    return n\n',
    ],
    wrong: [
      String.raw`function countIslands(grid) { const R = grid.length; if (!R) return 0; const C = grid[0].length; const seen = grid.map(r => r.map(() => false)); let n = 0; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { if (grid[r][c] !== 1 || seen[r][c]) continue; n++; const st = [[r, c]]; seen[r][c] = true; while (st.length) { const [y, x] = st.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ny = y + dy, nx = x + dx; if (ny >= 0 && ny < R && nx >= 0 && nx < C && grid[ny][nx] === 1 && !seen[ny][nx]) { seen[ny][nx] = true; st.push([ny, nx]); } } } } return n; }`,
      String.raw`function countIslands(grid) { let n = 0; for (const row of grid) for (let c = 0; c < row.length; c++) if (row[c] === 1 && (c === 0 || row[c - 1] !== 1)) n++; return n; }`,
    ],
  },

  'Maximum Non-Adjacent Sum': {
    alt: [
      String.raw`function maxNonAdjacentSum(nums) { const n = nums.length; if (!n) return 0; const dp = new Array(n + 1).fill(0); dp[1] = nums[0]; for (let i = 2; i <= n; i++) dp[i] = Math.max(dp[i - 1], dp[i - 2] + nums[i - 1]); return dp[n]; }`,
      String.raw`function maxNonAdjacentSum(nums) { const memo = new Map(); const go = (i) => { if (i >= nums.length) return 0; if (memo.has(i)) return memo.get(i); const v = Math.max(nums[i] + go(i + 2), go(i + 1)); memo.set(i, v); return v; }; return go(0); }`,
      String.raw`function maxNonAdjacentSum(nums) { let best = 0; const n = nums.length; for (let mask = 0; mask < (1 << n); mask++) { if (mask & (mask >> 1)) continue; let s = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) s += nums[i]; if (s > best) best = s; } return best; }`,
    ],
    py: [
      'def max_non_adjacent_sum(nums):\n    take = skip = 0\n    for x in nums:\n        take, skip = skip + x, max(skip, take)\n    return max(take, skip)\n',
      'def max_non_adjacent_sum(nums):\n    n = len(nums)\n    if n == 0:\n        return 0\n    dp = [0] * (n + 1)\n    dp[1] = nums[0]\n    for i in range(2, n + 1):\n        dp[i] = max(dp[i - 1], dp[i - 2] + nums[i - 1])\n    return dp[n]\n',
    ],
    wrong: [
      String.raw`function maxNonAdjacentSum(nums) { let a = 0, b = 0; nums.forEach((x, i) => { if (i % 2 === 0) a += x; else b += x; }); return Math.max(a, b); }`,
      String.raw`function maxNonAdjacentSum(nums) { let s = 0; const used = new Set(); const order = nums.map((x, i) => [x, i]).sort((p, q) => q[0] - p[0]); for (const [x, i] of order) { if (!used.has(i - 1) && !used.has(i + 1) && !used.has(i)) { used.add(i); s += x; } } return s; }`,
    ],
  },

  'Longest Palindromic Substring Length': {
    alt: [
      String.raw`function longestPalindromeLength(text) { const n = text.length; let best = 0; const dp = Array.from({ length: n }, () => new Array(n).fill(false)); for (let len = 1; len <= n; len++) for (let i = 0; i + len <= n; i++) { const j = i + len - 1; if (text[i] === text[j] && (len <= 2 || dp[i + 1][j - 1])) { dp[i][j] = true; best = len; } } return best; }`,
      String.raw`function longestPalindromeLength(text) { const isPal = (s) => { for (let i = 0, j = s.length - 1; i < j; i++, j--) if (s[i] !== s[j]) return false; return true; }; let best = 0; for (let i = 0; i < text.length; i++) for (let j = i + 1; j <= text.length; j++) if (j - i > best && isPal(text.slice(i, j))) best = j - i; return best; }`,
      String.raw`function longestPalindromeLength(text) { if (!text) return 0; const s = '#' + text.split('').join('#') + '#', p = new Array(s.length).fill(0); let c = 0, r = 0, best = 0; for (let i = 0; i < s.length; i++) { if (i < r) p[i] = Math.min(r - i, p[2 * c - i]); while (i - p[i] - 1 >= 0 && i + p[i] + 1 < s.length && s[i - p[i] - 1] === s[i + p[i] + 1]) p[i]++; if (i + p[i] > r) { c = i; r = i + p[i]; } best = Math.max(best, p[i]); } return best; }`,
    ],
    py: [
      'def longest_palindrome_length(text):\n    best = 0\n    for c in range(len(text)):\n        for l, r in ((c, c), (c, c + 1)):\n            while l >= 0 and r < len(text) and text[l] == text[r]:\n                l -= 1\n                r += 1\n            best = max(best, r - l - 1)\n    return best\n',
      'def longest_palindrome_length(text):\n    n = len(text)\n    best = 0\n    for i in range(n):\n        for j in range(i, n):\n            s = text[i:j + 1]\n            if s == s[::-1] and len(s) > best:\n                best = len(s)\n    return best\n',
    ],
    wrong: [
      String.raw`function longestPalindromeLength(text) { let best = 0; const isPal = (s) => s === s.split('').reverse().join(''); for (let j = 1; j <= text.length; j++) { if (isPal(text.slice(0, j))) best = Math.max(best, j); if (isPal(text.slice(text.length - j))) best = Math.max(best, j); } return best; }`,
      String.raw`function longestPalindromeLength(text) { let best = 0; for (let c = 0; c < text.length; c++) { let l = c, r = c; while (l >= 0 && r < text.length && text[l] === text[r]) { l--; r++; } best = Math.max(best, r - l - 1); } return best; }`,
    ],
  },

  'Shortest Window Covering Letters': {
    alt: [
      String.raw`function shortestWindow(text, letters) { const need = {}; for (const ch of letters) need[ch] = (need[ch] || 0) + 1; let best = 0; for (let i = 0; i < text.length; i++) { const have = {}; let ok = 0, req = Object.keys(need).length; for (let j = i; j < text.length; j++) { const ch = text[j]; have[ch] = (have[ch] || 0) + 1; if (need[ch] !== undefined && have[ch] === need[ch]) ok++; if (ok === req) { if (best === 0 || j - i + 1 < best) best = j - i + 1; break; } } } return best; }`,
      String.raw`function shortestWindow(text, letters) { const need = new Map(); for (const ch of letters) need.set(ch, (need.get(ch) || 0) + 1); const ok = (len) => { const have = new Map(); for (let i = 0; i < text.length; i++) { have.set(text[i], (have.get(text[i]) || 0) + 1); if (i >= len) have.set(text[i - len], have.get(text[i - len]) - 1); if (i >= len - 1 && [...need].every(([ch, c]) => (have.get(ch) || 0) >= c)) return true; } return false; }; for (let len = letters.length; len <= text.length; len++) if (ok(len)) return len; return 0; }`,
    ],
    py: [
      'from collections import Counter\ndef shortest_window(text, letters):\n    need = Counter(letters)\n    missing = len(letters)\n    have = Counter()\n    best = 0\n    left = 0\n    for right, ch in enumerate(text):\n        have[ch] += 1\n        if ch in need and have[ch] <= need[ch]:\n            missing -= 1\n        while missing == 0:\n            ln = right - left + 1\n            if best == 0 or ln < best:\n                best = ln\n            lc = text[left]\n            have[lc] -= 1\n            if lc in need and have[lc] < need[lc]:\n                missing += 1\n            left += 1\n    return best\n',
      'from collections import Counter\ndef shortest_window(text, letters):\n    need = Counter(letters)\n    best = 0\n    for i in range(len(text)):\n        for j in range(i + len(letters), len(text) + 1):\n            if not (need - Counter(text[i:j])):\n                if best == 0 or j - i < best:\n                    best = j - i\n                break\n    return best\n',
    ],
    wrong: [
      String.raw`function shortestWindow(text, letters) { const need = new Set(letters); let best = 0, left = 0; const have = new Map(); for (let r = 0; r < text.length; r++) { have.set(text[r], (have.get(text[r]) || 0) + 1); const covered = () => [...need].every(ch => (have.get(ch) || 0) > 0); while (covered()) { const len = r - left + 1; if (best === 0 || len < best) best = len; have.set(text[left], have.get(text[left]) - 1); left++; } } return best; }`,
      String.raw`function shortestWindow(text, letters) { const need = new Map(); for (const ch of letters) need.set(ch, (need.get(ch) || 0) + 1); const have = new Map(); let missing = letters.length; for (let r = 0; r < text.length; r++) { have.set(text[r], (have.get(text[r]) || 0) + 1); if (need.has(text[r]) && have.get(text[r]) <= need.get(text[r])) missing--; if (missing === 0) { let l = 0; return r - l + 1; } } return 0; }`,
    ],
  },

  'Count Inversions': {
    alt: [
      String.raw`function countInversions(nums) { let c = 0; for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) c++; return c; }`,
      String.raw`function countInversions(nums) { if (!nums.length) return 0; const sorted = [...new Set(nums)].sort((a, b) => a - b), rank = new Map(sorted.map((v, i) => [v, i + 1])), bit = new Array(sorted.length + 2).fill(0); const add = (i) => { for (; i < bit.length; i += i & -i) bit[i]++; }, sum = (i) => { let s = 0; for (; i > 0; i -= i & -i) s += bit[i]; return s; }; let inv = 0; for (let i = nums.length - 1; i >= 0; i--) { inv += sum(rank.get(nums[i]) - 1); add(rank.get(nums[i])); } return inv; }`,
    ],
    py: [
      'def count_inversions(nums):\n    c = 0\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] > nums[j]:\n                c += 1\n    return c\n',
      'import bisect\ndef count_inversions(nums):\n    seen = []\n    inv = 0\n    for x in reversed(nums):\n        inv += bisect.bisect_left(seen, x)\n        bisect.insort(seen, x)\n    return inv\n',
    ],
    wrong: [
      String.raw`function countInversions(nums) { let c = 0; for (let i = 0; i + 1 < nums.length; i++) if (nums[i] > nums[i + 1]) c++; return c; }`,
      String.raw`function countInversions(nums) { let c = 0; for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] >= nums[j]) c++; return c; }`,
    ],
  },

  'Count Subsets With Target Sum': {
    alt: [
      String.raw`function countSubsets(nums, target) { const go = (i, left) => { if (left === 0 && i === nums.length) return 1; if (i === nums.length) return 0; return go(i + 1, left) + (nums[i] <= left ? go(i + 1, left - nums[i]) : 0); }; return go(0, target); }`,
      String.raw`function countSubsets(nums, target) { let c = 0; const n = nums.length; for (let mask = 0; mask < (1 << n); mask++) { let s = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) s += nums[i]; if (s === target) c++; } return c; }`,
      String.raw`function countSubsets(nums, target) { const memo = new Map(); const go = (i, left) => { if (left < 0) return 0; if (i === nums.length) return left === 0 ? 1 : 0; const key = i + ',' + left; if (memo.has(key)) return memo.get(key); const v = go(i + 1, left) + go(i + 1, left - nums[i]); memo.set(key, v); return v; }; return go(0, target); }`,
    ],
    py: [
      'def count_subsets(nums, target):\n    dp = [0] * (target + 1)\n    dp[0] = 1\n    for x in nums:\n        for s in range(target, x - 1, -1):\n            dp[s] += dp[s - x]\n    return dp[target]\n',
      'from itertools import combinations\ndef count_subsets(nums, target):\n    c = 0\n    for r in range(len(nums) + 1):\n        for combo in combinations(nums, r):\n            if sum(combo) == target:\n                c += 1\n    return c\n',
    ],
    wrong: [
      String.raw`function countSubsets(nums, target) { const seen = new Set(); const vals = [...new Set(nums)]; let c = 0; const n = vals.length; for (let mask = 0; mask < (1 << n); mask++) { let s = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) s += vals[i]; if (s === target) c++; } return c; }`,
      String.raw`function countSubsets(nums, target) { const dp = new Array(target + 1).fill(0); if (target === 0) return 0; dp[0] = 1; for (const x of nums) for (let s = target; s >= x; s--) dp[s] += dp[s - x]; return dp[target]; }`,
    ],
  },
};
