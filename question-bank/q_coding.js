// Coding question bank (Programming / DSA). Original problems inspired by classic
// LeetCode / GeeksforGeeks / HackerRank / CodeChef practice sets (statements are paraphrased).
// `reference` is a JS solution used ONLY by validate_coding.js; the seeder must strip it before inserting.

const SUBJECT = 'Programming (DSA)';
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const mk = (difficulty, o) => ({
  subject: SUBJECT,
  type: 'coding',
  difficulty,
  marks: { easy: 10, medium: 20, hard: 30 }[difficulty],
  ...o,
});

export const coding = [
  // ───────────────────────────── EASY (6) ─────────────────────────────
  mk('easy', {
    title: 'Reverse the Words',
    statement:
      'Given a sentence, return a new sentence with the words in reverse order. Words are separated by one or more spaces. The result must contain exactly one space between words and no leading or trailing spaces.\n\nInput: a string `text`.\nOutput: the string with its words reversed.',
    time_mins: 3,
    tags: ['string', 'two-pointers'],
    config: {
      fn: { js: 'reverseWords', py: 'reverse_words', params: ['text'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 10,000', 'text contains letters, digits and spaces'],
      examples: [
        { input: 'text = "the sky is blue"', output: '"blue is sky the"' },
        { input: 'text = "  a   good   example  "', output: '"example good a"', explanation: 'Extra spaces are removed.' },
      ],
    },
    tests: [
      { args: ['the sky is blue'], expected: 'blue is sky the', hidden: false },
      { args: ['hello'], expected: 'hello', hidden: false },
      { args: [''], expected: '', hidden: false },
      { args: ['  a   good   example  '], expected: 'example good a', hidden: true },
      { args: ['HPAI builds smart tools'], expected: 'tools smart builds HPAI', hidden: true },
      { args: ['   '], expected: '', hidden: true },
      { args: ['one two'], expected: 'two one', hidden: true },
      { args: ['a b c d e f g'], expected: 'g f e d c b a', hidden: true },
    ],
    reference: String.raw`function reverseWords(text) { return text.split(/\s+/).filter(Boolean).reverse().join(' '); }`,
  }),

  mk('easy', {
    title: 'Second Largest Distinct Value',
    statement:
      'Return the second largest **distinct** value in an array of integers. If the array has fewer than two distinct values, return -1.\n\nInput: an integer array `arr`.\nOutput: the second largest distinct integer, or -1.',
    time_mins: 3,
    tags: ['array', 'math'],
    config: {
      fn: { js: 'secondLargest', py: 'second_largest', params: ['arr'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= arr.length <= 10,000', '-10^9 <= arr[i] <= 10^9'],
      examples: [
        { input: 'arr = [12, 35, 1, 10, 34, 1]', output: '34' },
        { input: 'arr = [10, 10, 10]', output: '-1', explanation: 'Only one distinct value.' },
      ],
    },
    tests: [
      { args: [[12, 35, 1, 10, 34, 1]], expected: 34, hidden: false },
      { args: [[10, 10, 10]], expected: -1, hidden: false },
      { args: [[5]], expected: -1, hidden: false },
      { args: [[]], expected: -1, hidden: true },
      { args: [[-3, -1, -7]], expected: -3, hidden: true },
      { args: [[2, 2, 3, 3]], expected: 2, hidden: true },
      { args: [[1, 2]], expected: 1, hidden: true },
      { args: [[100, 99, 100, 98, 97]], expected: 99, hidden: true },
    ],
    reference: String.raw`function secondLargest(arr) { const d = [...new Set(arr)].sort((a, b) => b - a); return d.length < 2 ? -1 : d[1]; }`,
  }),

  mk('easy', {
    title: 'Fizz Buzz Sequence',
    statement:
      'Return a list of strings for the numbers 1 to n. For multiples of 3 use "Fizz", for multiples of 5 use "Buzz", and for multiples of both use "FizzBuzz". Otherwise use the number itself as a string.\n\nInput: integer `n`.\nOutput: list of n strings.',
    time_mins: 2,
    tags: ['math', 'simulation'],
    config: {
      fn: { js: 'fizzBuzz', py: 'fizz_buzz', params: ['n'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= n <= 10,000'],
      examples: [{ input: 'n = 5', output: '["1", "2", "Fizz", "4", "Buzz"]' }],
    },
    tests: [
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'], hidden: false },
      { args: [0], expected: [], hidden: false },
      { args: [1], expected: ['1'], hidden: false },
      { args: [3], expected: ['1', '2', 'Fizz'], hidden: true },
      {
        args: [15],
        expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'],
        hidden: true,
      },
      { args: [10], expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz'], hidden: true },
      {
        args: [16],
        expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz', '16'],
        hidden: true,
      },
      { args: [2], expected: ['1', '2'], hidden: true },
    ],
    reference: String.raw`function fizzBuzz(n) { const r = []; for (let i = 1; i <= n; i++) r.push(i % 15 === 0 ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : String(i)); return r; }`,
  }),

  mk('easy', {
    title: 'Move Zeros to the End',
    statement:
      'Move all zeros in the array to the end while keeping the relative order of the non-zero elements. Return the resulting array.\n\nInput: an integer array `arr`.\nOutput: the rearranged array.',
    time_mins: 4,
    tags: ['array', 'two-pointers'],
    config: {
      fn: { js: 'moveZeros', py: 'move_zeros', params: ['arr'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= arr.length <= 10,000', '-10^4 <= arr[i] <= 10^4'],
      examples: [{ input: 'arr = [0, 1, 0, 3, 12]', output: '[1, 3, 12, 0, 0]' }],
    },
    tests: [
      { args: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0], hidden: false },
      { args: [[0]], expected: [0], hidden: false },
      { args: [[]], expected: [], hidden: false },
      { args: [[1, 2, 3]], expected: [1, 2, 3], hidden: true },
      { args: [[0, 0, 0]], expected: [0, 0, 0], hidden: true },
      { args: [[4, 0, 5, 0, 0, 6]], expected: [4, 5, 6, 0, 0, 0], hidden: true },
      { args: [[-1, 0, -2, 0]], expected: [-1, -2, 0, 0], hidden: true },
      { args: [[0, 0, 7]], expected: [7, 0, 0], hidden: true },
    ],
    reference: String.raw`function moveZeros(arr) { const nz = arr.filter(x => x !== 0); return nz.concat(new Array(arr.length - nz.length).fill(0)); }`,
  }),

  mk('easy', {
    title: 'Anagram Check',
    statement:
      'Two strings are anagrams if one can be rearranged to form the other using every character exactly once. The comparison is case-sensitive.\n\nInput: strings `a` and `b`.\nOutput: true if they are anagrams, otherwise false.',
    time_mins: 3,
    tags: ['string', 'hashing'],
    config: {
      fn: { js: 'isAnagram', py: 'is_anagram', params: ['a', 'b'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= a.length, b.length <= 10,000', 'Strings may contain any printable characters'],
      examples: [
        { input: 'a = "listen", b = "silent"', output: 'true' },
        { input: 'a = "rat", b = "car"', output: 'false' },
      ],
    },
    tests: [
      { args: ['listen', 'silent'], expected: true, hidden: false },
      { args: ['rat', 'car'], expected: false, hidden: false },
      { args: ['', ''], expected: true, hidden: false },
      { args: ['a', 'a'], expected: true, hidden: true },
      { args: ['aab', 'aba'], expected: true, hidden: true },
      { args: ['aab', 'abb'], expected: false, hidden: true },
      { args: ['Listen', 'Silent'], expected: false, hidden: true },
      { args: ['abc', 'ab'], expected: false, hidden: true },
    ],
    reference: String.raw`function isAnagram(a, b) { return a.length === b.length && [...a].sort().join('') === [...b].sort().join(''); }`,
  }),

  mk('easy', {
    title: 'Valid Palindrome (Ignore Symbols)',
    statement:
      'A phrase is a palindrome if, after converting letters to lowercase and removing every character that is not a letter or digit, it reads the same forward and backward. Return whether the given text is a palindrome.\n\nInput: string `text`.\nOutput: true or false.',
    time_mins: 4,
    tags: ['string', 'two-pointers'],
    config: {
      fn: { js: 'validPalindrome', py: 'valid_palindrome', params: ['text'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 100,000', 'An empty cleaned string counts as a palindrome'],
      examples: [
        { input: 'text = "A man, a plan, a canal: Panama"', output: 'true' },
        { input: 'text = "race a car"', output: 'false' },
      ],
    },
    tests: [
      { args: ['A man, a plan, a canal: Panama'], expected: true, hidden: false },
      { args: ['race a car'], expected: false, hidden: false },
      { args: [''], expected: true, hidden: false },
      { args: [' '], expected: true, hidden: true },
      { args: ['0P'], expected: false, hidden: true },
      { args: ["No 'x' in Nixon"], expected: true, hidden: true },
      { args: ['ab_a'], expected: true, hidden: true },
      { args: ["Madam, I'm Adam"], expected: true, hidden: true },
    ],
    reference: String.raw`function validPalindrome(text) { const s = text.toLowerCase().replace(/[^a-z0-9]/g, ''); return s === s.split('').reverse().join(''); }`,
  }),

  // ───────────────────────────── MEDIUM (6) ─────────────────────────────
  mk('medium', {
    title: 'Pair With Target Sum',
    statement:
      'Given an integer array `nums` and an integer `target`, find the two different positions whose values add up to `target`. Exactly one such pair exists in every test. Return the two indices as `[i, j]` with `i < j`.\n\nInput: `nums`, `target`.\nOutput: list `[i, j]`.',
    time_mins: 6,
    tags: ['array', 'hashing'],
    config: {
      fn: { js: 'twoSumIndices', py: 'two_sum_indices', params: ['nums', 'target'] },
      languages: ['python', 'javascript'],
      constraints: ['2 <= nums.length <= 10,000', 'Exactly one valid pair exists', 'Return indices in increasing order'],
      examples: [
        { input: 'nums = [2, 7, 11, 15], target = 9', output: '[0, 1]', explanation: '2 + 7 = 9' },
        { input: 'nums = [3, 2, 4], target = 6', output: '[1, 2]' },
      ],
    },
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], hidden: false },
      { args: [[3, 2, 4], 6], expected: [1, 2], hidden: false },
      { args: [[3, 3], 6], expected: [0, 1], hidden: false },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4], hidden: true },
      { args: [[1, 5, 9, 14, 20], 34], expected: [3, 4], hidden: true },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
      { args: [[10, 26, 30, 31, 47, 60], 40], expected: [0, 2], hidden: true },
      { args: [range(5000, (i) => i * 2).concat([100001, 3]), 100004], expected: [5000, 5001], hidden: true },
    ],
    reference: String.raw`function twoSumIndices(nums, target) { const seen = new Map(); for (let j = 0; j < nums.length; j++) { const i = seen.get(target - nums[j]); if (i !== undefined) return [i, j]; seen.set(nums[j], j); } return []; }`,
  }),

  mk('medium', {
    title: 'Longest Substring Without Repeats',
    statement:
      'Return the length of the longest contiguous substring of `text` in which no character appears more than once.\n\nInput: string `text`.\nOutput: integer length.',
    time_mins: 6,
    tags: ['string', 'sliding-window', 'hashing'],
    config: {
      fn: { js: 'lengthOfLongestSubstring', py: 'length_of_longest_substring', params: ['text'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 50,000', 'text may contain letters, digits, symbols and spaces'],
      examples: [
        { input: 'text = "abcabcbb"', output: '3', explanation: 'The answer is "abc".' },
        { input: 'text = "bbbbb"', output: '1' },
      ],
    },
    tests: [
      { args: ['abcabcbb'], expected: 3, hidden: false },
      { args: ['bbbbb'], expected: 1, hidden: false },
      { args: ['pwwkew'], expected: 3, hidden: false },
      { args: [''], expected: 0, hidden: true },
      { args: [' '], expected: 1, hidden: true },
      { args: ['dvdf'], expected: 3, hidden: true },
      { args: ['abba'], expected: 2, hidden: true },
      { args: ['tmmzuxt'], expected: 5, hidden: true },
    ],
    reference: String.raw`function lengthOfLongestSubstring(text) { const last = new Map(); let best = 0, start = 0; for (let i = 0; i < text.length; i++) { const c = text[i]; if (last.has(c) && last.get(c) >= start) start = last.get(c) + 1; last.set(c, i); best = Math.max(best, i - start + 1); } return best; }`,
  }),

  mk('medium', {
    title: 'Merge Overlapping Intervals',
    statement:
      'Given a list of intervals `[start, end]`, merge all overlapping intervals and return the merged list sorted by start. Intervals that touch (for example `[1,4]` and `[4,5]`) are considered overlapping.\n\nInput: list of `[start, end]` pairs (not necessarily sorted).\nOutput: list of merged intervals sorted by start.',
    time_mins: 7,
    tags: ['array', 'sorting', 'intervals'],
    config: {
      fn: { js: 'mergeIntervals', py: 'merge_intervals', params: ['intervals'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= intervals.length <= 10,000', 'start <= end for every interval', '-10^6 <= start, end <= 10^6'],
      examples: [
        { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' },
        { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]' },
      ],
    },
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]], hidden: false },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]], hidden: false },
      { args: [[]], expected: [], hidden: false },
      { args: [[[5, 7]]], expected: [[5, 7]], hidden: true },
      { args: [[[8, 10], [1, 3], [2, 6]]], expected: [[1, 6], [8, 10]], hidden: true },
      { args: [[[1, 10], [2, 3], [4, 5]]], expected: [[1, 10]], hidden: true },
      { args: [[[1, 2], [3, 4], [5, 6]]], expected: [[1, 2], [3, 4], [5, 6]], hidden: true },
      { args: [[[-5, -2], [-3, 0], [1, 2]]], expected: [[-5, 0], [1, 2]], hidden: true },
    ],
    reference: String.raw`function mergeIntervals(intervals) { const s = intervals.map(x => [...x]).sort((a, b) => a[0] - b[0]); const out = []; for (const [a, b] of s) { if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b); else out.push([a, b]); } return out; }`,
  }),

  mk('medium', {
    title: 'Balanced Brackets',
    statement:
      'The string `text` contains only the characters `(`, `)`, `{`, `}`, `[` and `]`. It is valid if every opening bracket is closed by the same type of bracket and brackets close in the correct order. An empty string is valid.\n\nInput: string `text`.\nOutput: true if valid, otherwise false.',
    time_mins: 5,
    tags: ['string', 'stack'],
    config: {
      fn: { js: 'isValidParentheses', py: 'is_valid_parentheses', params: ['text'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 10,000', 'Only bracket characters appear'],
      examples: [
        { input: 'text = "()[]{}"', output: 'true' },
        { input: 'text = "([)]"', output: 'false' },
      ],
    },
    tests: [
      { args: ['()[]{}'], expected: true, hidden: false },
      { args: ['(]'], expected: false, hidden: false },
      { args: [''], expected: true, hidden: false },
      { args: ['([{}])'], expected: true, hidden: true },
      { args: ['((('], expected: false, hidden: true },
      { args: ['){'], expected: false, hidden: true },
      { args: ['{[()()]}'], expected: true, hidden: true },
      { args: ['([)]'], expected: false, hidden: true },
    ],
    reference: String.raw`function isValidParentheses(text) { const m = { ')': '(', ']': '[', '}': '{' }; const st = []; for (const c of text) { if (c === '(' || c === '[' || c === '{') st.push(c); else { if (st.pop() !== m[c]) return false; } } return st.length === 0; }`,
  }),

  mk('medium', {
    title: 'Product of Array Except Self',
    statement:
      'Return an array `out` where `out[i]` is the product of all elements of `nums` except `nums[i]`. Solve it **without using division**; an O(n) solution is expected.\n\nInput: integer array `nums`.\nOutput: integer array of the same length.',
    time_mins: 7,
    tags: ['array', 'prefix-sum'],
    config: {
      fn: { js: 'productExceptSelf', py: 'product_except_self', params: ['nums'] },
      languages: ['python', 'javascript'],
      constraints: ['1 <= nums.length <= 10,000', '-30 <= nums[i] <= 30', 'The product of any prefix or suffix fits in a 32-bit integer'],
      examples: [
        { input: 'nums = [1, 2, 3, 4]', output: '[24, 12, 8, 6]' },
        { input: 'nums = [-1, 1, 0, -3, 3]', output: '[0, 0, 9, 0, 0]' },
      ],
    },
    tests: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6], hidden: false },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0], hidden: false },
      { args: [[5]], expected: [1], hidden: false },
      { args: [[2, 3]], expected: [3, 2], hidden: true },
      { args: [[0, 0]], expected: [0, 0], hidden: true },
      { args: [[1, 1, 1, 1]], expected: [1, 1, 1, 1], hidden: true },
      { args: [[2, 0, 4]], expected: [0, 8, 0], hidden: true },
      { args: [[3, 2, 1, 5, 10]], expected: [100, 150, 300, 60, 30], hidden: true },
    ],
    reference: String.raw`function productExceptSelf(nums) { const n = nums.length, out = new Array(n).fill(1); let p = 1; for (let i = 0; i < n; i++) { out[i] = p; p *= nums[i]; } let s = 1; for (let i = n - 1; i >= 0; i--) { out[i] *= s; s *= nums[i]; } return out.map(x => x + 0); }`,
  }),

  mk('medium', {
    title: 'Search Insert Position',
    statement:
      'Given a sorted array of distinct integers `nums` (ascending) and an integer `target`, return the index of `target` if it exists. Otherwise return the index where it would be inserted to keep the array sorted. Aim for O(log n) time.\n\nInput: `nums`, `target`.\nOutput: integer index.',
    time_mins: 5,
    tags: ['binary-search', 'array'],
    config: {
      fn: { js: 'searchInsert', py: 'search_insert', params: ['nums', 'target'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 100,000', 'nums is sorted ascending with distinct values', '-10^9 <= nums[i], target <= 10^9'],
      examples: [
        { input: 'nums = [1, 3, 5, 6], target = 5', output: '2' },
        { input: 'nums = [1, 3, 5, 6], target = 2', output: '1', explanation: '2 would be inserted between 1 and 3.' },
      ],
    },
    tests: [
      { args: [[1, 3, 5, 6], 5], expected: 2, hidden: false },
      { args: [[1, 3, 5, 6], 2], expected: 1, hidden: false },
      { args: [[1, 3, 5, 6], 7], expected: 4, hidden: false },
      { args: [[1, 3, 5, 6], 0], expected: 0, hidden: true },
      { args: [[], 3], expected: 0, hidden: true },
      { args: [[4], 5], expected: 1, hidden: true },
      { args: [[-10, -5, 0, 5, 10], -6], expected: 1, hidden: true },
      { args: [range(1000, (i) => i * 2), 777], expected: 389, hidden: true },
    ],
    reference: String.raw`function searchInsert(nums, target) { let lo = 0, hi = nums.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (nums[mid] < target) lo = mid + 1; else hi = mid; } return lo; }`,
  }),

  // ───────────────────────────── HARD (4) ─────────────────────────────
  mk('hard', {
    title: 'Longest Increasing Subsequence',
    statement:
      'Return the length of the longest **strictly increasing** subsequence of `nums`. A subsequence keeps the original relative order but may skip elements.\n\nInput: integer array `nums`.\nOutput: integer length (0 for an empty array).\n\nA quadratic solution passes the smaller tests; an O(n log n) solution is recommended for the largest ones.',
    time_mins: 9,
    tags: ['dp', 'binary-search', 'array'],
    config: {
      fn: { js: 'lengthOfLIS', py: 'length_of_lis', params: ['nums'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= nums.length <= 2,500', '-10^4 <= nums[i] <= 10^4'],
      examples: [
        { input: 'nums = [10, 9, 2, 5, 3, 7, 101, 18]', output: '4', explanation: 'One LIS is [2, 3, 7, 101].' },
        { input: 'nums = [7, 7, 7, 7]', output: '1' },
      ],
    },
    tests: [
      { args: [[10, 9, 2, 5, 3, 7, 101, 18]], expected: 4, hidden: false },
      { args: [[0, 1, 0, 3, 2, 3]], expected: 4, hidden: false },
      { args: [[7, 7, 7, 7]], expected: 1, hidden: false },
      { args: [[]], expected: 0, hidden: true },
      { args: [[3, 10, 2, 1, 20]], expected: 3, hidden: true },
      { args: [[50, 3, 10, 7, 40, 80]], expected: 4, hidden: true },
      { args: [range(2000, (i) => i)], expected: 2000, hidden: true },
      { args: [range(2000, (i) => 2000 - i)], expected: 1, hidden: true },
    ],
    reference: String.raw`function lengthOfLIS(nums) { const t = []; for (const x of nums) { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < x) lo = m + 1; else hi = m; } t[lo] = x; } return t.length; }`,
  }),

  mk('hard', {
    title: 'Trapping Rain Water',
    statement:
      'An elevation map is given as an array `height`, where each bar has width 1. After raining, water is trapped between the bars. Compute the total units of water trapped.\n\nInput: non-negative integer array `height`.\nOutput: integer amount of trapped water.',
    time_mins: 9,
    tags: ['array', 'two-pointers', 'dp'],
    config: {
      fn: { js: 'trapRainWater', py: 'trap_rain_water', params: ['height'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= height.length <= 20,000', '0 <= height[i] <= 100,000'],
      examples: [
        { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
        { input: 'height = [4,2,0,3,2,5]', output: '9' },
      ],
    },
    tests: [
      { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6, hidden: false },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 9, hidden: false },
      { args: [[]], expected: 0, hidden: false },
      { args: [[3]], expected: 0, hidden: true },
      { args: [[1, 2, 3]], expected: 0, hidden: true },
      { args: [[3, 0, 3]], expected: 3, hidden: true },
      { args: [[2, 0, 2, 0, 2]], expected: 4, hidden: true },
      { args: [[0, 7, 1, 4, 6]], expected: 7, hidden: true },
    ],
    reference: String.raw`function trapRainWater(height) { let l = 0, r = height.length - 1, lm = 0, rm = 0, w = 0; while (l < r) { if (height[l] < height[r]) { lm = Math.max(lm, height[l]); w += lm - height[l]; l++; } else { rm = Math.max(rm, height[r]); w += rm - height[r]; r--; } } return w; }`,
  }),

  mk('hard', {
    title: 'Minimum Coins for Amount',
    statement:
      'You have an unlimited supply of each coin denomination in `coins`. Return the **fewest** number of coins needed to make exactly `amount`. If it is impossible, return -1. An amount of 0 needs 0 coins.\n\nInput: integer array `coins`, integer `amount`.\nOutput: minimum coin count or -1.',
    time_mins: 9,
    tags: ['dp', 'unbounded-knapsack'],
    config: {
      fn: { js: 'coinChange', py: 'coin_change', params: ['coins', 'amount'] },
      languages: ['python', 'javascript'],
      constraints: ['1 <= coins.length <= 12', '1 <= coins[i] <= 10,000', '0 <= amount <= 10,000'],
      examples: [
        { input: 'coins = [1, 2, 5], amount = 11', output: '3', explanation: '11 = 5 + 5 + 1' },
        { input: 'coins = [2], amount = 3', output: '-1' },
      ],
    },
    tests: [
      { args: [[1, 2, 5], 11], expected: 3, hidden: false },
      { args: [[2], 3], expected: -1, hidden: false },
      { args: [[1], 0], expected: 0, hidden: false },
      { args: [[1, 3, 4], 6], expected: 2, hidden: true },
      { args: [[186, 419, 83, 408], 6249], expected: 20, hidden: true },
      { args: [[5, 10], 7], expected: -1, hidden: true },
      { args: [[1, 2, 5], 100], expected: 20, hidden: true },
      { args: [[2, 5, 10, 1], 27], expected: 4, hidden: true },
    ],
    reference: String.raw`function coinChange(coins, amount) { const dp = new Array(amount + 1).fill(Infinity); dp[0] = 0; for (let a = 1; a <= amount; a++) for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1; return dp[amount] === Infinity ? -1 : dp[amount]; }`,
  }),

  mk('hard', {
    title: 'Word Break',
    statement:
      'Given a string `text` and a list of words `words`, decide whether `text` can be split into a sequence of one or more dictionary words. A word may be reused any number of times. An empty `text` can always be formed.\n\nInput: string `text`, list of strings `words`.\nOutput: true or false.\n\nBeware: naive recursion becomes exponential on adversarial inputs, so memoise or use dynamic programming.',
    time_mins: 10,
    tags: ['dp', 'string', 'memoization'],
    config: {
      fn: { js: 'wordBreak', py: 'word_break', params: ['text', 'words'] },
      languages: ['python', 'javascript'],
      constraints: ['0 <= text.length <= 300', '1 <= words.length <= 1,000', '1 <= words[i].length <= 20', 'All strings are lowercase letters'],
      examples: [
        { input: 'text = "leetcode", words = ["leet", "code"]', output: 'true' },
        { input: 'text = "catsandog", words = ["cats", "dog", "sand", "and", "cat"]', output: 'false' },
      ],
    },
    tests: [
      { args: ['leetcode', ['leet', 'code']], expected: true, hidden: false },
      { args: ['applepenapple', ['apple', 'pen']], expected: true, hidden: false },
      { args: ['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], expected: false, hidden: false },
      { args: ['', ['a']], expected: true, hidden: true },
      { args: ['a', ['b']], expected: false, hidden: true },
      { args: ['aaaaaaa', ['aaaa', 'aaa']], expected: true, hidden: true },
      { args: ['cars', ['car', 'ca', 'rs']], expected: true, hidden: true },
      { args: ['a'.repeat(29) + 'b', ['a', 'aa', 'aaa', 'aaaa']], expected: false, hidden: true },
    ],
    reference: String.raw`function wordBreak(text, words) { const set = new Set(words), dp = new Array(text.length + 1).fill(false); dp[0] = true; for (let i = 1; i <= text.length; i++) for (let j = 0; j < i; j++) if (dp[j] && set.has(text.slice(j, i))) { dp[i] = true; break; } return dp[text.length]; }`,
  }),
];

// ───────────────── Complexity benchmarks (used by the proctor/admin "Analyze complexity" tool) ─────────────────
// `gen` is JS source `(n, rnd) => [args]` evaluated in the browser worker (rnd() is a seeded 0..1 generator).
// Inputs are chosen to exercise the worst/typical path and avoid number blow-up. `sizes` span >= 30x (some far more).
const ints = 'Array.from({length:n},()=>Math.floor(rnd()*2001)-1000)';
const SMALL = [25, 50, 100, 200, 400, 800, 1600, 3200];
const BENCH = {
  'Reverse the Words': { sizes: SMALL, gen: `(n, rnd) => { const w = []; let len = 0; while (len < n) { const l = 1 + Math.floor(rnd() * 7); w.push('abcdefgh'.slice(0, l)); len += l + 1; } return [w.join(' ')]; }` },
  'Second Largest Distinct Value': { sizes: [100, 400, 1600, 6400, 25600, 102400], gen: `(n, rnd) => [${ints}]` },
  'Fizz Buzz Sequence': { sizes: SMALL, gen: '(n) => [n]' },
  'Move Zeros to the End': { sizes: SMALL, gen: `(n, rnd) => [Array.from({length:n},()=> rnd() < 0.4 ? 0 : 1 + Math.floor(rnd() * 100))]` },
  'Anagram Check': { sizes: SMALL, gen: `(n, rnd) => { const s = Array.from({length:n},()=>String.fromCharCode(97 + Math.floor(rnd() * 26))).join(''); return [s, s.split('').reverse().join('')]; }` },
  'Valid Palindrome (Ignore Symbols)': { sizes: [100, 400, 1600, 6400, 25600, 102400], gen: `(n, rnd) => { const h = Array.from({length:Math.floor(n/2)},()=>String.fromCharCode(97 + Math.floor(rnd() * 26))).join(''); return [h + h.split('').reverse().join('')]; }` },
  'Pair With Target Sum': { sizes: SMALL, gen: `(n, rnd) => [${ints}, 1000000]` },
  'Longest Substring Without Repeats': { sizes: SMALL, gen: `(n, rnd) => [Array.from({length:n},()=>String.fromCharCode(97 + Math.floor(rnd() * 26))).join('')]` },
  'Merge Overlapping Intervals': { sizes: SMALL, gen: `(n, rnd) => [Array.from({length:n},()=>{ const s = Math.floor(rnd() * n * 2); return [s, s + 1 + Math.floor(rnd() * 20)]; })]` },
  'Balanced Brackets': { sizes: [100, 400, 1600, 6400, 25600, 102400], gen: `(n) => ['()'.repeat(Math.floor(n / 2))]` },
  'Product of Array Except Self': { sizes: SMALL, gen: `(n, rnd) => [Array.from({length:n},()=> rnd() < 0.5 ? 1 : -1)]` },
  'Search Insert Position': { sizes: [1000, 4000, 16000, 64000, 256000], gen: `(n) => [Array.from({length:n},(_, i)=> i * 2), n]` },
  'Longest Increasing Subsequence': { sizes: SMALL, gen: `(n, rnd) => [${ints}]` },
  'Trapping Rain Water': { sizes: [100, 400, 1600, 6400, 25600, 102400], gen: `(n, rnd) => [Array.from({length:n},()=>Math.floor(rnd() * 101))]` },
  'Minimum Coins for Amount': { sizes: [25, 50, 100, 200, 400, 800], gen: '(n) => [[1, 5, 10, 25, 50], n]' },
  'Word Break': { sizes: [12, 25, 50, 100, 200, 400, 800], gen: `(n) => ['ab'.repeat(Math.ceil(n / 2)).slice(0, n), ['a', 'ab', 'b']]` },
};
for (const q of coding) if (BENCH[q.title]) q.config.bench = BENCH[q.title];
