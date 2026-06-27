import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab01: Lab = {
  id: 'lab-01',
  number: 1,
  title: 'The Java Language',
  subtitle: 'The sharp edges: numeric pitfalls, overload resolution, pass-by-value & arrays',
  estimatedHours: 5,
  concepts: ['JVM', 'overflow', 'floating point', 'autoboxing', 'var', 'overload resolution', 'arrays'],
  overview: `You already know \`if\`, \`for\`, and how to write a method. This lab skips that and
goes straight to the parts of core Java that **trip people up in code reviews and
interviews**: integer overflow, floating-point traps, the \`Integer\` cache, overload
resolution rules, pass-by-value semantics, and array covariance.

Treat the theory as a fast refresher — collapse what you know, focus on the boxed
gotchas. The exercises are where the value is: each one targets a real edge case you'd
be expected to handle on the job.`,
  theory: [
    {
      id: 'jvm',
      heading: 'How Java actually runs (and why it matters)',
      body: `Source compiles to **bytecode** (\`.class\`), which the **JVM** interprets and then
**JIT-compiles** hot methods to native code at runtime. Two practical consequences:

- **Warm-up matters.** The first calls to a method are interpreted (slow); after a
  threshold the JIT compiles and inlines them. This is why naive microbenchmarks lie —
  use JMH for real measurements.
- **Portability is at the bytecode level**, not source — the same \`.class\` runs on any
  JVM of a compatible version.

Memory model in one breath: **the stack** holds frames with local variables and
references (one per thread); **the heap** holds all objects and is garbage-collected.
A variable of a reference type holds a *reference* into the heap, never the object itself.

~~~java
int x = 5;            // the value 5 lives on the stack
int[] a = {1, 2, 3};  // 'a' (a reference) is on the stack; the array is on the heap
~~~

> Scratch tip: on JDK 11+ you can run a single source file directly — \`java Scratch.java\` — no \`javac\` step. Great for trying the snippets below.`,
    },
    {
      id: 'numeric',
      heading: 'Numeric pitfalls: overflow, floats & the Integer cache',
      body: `**Integer overflow is silent.** Arithmetic wraps around modulo 2³² with no error:

~~~java
int max = Integer.MAX_VALUE;   // 2147483647
System.out.println(max + 1);   // -2147483648  (wraps!)

// A classic bug: the midpoint of a binary search overflows for large indices.
int mid = (low + high) / 2;        // BUG: low+high can overflow
int safe = low + (high - low) / 2; // correct
~~~

Use \`Math.addExact\`, \`multiplyExact\`, etc. to fail loudly, or \`long\` when in doubt.

**Floating point is not exact.** \`double\`/\`float\` are binary fractions:

~~~java
System.out.println(0.1 + 0.2);            // 0.30000000000000004
System.out.println(0.1 + 0.2 == 0.3);     // false
~~~

Never use \`==\` on doubles (compare with an epsilon) and **never use \`double\` for money** —
use \`BigDecimal\` (constructed from a String, not a double).

**Autoboxing has two traps.** First, the \`Integer\` cache means \`==\` (reference identity)
behaves inconsistently:

~~~java
Integer a = 127, b = 127;
System.out.println(a == b);   // true  — cached (-128..127 are interned)
Integer c = 128, d = 128;
System.out.println(c == d);   // false — different objects!
// Always compare boxed values with .equals() or unbox to int.
~~~

Second, boxing in a tight loop quietly allocates millions of objects:

~~~java
Long sum = 0L;                 // BUG: boxed Long
for (int i = 0; i < 1_000_000; i++) sum += i;  // box/unbox every iteration
~~~

**\`char\` is a 16-bit unsigned integer.** It participates in arithmetic:

~~~java
char c = 'a';
System.out.println((char) (c + 1));  // 'b'
System.out.println('a' + 1);         // 98 (int — promoted, no cast)
~~~`,
    },
    {
      id: 'var',
      heading: 'var, final & effectively-final',
      body: `\`var\` is local type **inference**, not dynamic typing — the type is fixed at compile
time. It's only allowed for local variables with an initializer:

~~~java
var names = new ArrayList<String>();   // ArrayList<String> — clear
var x = new ArrayList<>();             // ArrayList<Object> — diamond infers Object!
// var y;            // illegal: no initializer to infer from
// var z = null;     // illegal: can't infer from null alone
~~~

Use \`var\` when the right-hand side already names the type; avoid it when it hides the
type (\`var result = service.process();\` — what is \`result\`?).

**Effectively final** matters for lambdas and inner classes: a captured local must never
be reassigned, even without the \`final\` keyword.

~~~java
int factor = 2;                       // effectively final
Runnable r = () -> System.out.println(factor * 10);
// factor = 3;   // would break it: now 'factor' is not effectively final -> compile error
~~~`,
    },
    {
      id: 'switch',
      heading: 'Modern switch & control-flow traps',
      body: `Prefer **switch expressions** (arrow form): they return a value, require no \`break\`,
and the compiler enforces **exhaustiveness** over an enum (no silent missing case).

~~~java
enum Signal { RED, AMBER, GREEN }

int seconds = switch (signal) {
    case RED -> 30;
    case AMBER -> 5;
    case GREEN -> 45;
    // no default needed: all enum constants are covered
};

// Use yield when a branch needs a block:
int v = switch (n) {
    case 0 -> 0;
    default -> {
        int t = expensive(n);
        yield t * 2;
    }
};
~~~

The old colon form **falls through** without \`break\` — a perennial bug:

~~~java
switch (day) {
    case 6:
    case 7:
        System.out.println("weekend");   // both 6 and 7 reach here (intentional fall-through)
        break;
    default:
        System.out.println("weekday");
}
~~~

**Labeled break** cleanly exits nested loops (better than a flag variable):

~~~java
search:
for (int i = 0; i < rows; i++)
    for (int j = 0; j < cols; j++)
        if (grid[i][j] == target) { found = true; break search; }
~~~`,
    },
    {
      id: 'methods',
      heading: 'Methods: overload resolution & pass-by-value',
      body: `When several overloads match, the compiler picks the **most specific** in this
priority order:

1. exact match / **widening** primitive conversion (\`int\` -> \`long\`)
2. **boxing/unboxing** (\`int\` -> \`Integer\`)
3. **varargs** (last resort)

~~~java
static void f(long x)      { System.out.println("long"); }
static void f(Integer x)   { System.out.println("Integer"); }
static void f(int... x)    { System.out.println("varargs"); }

f(1);   // prints "long" — widening beats boxing beats varargs
~~~

This resolution happens at **compile time** based on the *declared* (static) type — unlike
overriding, which dispatches at runtime on the actual type.

**Java is pass-by-value, always.** For objects, the *value* passed is the reference (a
copy of it). So you can mutate the pointed-to object, but reassigning the parameter is
invisible to the caller:

~~~java
static void mutate(int[] a)  { a[0] = 99; }      // visible — same array
static void reassign(int[] a){ a = new int[]{0}; } // invisible — local copy repointed

static void swap(int x, int y) {   // does NOTHING useful
    int t = x; x = y; y = t;       // swaps the local copies only
}
~~~

This is *the* most common Java interview question — be able to explain it with the swap example.`,
    },
    {
      id: 'arrays',
      heading: 'Arrays: covariance, equality & copying',
      body: `Arrays are **covariant**, which is a hole in the type system — it compiles but can
blow up at runtime:

~~~java
Object[] objs = new String[3];   // legal: String[] "is a" Object[]
objs[0] = 42;                    // compiles, but throws ArrayStoreException at runtime!
~~~

(Generics fixed this — \`List<String>\` is *not* a \`List<Object>\` — which is why generics
are preferred.)

**Equality:** \`==\` and \`Arrays.equals\` are different things, and \`toString\` on an array is
useless:

~~~java
int[] a = {1, 2, 3}, b = {1, 2, 3};
System.out.println(a == b);                 // false (different objects)
System.out.println(a.equals(b));            // false (Object.equals — identity)
System.out.println(Arrays.equals(a, b));    // true  (element-wise)
System.out.println(a);                      // "[I@1b6d3586" — use Arrays.toString(a)
System.out.println(Arrays.deepEquals(grid1, grid2)); // for nested/2D arrays
~~~

**Copying** — never hand-roll a loop:

~~~java
int[] copy = Arrays.copyOf(a, a.length);          // resize/clone
int[] slice = Arrays.copyOfRange(a, 1, 3);        // {2, 3}
System.arraycopy(a, 0, dest, 0, a.length);        // fastest bulk copy
~~~

2D arrays are **arrays of arrays** and can be jagged (rows of different lengths) — there
is no true rectangular 2D array in Java.`,
    },
  ],
  exercises: [
    {
      id: 'reverse-integer',
      title: 'Reverse an integer (overflow-safe)',
      difficulty: 'warmup',
      prompt: `Implement \`static int reverse(int x)\` that reverses the decimal digits of a
32-bit signed integer. If the reversed value would overflow the \`int\` range
\`[-2147483648, 2147483647]\`, return \`0\` instead of wrapping.

Examples:

~~~text
reverse(123)         ->  321
reverse(-120)        ->  -21   (trailing zero drops off)
reverse(1534236469)  ->    0   (reversed value overflows int)
~~~

Requirements:
- Do **not** convert to a \`String\` — extract digits with \`%\` and \`/\`.
- Negative sign is preserved; a trailing zero on the original becomes a leading zero
  on the reversed value and is simply dropped (integer semantics).
- Overflow must be detected **before** it happens — do not let the value wrap and check
  afterwards.

The combination of modulo/integer-division digit extraction and pre-overflow detection
is the whole point of this exercise.`,
      starter: `public class ReverseInteger {

    /**
     * Reverses the decimal digits of x.
     * Returns 0 if the reversed value overflows int range.
     */
    static int reverse(int x) {
        // TODO 1: use a long accumulator to collect the reversed digits
        // TODO 2: in the loop, peel the last digit with (x % 10), append to accumulator,
        //         then shrink x with (x / 10); repeat until x == 0
        // TODO 3: after the loop, check whether the accumulator fits in an int;
        //         if not, return 0
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(reverse(123));          // 321
        System.out.println(reverse(-120));         // -21
        System.out.println(reverse(0));            // 0
        System.out.println(reverse(1534236469));   // 0  (overflow)
    }
}`,
      hints: [
        'Use a \`long rev = 0\` accumulator. Each iteration: \`rev = rev * 10 + (x % 10)\`, then \`x /= 10\`. Java\'s \`%\` preserves sign for negative operands, so negative inputs are handled automatically.',
        'After the loop, check \`rev > Integer.MAX_VALUE || rev < Integer.MIN_VALUE\`. If either is true, return \`0\`; otherwise return \`(int) rev\`.',
        'You can also detect overflow at each step without a \`long\`: before \`rev = rev * 10 + digit\`, verify \`rev > Integer.MAX_VALUE / 10\` (or \`rev < Integer.MIN_VALUE / 10\`) and bail early. The \`long\` approach is simpler and equally correct.',
      ],
      solution: `public class ReverseInteger {

    static int reverse(int x) {
        long rev = 0;
        while (x != 0) {
            rev = rev * 10 + (x % 10);   // x % 10 is negative when x < 0
            x /= 10;
        }
        if (rev > Integer.MAX_VALUE || rev < Integer.MIN_VALUE) return 0;
        return (int) rev;
    }

    public static void main(String[] args) {
        System.out.println(reverse(123));          // 321
        System.out.println(reverse(-120));         // -21
        System.out.println(reverse(0));            // 0
        System.out.println(reverse(1534236469));   // 0
    }
}`,
      explanation: `**Digit extraction** uses the two integer operations that every Java developer must know:
\`x % 10\` gives the last digit (negative when \`x\` is negative, which is exactly what we
want), and \`x /= 10\` truncates the last digit. Repeating until \`x == 0\` peels all digits
in reverse order.

**Overflow detection** is the key insight. Accumulating into a \`long\` lets us represent
any reversed 32-bit integer without wrapping — the largest possible reversal is
\`9646324351\` (reversing \`Integer.MIN_VALUE\`'s magnitude), which fits in a \`long\` but not
an \`int\`. A single range check after the loop is all that is needed.

**Why not use a String?** Converting to a string hides the arithmetic mechanics — the
integer-division loop is the pattern you reach for in dozens of other problems (digit sum,
palindrome number, to-arbitrary-base conversion). Practising it here makes it automatic.

**Trailing-zero handling** is free: \`reverse(-120)\` → digits extracted are \`0, 2, 1\`
→ \`rev\` accumulates to \`-21\`. The leading zero on the reversed sequence is simply never
appended as a meaningful digit because \`rev * 10 + 0\` leaves \`rev\` at \`0\` at that step,
then the next non-zero digit pushes it to the correct value.`,
    },
    {
      id: 'safe-parse-int',
      title: 'Overflow-safe integer parser',
      difficulty: 'core',
      prompt: `Implement \`static int parse(String s)\` that converts a decimal string to an \`int\`
**without** calling \`Integer.parseInt\`/\`valueOf\`. Requirements:

- Accept an optional leading \`+\` or \`-\`.
- Reject \`null\`, empty, whitespace-only, and any string with non-digit characters (throw \`NumberFormatException\`).
- **Detect overflow**: a value outside \`[-2147483648, 2147483647]\` must throw, not wrap.

The overflow handling is the whole point — accumulating into an \`int\` would silently
wrap, so you need a strategy that catches it.`,
      starter: `public class SafeParse {

    static int parse(String s) {
        // 1. validate null/empty
        // 2. read optional sign
        // 3. accumulate digits, checking for overflow BEFORE it happens
        // 4. apply sign
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(parse("2147483647"));   // 2147483647
        System.out.println(parse("-2147483648"));  // -2147483648
        try { parse("2147483648"); }                // should throw (overflow)
        catch (NumberFormatException e) { System.out.println("overflow caught"); }
        try { parse("12a3"); }                      // should throw
        catch (NumberFormatException e) { System.out.println("bad char caught"); }
    }
}`,
      hints: [
        'Accumulate into a long and check against Integer.MAX_VALUE / MIN_VALUE after each step — simplest correct approach.',
        'If you want to stay in int: before result = result * 10 + digit, check result > (Integer.MAX_VALUE - digit) / 10.',
        'Remember the asymmetry: MIN_VALUE (-2147483648) has a larger magnitude than MAX_VALUE. Accumulating as a negative number (like the JDK does) handles this cleanly.',
      ],
      solution: `public class SafeParse {

    static int parse(String s) {
        if (s == null || s.isEmpty()) throw new NumberFormatException("empty");

        int i = 0;
        boolean negative = false;
        char first = s.charAt(0);
        if (first == '+' || first == '-') {
            negative = first == '-';
            i = 1;
            if (s.length() == 1) throw new NumberFormatException("sign only");
        }

        long result = 0;
        for (; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c < '0' || c > '9') throw new NumberFormatException("bad char: " + c);
            result = result * 10 + (c - '0');
            // -result is the magnitude when negative; bound each side correctly
            if (!negative && result > Integer.MAX_VALUE)
                throw new NumberFormatException("overflow");
            if (negative && -result < Integer.MIN_VALUE)
                throw new NumberFormatException("underflow");
        }
        return (int) (negative ? -result : result);
    }

    public static void main(String[] args) {
        System.out.println(parse("2147483647"));
        System.out.println(parse("-2147483648"));
        try { parse("2147483648"); } catch (NumberFormatException e) { System.out.println("overflow caught"); }
        try { parse("12a3"); }       catch (NumberFormatException e) { System.out.println("bad char caught"); }
    }
}`,
      explanation: `Accumulating into a \`long\` lets us compare against the \`int\` bounds *before* casting,
so overflow is caught instead of silently wrapping. The sign asymmetry is the subtle part:
\`Integer.MIN_VALUE\` is \`-2147483648\` but \`MAX_VALUE\` is only \`2147483647\`, so \`-MIN_VALUE\`
doesn't fit in an \`int\`. Checking \`-result < Integer.MIN_VALUE\` on the negative branch
handles \`"-2147483648"\` correctly. The production JDK accumulates as a *negative* number
specifically to avoid needing a wider type — a worthwhile variation to implement once you
have this working. Char-by-char validation with \`c - '0'\` (digit value via ASCII) rejects
anything non-numeric.`,
    },
    {
      id: 'rotate-in-place',
      title: 'Rotate an array in place',
      difficulty: 'core',
      prompt: `Implement \`static void rotate(int[] a, int k)\` that rotates the array **right** by
\`k\` positions, **in O(n) time and O(1) extra space** (no second array).

- \`{1,2,3,4,5}\` rotated by 2 -> \`{4,5,1,2,3}\`.
- Handle \`k\` larger than the length (e.g. \`k = 7\` on length 5 == \`k = 2\`).
- Handle negative \`k\` (rotate left).

The trick that achieves O(1) space is elegant and a common interview follow-up.`,
      starter: `import java.util.Arrays;

public class Rotate {

    static void reverse(int[] a, int from, int to) {
        // reverse a[from..to] inclusive
    }

    static void rotate(int[] a, int k) {
        // normalise k into [0, n), then use three reversals
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4, 5};
        rotate(a, 2);
        System.out.println(Arrays.toString(a));  // [4, 5, 1, 2, 3]

        int[] b = {1, 2, 3, 4, 5};
        rotate(b, -1);
        System.out.println(Arrays.toString(b));  // [2, 3, 4, 5, 1]
    }
}`,
      hints: [
        'Normalise k first: k = ((k % n) + n) % n handles k > n AND negative k in one expression.',
        'The reversal trick: reverse the whole array, then reverse the first k elements, then reverse the remaining n-k.',
        'Edge cases: n == 0 or k == 0 after normalisation should be a no-op.',
      ],
      solution: `import java.util.Arrays;

public class Rotate {

    static void reverse(int[] a, int from, int to) {
        while (from < to) {
            int t = a[from];
            a[from] = a[to];
            a[to] = t;
            from++;
            to--;
        }
    }

    static void rotate(int[] a, int k) {
        int n = a.length;
        if (n == 0) return;
        k = ((k % n) + n) % n;   // normalise: handles k > n and negative k
        if (k == 0) return;
        reverse(a, 0, n - 1);    // reverse everything
        reverse(a, 0, k - 1);    // reverse the first k
        reverse(a, k, n - 1);    // reverse the rest
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4, 5};
        rotate(a, 2);
        System.out.println(Arrays.toString(a));

        int[] b = {1, 2, 3, 4, 5};
        rotate(b, -1);
        System.out.println(Arrays.toString(b));
    }
}`,
      explanation: `The reversal trick is the canonical O(1)-space rotation. Reversing the entire array puts
the last \`k\` elements at the front but in reverse order; reversing each of the two
segments (\`[0, k)\` and \`[k, n)\`) restores their internal order, leaving a correct rotation.
The normalisation \`((k % n) + n) % n\` is the line interviewers look for: \`k % n\` collapses
multiples of the length, adding \`n\` and taking \`% n\` again maps negative \`k\` (rotate left)
into the equivalent positive rotation. Each element is touched a constant number of times,
so it's O(n) time with no allocation.`,
    },
    {
      id: 'spiral-matrix',
      title: 'Spiral matrix traversal',
      difficulty: 'challenge',
      prompt: `Given an \`m × n\` \`int[][]\`, return a 1D \`int[]\` of its elements in **spiral order**:
left across the top row, down the right column, left across the bottom, up the left, then
inward.

~~~text
1  2  3        ->  1 2 3 6 9 8 7 4 5
4  5  6
7  8  9
~~~

It must work for non-square and degenerate shapes: a single row, a single column, and an
empty matrix. The bookkeeping at the boundaries is what makes this a real exercise — get
the termination conditions right so you don't double-visit the middle row/column.`,
      starter: `import java.util.Arrays;

public class Spiral {

    static int[] spiral(int[][] m) {
        // maintain four shrinking boundaries: top, bottom, left, right
        // walk each edge, then move the boundary inward; stop when they cross
        return new int[0];
    }

    public static void main(String[] args) {
        int[][] m = {
            {1, 2, 3, 4},
            {5, 6, 7, 8},
            {9, 10, 11, 12}
        };
        System.out.println(Arrays.toString(spiral(m)));
        // [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]
    }
}`,
      hints: [
        'Track top, bottom, left, right boundaries. Each full loop: go right along top, down right, then conditionally left along bottom and up left.',
        'After traversing the top row do top++; after the right column do right--, and so on. The loop continues while top <= bottom AND left <= right.',
        'The guard that prevents double-visiting: only traverse the bottom row if top <= bottom AFTER the increment, and only the left column if left <= right.',
      ],
      solution: `import java.util.Arrays;

public class Spiral {

    static int[] spiral(int[][] m) {
        if (m.length == 0 || m[0].length == 0) return new int[0];
        int rows = m.length, cols = m[0].length;
        int[] out = new int[rows * cols];
        int idx = 0;
        int top = 0, bottom = rows - 1, left = 0, right = cols - 1;

        while (top <= bottom && left <= right) {
            for (int c = left; c <= right; c++) out[idx++] = m[top][c];   // top row, left->right
            top++;
            for (int r = top; r <= bottom; r++) out[idx++] = m[r][right]; // right col, top->bottom
            right--;
            if (top <= bottom) {
                for (int c = right; c >= left; c--) out[idx++] = m[bottom][c]; // bottom, right->left
                bottom--;
            }
            if (left <= right) {
                for (int r = bottom; r >= top; r--) out[idx++] = m[r][left];   // left col, bottom->top
                left++;
            }
        }
        return out;
    }

    public static void main(String[] args) {
        int[][] m = {
            {1, 2, 3, 4},
            {5, 6, 7, 8},
            {9, 10, 11, 12}
        };
        System.out.println(Arrays.toString(spiral(m)));
    }
}`,
      explanation: `The four-boundary technique walks one edge at a time and shrinks that boundary inward.
The two \`if\` guards are essential and the most-missed part: after walking the top row and
right column, a matrix that has collapsed to a single remaining row (or column) must not
walk the bottom/left edges again, or you'd revisit elements. Checking \`top <= bottom\`
before the bottom pass and \`left <= right\` before the left pass prevents that
double-counting. The loop terminates when the boundaries cross. This generalises cleanly to
any \`m × n\`, including single rows/columns and the empty matrix handled up front.`,
    },
  ],
  takeaways: [
    'Integer arithmetic overflows **silently** — use `low + (high - low) / 2` for midpoints and `Math.addExact` to fail loudly.',
    'Never use `==` on `double` (floating-point inexactness) or on boxed `Integer` (the -128..127 cache makes `==` lie) — use epsilon / `.equals()`.',
    'Overload resolution is compile-time and prefers widening > boxing > varargs; overriding is the runtime counterpart.',
    'Java is **pass-by-value** — you can mutate an object through its reference, but reassigning a parameter (or `swap`) never affects the caller.',
    'Arrays are **covariant** (`Object[] = String[]` compiles) and can throw `ArrayStoreException` at runtime — generics exist partly to close this hole.',
    'Use `Arrays.equals` / `Arrays.toString` / `Arrays.copyOf`, never `==`, `toString`, or hand-rolled copy loops on arrays.',
  ],
}
