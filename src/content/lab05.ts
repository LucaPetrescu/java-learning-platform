import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab05: Lab = {
  id: 'lab-05',
  number: 5,
  title: 'Inner Classes & Strings',
  subtitle: 'Nested types, String pool gotchas, StringBuilder idioms & real string algorithms',
  estimatedHours: 6,
  concepts: [
    'static nested class',
    'inner class',
    'anonymous class',
    'local class',
    'String pool',
    'interning',
    'immutability',
    'StringBuilder',
    'sliding window',
    'Iterator pattern',
    'regex',
  ],
  overview: `You already know that \`String\` is a class and that nested classes exist. This lab
goes deeper: **why** the String pool causes \`==\` to lie, **when** an inner class silently
leaks memory, and **how** the iterator pattern maps directly onto a non-static inner class.

The exercises are pitched at mid-interview level. There is no Hello World, no FizzBuzz.
Instead you will:

- Dissect String interning and pool semantics in a predict-the-output puzzle (spot every \`==\` trap).
- Implement **longest substring without repeating characters** in O(n) with a sliding window.
- Write a **RFC-4180-compliant CSV field writer** with a \`StringBuilder\` loop, and understand exactly why \`+=\` in a loop is quadratic.
- Build a reusable \`NumberRange\` class that is \`Iterable<Integer>\` by returning a **non-static inner class** as its iterator — the textbook use-case for inner classes.

Theory is tight: read the parts you do not yet own, skim the rest.`,
  theory: [
    {
      id: 'static-vs-inner',
      heading: 'Static nested vs non-static inner: the memory trap',
      body: `Declaring a class inside another class gives you two semantically different constructs
depending on whether you include \`static\`.

**Static nested class** — logically grouped inside the outer class but fully independent.
No implicit link to any instance. Instantiate it without an outer object:

~~~java
public class Graph {
    public static class Edge {          // static nested
        final int from, to, weight;
        Edge(int from, int to, int weight) {
            this.from = from; this.to = to; this.weight = weight;
        }
    }
}
Graph.Edge e = new Graph.Edge(1, 2, 5);  // no Graph instance needed
~~~

**Non-static inner class** — every instance secretly holds a hidden reference
\`OuterClass.this\` to the outer instance that created it. This is what lets it read and
write the outer class's private fields:

~~~java
public class Counter {
    private int count = 0;

    public class Stepper {
        public void step(int n) { count += n; }   // accesses outer 'count' directly
    }

    public int value() { return count; }
}

Counter c = new Counter();
Counter.Stepper s = c.new Stepper();  // note: c.new, not new Counter.Stepper()
s.step(10);
System.out.println(c.value());        // 10
~~~

**The memory leak.** Because \`Stepper\` holds a reference to its \`Counter\`, as long as
the \`Stepper\` is reachable the \`Counter\` cannot be garbage-collected — even if no other
code holds the counter. This is particularly dangerous when inner-class instances escape
into long-lived collections (e.g. event listener lists).

Rule of thumb: **prefer static nested** unless you genuinely need the outer instance's
state. If you catch yourself writing \`OuterClass.this.field\` you probably want an inner
class; if you never reference the outer instance, make it static.`,
    },
    {
      id: 'anonymous-local',
      heading: 'Anonymous and local classes — and when lambdas win',
      body: `**Anonymous class** — declared and instantiated in one expression, no name. Classic
use: one-off \`Comparator\` or \`Runnable\` before Java 8:

~~~java
Comparator<String> byLen = new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return Integer.compare(a.length(), b.length());
    }
};
Arrays.sort(words, byLen);
~~~

When the interface has exactly one abstract method (a *functional interface*), a lambda
replaces the anonymous class completely:

~~~java
Arrays.sort(words, (a, b) -> Integer.compare(a.length(), b.length()));
~~~

Anonymous classes are still necessary when you need to: (a) override more than one method,
(b) carry state (fields) alongside the implementation, or (c) subclass an abstract class.

**Local class** — declared inside a method body, visible only there. Captures
effectively-final locals from the enclosing scope — the same rule as lambdas. Rarely seen
in modern code outside legacy codebases and embedded DSL frameworks.

~~~java
static Predicate<String> buildFilter(int maxLen) {
    class LengthCheck implements Predicate<String> {
        public boolean test(String s) { return s.length() <= maxLen; }
    }
    return new LengthCheck();
}
~~~

**Key differences at a glance:**

| | Static nested | Inner | Anonymous | Local |
|---|---|---|---|---|
| Has a name? | Yes | Yes | No | Yes |
| Needs outer instance? | No | Yes | Depends | No |
| Defined where? | class body | class body | expression | method body |
| Multiple methods? | Yes | Yes | Yes | Yes |`,
    },
    {
      id: 'string-pool',
      heading: 'String pool, interning, and why == lies',
      body: `\`String\` is **immutable**: no method on it modifies the underlying character data —
every apparent modification (e.g. \`toUpperCase\`, \`replace\`, \`substring\`) returns a **new**
\`String\` object and leaves the original untouched.

~~~java
String s = "hello";
String t = s.toUpperCase();  // new object "HELLO"; s is still "hello"
~~~

Because strings are immutable, the JVM can safely share them via the **string constant
pool**: every string *literal* is interned — if the same character sequence has already
been placed in the pool, the literal reuses that existing object.

~~~java
String a = "java";
String b = "java";           // same pool entry — same reference
System.out.println(a == b);  // true  (accidentally, both point at the pool slot)

String c = new String("java");  // forces a fresh heap object, outside the pool
System.out.println(a == c);     // false (different objects)
System.out.println(a.equals(c));// true  (same character content)
~~~

**\`intern()\`** explicitly places a string in the pool (or returns the existing pooled
copy):

~~~java
String d = new String("java").intern();
System.out.println(a == d);   // true — d is now the pooled reference
~~~

**The golden rule**: always compare string *content* with \`equals\` (or
\`equalsIgnoreCase\`), never \`==\`. The \`==\` behaviour of literals is an implementation
detail of the JVM's compile-time optimisation — code that happens to work because of it is
wrong and fragile.

**Compile-time constant folding** adds another wrinkle:

~~~java
String x = "he" + "llo";   // constant expression — the compiler folds this to "hello"
                            // and interns it at compile time
System.out.println(a == x); // true — both literals resolve to the same pool entry

String part = "hel";
String y = part + "lo";     // NOT a constant (part is a variable) — new object at runtime
System.out.println(a == y); // false
~~~

This is a favourite interview puzzle. The rule: \`+\` of two *compile-time constants*
(literals or \`static final\` strings) is folded by the compiler; \`+\` involving any
variable produces a fresh \`String\` at runtime.`,
    },
    {
      id: 'stringbuilder',
      heading: 'StringBuilder: why += in a loop is quadratic',
      body: `Because \`String\` is immutable, the expression \`result += token\` desugars to:

~~~java
result = new StringBuilder(result).append(token).toString();
~~~

In a loop over \`n\` tokens, each iteration copies the entire accumulated string into a new
buffer. The total characters copied are \`0 + 1 + 2 + … + (n-1)\` = O(n²). For 10 000
tokens this is roughly 50 million character copies before the loop finishes.

~~~java
// Anti-pattern — O(n²)
String result = "";
for (String token : tokens) {
    result += token + ",";
}

// Correct — O(n)
StringBuilder sb = new StringBuilder();
for (String token : tokens) {
    sb.append(token).append(',');
}
String result = sb.toString();
~~~

\`StringBuilder\` maintains an internal \`char[]\` that doubles when capacity is exhausted
(amortised O(1) per append). Every \`append\` returns \`this\`, so calls chain fluently.

**Common \`StringBuilder\` methods:**

~~~java
StringBuilder sb = new StringBuilder("Hello");
sb.append(", ").append(42);     // "Hello, 42"
sb.insert(5, " there");         // "Hello there, 42"
sb.delete(5, 11);               // "Hello, 42"
sb.replace(0, 5, "Bye");        // "Bye, 42"
sb.reverse();                   // "24 ,eyB"
int len = sb.length();
char c   = sb.charAt(0);
sb.deleteCharAt(0);
String s = sb.toString();       // freeze into an immutable String
~~~

> \`StringBuffer\` is the thread-safe predecessor of \`StringBuilder\`. It is identical except
> every method is \`synchronized\`. Prefer \`StringBuilder\` in single-threaded code — the
> synchronisation in \`StringBuffer\` is a needless cost in the vast majority of use cases.`,
    },
    {
      id: 'iterator-pattern',
      heading: 'Iterator and Iterable — the inner-class sweet spot',
      body: `The \`java.lang.Iterable<T>\` interface requires one method:

~~~java
public interface Iterable<T> {
    Iterator<T> iterator();
}
~~~

\`java.util.Iterator<T>\` requires two:

~~~java
public interface Iterator<T> {
    boolean hasNext();
    T next();
}
~~~

Implementing \`Iterable\` on your own class lets you use it directly in an enhanced
for-loop (\`for (T item : myObject)\`).

The iterator needs access to the data structure it is iterating over — and that is
precisely what a **non-static inner class** provides for free. The iterator holds a
reference to the outer instance and reads its fields directly:

~~~java
public class NumberRange implements Iterable<Integer> {
    private final int lo, hi;          // inclusive bounds

    public NumberRange(int lo, int hi) { this.lo = lo; this.hi = hi; }

    @Override
    public Iterator<Integer> iterator() {
        return new RangeIterator();
    }

    private class RangeIterator implements Iterator<Integer> {
        private int current = lo;       // captures the outer 'lo' via OuterClass.this

        @Override
        public boolean hasNext() { return current <= hi; }

        @Override
        public Integer next() {
            if (!hasNext()) throw new java.util.NoSuchElementException();
            return current++;
        }
    }
}

// Usage:
for (int n : new NumberRange(3, 7)) {
    System.out.print(n + " ");  // 3 4 5 6 7
}
~~~

Each call to \`iterator()\` creates a **fresh \`RangeIterator\`** with its own \`current\`
counter starting at \`lo\` — so nested loops (two iterators on the same range) work
correctly because they are independent objects. This is the textbook non-static inner
class use-case: tight coupling to the parent's state, with each instance needing its own
cursor.`,
    },
    {
      id: 'sliding-window',
      heading: 'Sliding-window technique for substring problems',
      body: `A **sliding window** maintains a contiguous sub-sequence of a string (or array) using
two pointers — \`left\` and \`right\` — that both move forward. The window expands by
advancing \`right\` and contracts by advancing \`left\`. Because each pointer moves at most
\`n\` steps, the total work is O(n) even though a naïve double-loop would be O(n²).

The pattern for "longest substring with property P":

~~~java
int left = 0, best = 0;
// auxiliary structure tracking what's inside the window
for (int right = 0; right < s.length(); right++) {
    // 1. Extend window to include s[right]
    // 2. While the window violates P: shrink from the left
    //    left++;  // + remove s[left-1] from the auxiliary structure
    // 3. Update best = Math.max(best, right - left + 1)
}
~~~

**Example — longest substring without repeating characters:**

~~~java
import java.util.HashMap;
import java.util.Map;

static int lengthOfLongestUniqueSubstring(String s) {
    Map<Character, Integer> lastSeen = new HashMap<>();
    int left = 0, best = 0;
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        if (lastSeen.containsKey(c) && lastSeen.get(c) >= left) {
            left = lastSeen.get(c) + 1;  // jump left past the duplicate
        }
        lastSeen.put(c, right);
        best = Math.max(best, right - left + 1);
    }
    return best;
}
// "abcabcbb" -> 3 ("abc")
// "bbbbb"    -> 1 ("b")
// "pwwkew"   -> 3 ("wke")
~~~

The \`lastSeen.get(c) >= left\` guard is critical: if the previous occurrence of \`c\` was
already outside the current window (i.e. to the left of \`left\`), it is harmless and we
should not shrink the window. Without the guard, the left pointer could move backwards,
breaking the invariant.`,
    },
    {
      id: 'regex-essentials',
      heading: 'Regex essentials and the double-backslash rule',
      body: `Java exposes regex through \`String\` convenience methods (\`matches\`, \`split\`,
\`replaceAll\`) for simple cases, and through \`java.util.regex.Pattern\` / \`Matcher\` for
repeated or grouped matching.

~~~java
// matches() — tests the WHOLE string against the pattern
"hello123".matches("[a-z]+\\\\d+");   // true
"hello123".matches("[a-z]+");         // false — trailing digits don't match

// split() — delimiter is a regex
"one,,two, three".split(",\\\\s*");   // ["one", "", "two", "three"]
                                       // note: "" between two commas

// replaceAll() — all matches replaced
"abc123def456".replaceAll("\\\\d+", "#");  // "abc#def#"
~~~

**The double-backslash rule.** A Java string literal uses \`\\\\\` to produce a single
backslash character. Regex also uses \`\\\\\` as an escape prefix (e.g. \`\\\\d\` = digit).
So to get the regex \`\\\\d\` into a Java string you write four characters in source:
\`"\\\\\\\\d"\` is wrong (too many); \`"\\\\d"\` produces the one-character sequence \`\\d\` — correct.

| What you want the regex engine to see | Java string literal |
|---|---|
| \`\\d\` (digit) | \`"\\\\d"\` |
| \`\\s\` (whitespace) | \`"\\\\s"\` |
| \`\\.\` (literal dot) | \`"\\\\."\` |
| \`[^a-z]\` (not a-z) | \`"[^a-z]"\` (no extra escaping needed) |

**\`Pattern\` for repeated matching:**

~~~java
import java.util.regex.*;

Pattern p = Pattern.compile("\\\\b\\\\w+@\\\\w+\\\\.\\\\w+\\\\b");
Matcher m = p.matcher("contact admin@example.com or ops@corp.org");
while (m.find()) {
    System.out.println(m.group());  // admin@example.com, then ops@corp.org
}
~~~

Compiling the \`Pattern\` once and reusing the \`Matcher\` is much cheaper than calling
\`String.matches\` in a loop, which recompiles the pattern on every call.`,
    },
  ],
  exercises: [
    {
      id: 'first-non-repeating',
      title: 'First non-repeating character',
      difficulty: 'warmup',
      prompt: `Implement \`static char firstNonRepeating(String s)\` that returns the **first character
that appears exactly once** in the string, scanning left-to-right.

Return the **null character** \`'\\0'\` (sentinel) if no such character exists or if the
input is \`null\` / empty.

Examples:
~~~text
"aabbcdd"   ->  'c'    (c appears once; a, b, d all repeat)
"aabb"      ->  '\\0'   (every character repeats)
"z"         ->  'z'    (single character — trivially unique)
"swiss"     ->  'w'    (s appears 3 times, i once, w once — w comes first)
""          ->  '\\0'
~~~

**Constraints:**
- O(n) time — exactly **two** passes over the string: one to build a frequency count,
  one to find the first character whose count is 1.
- O(1) extra space — use an \`int[]\` array indexed by \`char\` value (ASCII fits in 128
  entries; the array size is fixed regardless of input length).
- Do **not** use \`HashMap\`, \`LinkedHashMap\`, or any collection class.
- Do **not** call \`indexOf\` / \`lastIndexOf\` in a loop (that would be O(n²)).`,
      starter: `public class FirstNonRepeating {

    /**
     * Returns the first character in s that appears exactly once,
     * or '\\0' if none exists (or s is null/empty).
     *
     * Two-pass approach:
     *   Pass 1 — build a frequency table (int[128], indexed by char value).
     *   Pass 2 — scan s left-to-right and return the first char whose count == 1.
     */
    static char firstNonRepeating(String s) {
        // TODO 1: handle null / empty input — return '\\0' immediately.

        // TODO 2: allocate int[] freq = new int[128]; (covers all ASCII chars)

        // TODO 3: pass 1 — iterate over s with s.charAt(i) and increment freq[c].

        // TODO 4: pass 2 — iterate over s again; return s.charAt(i) when freq[c] == 1.

        // TODO 5: no unique char found — return '\\0'.
        return '\\0';
    }

    public static void main(String[] args) {
        System.out.println(firstNonRepeating("aabbcdd")); // c
        System.out.println(firstNonRepeating("aabb"));    // (empty — null char)
        System.out.println(firstNonRepeating("z"));       // z
        System.out.println(firstNonRepeating("swiss"));   // w
        System.out.println(firstNonRepeating(""));        // (empty — null char)
    }
}`,
      hints: [
        'Pass 1: \`for (int i = 0; i < s.length(); i++) { freq[s.charAt(i)]++; }\` — \`char\` widens to \`int\` automatically, giving you the ASCII index.',
        'Pass 2: iterate s again in the same order and check \`freq[s.charAt(i)] == 1\`. The first character that satisfies this is your answer — return it immediately.',
        'An \`int[128]\` is zero-initialised by default in Java, so you do not need to fill it. All entries start at 0 before pass 1.',
      ],
      solution: `public class FirstNonRepeating {

    static char firstNonRepeating(String s) {
        if (s == null || s.isEmpty()) return '\\0';

        // O(1) space: fixed-size array covers the full ASCII range.
        // Java zero-initialises int[] by default — no Arrays.fill needed.
        int[] freq = new int[128];

        // Pass 1: count occurrences of every character.
        for (int i = 0; i < s.length(); i++) {
            freq[s.charAt(i)]++;
        }

        // Pass 2: find the leftmost character whose count is exactly 1.
        for (int i = 0; i < s.length(); i++) {
            if (freq[s.charAt(i)] == 1) return s.charAt(i);
        }

        return '\\0'; // sentinel: no unique character found
    }

    public static void main(String[] args) {
        System.out.println(firstNonRepeating("aabbcdd")); // c
        System.out.println(firstNonRepeating("aabb"));    // (null char \\0)
        System.out.println(firstNonRepeating("z"));       // z
        System.out.println(firstNonRepeating("swiss"));   // w
        System.out.println(firstNonRepeating(""));        // (null char \\0)
    }
}`,
      explanation: `**Why two passes instead of one.** A single pass cannot determine whether a character
is unique until the *entire* string has been scanned — the first \`'a'\` might look unique
until a second \`'a'\` appears later. Two passes let you separate "count everything" from
"find the answer", keeping the logic simple and the complexity O(n).

**Why \`int[128]\` and not \`HashMap\`.** The ASCII character set has exactly 128 code
points (0–127). An \`int[128]\` is allocated once, zero-initialised by the JVM, and indexed
in O(1) with no hashing, boxing, or bucket collisions. Its size is constant regardless of
input length, so the space complexity is O(1). A \`HashMap<Character, Integer>\` would also
work but incurs autoboxing of each \`char\` to \`Character\`, hash computation, and potential
rehashing — all avoidable overhead here.

**The \`char\`-as-index trick.** Java \`char\` is an unsigned 16-bit integer. In the
expression \`freq[s.charAt(i)]++\`, the compiler silently widens the \`char\` to \`int\`,
giving you the ASCII code point as the array index. For the letter \`'a'\` that is 97, for
\`'z'\` it is 122 — all safely within \`[0, 127]\`.

**Sentinel return value.** Returning \`'\\0'\` (the null character, code point 0) instead of
\`-1\` or throwing an exception keeps the return type as \`char\`. Callers can check
\`result != '\\0'\` before using the result. This is a common idiom for \`char\`-returning
methods when a "not found" state is needed without changing the signature.

**Complexity.** Pass 1: O(n). Pass 2: O(n) worst case (no unique char). Total: O(2n) =
O(n). Space: O(128) = O(1).`,
    },
    {
      id: 'longest-unique-substring',
      title: 'Longest substring without repeating characters',
      difficulty: 'core',
      prompt: `Implement \`static int lengthOfLongestUnique(String s)\` that returns the **length** of
the longest contiguous substring that contains no repeated characters.

Examples:
~~~text
"abcabcbb"  ->  3   ("abc")
"bbbbb"     ->  1   ("b")
"pwwkew"    ->  3   ("wke")
""          ->  0
"abcde"     ->  5   (whole string)
~~~

**Constraints:**
- O(n) time, O(1) extra space in terms of character set size (at most 128 ASCII characters,
  so a fixed-size array counts as O(1)).
- Do **not** use a double loop or \`substring\` in the hot path.

The intended technique is a **sliding window** with two pointers. The theory section above
has the pattern — but the guard condition that prevents the left pointer from moving
backwards is the part most people get wrong on their first attempt.`,
      starter: `import java.util.HashMap;
import java.util.Map;

public class LongestUnique {

    static int lengthOfLongestUnique(String s) {
        // Use a sliding window [left, right].
        // Track the last-seen index of each character.
        // When s.charAt(right) was already seen inside the current window,
        // jump left to lastSeen[c] + 1 (don't just left++ or you may miss jumps).
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(lengthOfLongestUnique("abcabcbb")); // 3
        System.out.println(lengthOfLongestUnique("bbbbb"));    // 1
        System.out.println(lengthOfLongestUnique("pwwkew"));   // 3
        System.out.println(lengthOfLongestUnique(""));         // 0
        System.out.println(lengthOfLongestUnique("abcde"));    // 5
    }
}`,
      hints: [
        'Keep a Map<Character, Integer> (or int[128] array) that stores the most recent index where each character was seen.',
        'When you encounter s.charAt(right) == c and lastSeen[c] >= left, the duplicate is inside the window: set left = lastSeen[c] + 1. This jumps left past the old occurrence in one step — faster than incrementing one at a time.',
        'The >= left guard is essential: if the previous occurrence of c is already to the left of the window (lastSeen[c] < left), it is not a duplicate in the current window, so you must NOT move left.',
        'Window length after processing right: right - left + 1. Update best with Math.max(best, right - left + 1) on every iteration.',
      ],
      solution: `import java.util.HashMap;
import java.util.Map;

public class LongestUnique {

    static int lengthOfLongestUnique(String s) {
        if (s == null || s.isEmpty()) return 0;

        // int[128] is O(1) space for ASCII; use a Map for full Unicode
        int[] lastSeen = new int[128];
        java.util.Arrays.fill(lastSeen, -1);

        int left = 0, best = 0;
        for (int right = 0; right < s.length(); right++) {
            int c = s.charAt(right);
            // Only shrink if the previous occurrence is INSIDE the current window
            if (lastSeen[c] >= left) {
                left = lastSeen[c] + 1;
            }
            lastSeen[c] = right;
            best = Math.max(best, right - left + 1);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(lengthOfLongestUnique("abcabcbb")); // 3
        System.out.println(lengthOfLongestUnique("bbbbb"));    // 1
        System.out.println(lengthOfLongestUnique("pwwkew"));   // 3
        System.out.println(lengthOfLongestUnique(""));         // 0
        System.out.println(lengthOfLongestUnique("abcde"));    // 5
    }
}`,
      explanation: `**Why the sliding window is O(n).** Both \`left\` and \`right\` only ever move forward.
Each of the \`n\` characters is added to the window exactly once (when \`right\` visits it)
and removed at most once (when \`left\` jumps past it). Total operations: O(2n) = O(n).

**The \`>= left\` guard.** Consider \`"abba"\` with \`right = 3\` (second \`a\`).
\`lastSeen['a'] = 0\`. At this point \`left = 2\` (set when the second \`b\` forced a jump).
The previous \`a\` is at index 0, which is *outside* the current window \`[2, 3]\`. Without
the guard, we would incorrectly set \`left = 1\`, moving it *backwards* from 2. The guard
\`lastSeen[c] >= left\` correctly skips the update, leaving \`left = 2\` and giving window
length \`3 - 2 + 1 = 2\`.

**O(1) space.** An \`int[128]\` indexed by the \`char\` value holds the last-seen position for
every ASCII character in a fixed-size array — constant space regardless of input length.
For full Unicode (\`char\` values 0-65535) you would use an \`int[65536]\` array or a
\`HashMap<Character, Integer>\`; the algorithm is identical.`,
    },
    {
      id: 'csv-field-writer',
      title: 'RFC-4180 CSV field writer with StringBuilder',
      difficulty: 'core',
      prompt: `Implement \`static String toCsvRow(String... fields)\` that serialises an arbitrary
number of string fields into a single RFC-4180-compliant CSV row.

**RFC-4180 quoting rules (the ones that matter here):**
1. If a field contains a comma, a double-quote, or a newline, it must be enclosed in
   double-quotes.
2. Any double-quote character *inside* an already-quoted field must be escaped by doubling
   it: \`"\` becomes \`""\`.
3. Fields that need no quoting are written as-is.

Expected outputs:
~~~text
toCsvRow("Alice", "30", "London")          ->  Alice,30,London
toCsvRow("Bob", "say \\"hi\\"", "NYC")     ->  Bob,"say ""hi""",NYC
toCsvRow("Ann", "Paris, France", "28")     ->  Ann,"Paris, France",28
toCsvRow("", "has\\nnewline", "x")         ->  ,"has\\nnewline",x
~~~

**Hard requirement:** the row must be assembled in a **single \`StringBuilder\`** — no \`+=\`
on \`String\` anywhere inside the method, no \`String.format\` for concatenation. The comment
in your submission must name the complexity of the naive \`+=\` approach and explain why
\`StringBuilder\` is better.

**Hint on quoting detection:** a field needs quoting if it contains \`','\`, \`'"'\`, or
\`'\\n'\`. Use \`String.indexOf\` (returns \`-1\` if absent) or \`String.contains\`.`,
      starter: `public class CsvWriter {

    /**
     * Serialises fields into one RFC-4180 CSV row.
     *
     * Naive += approach complexity: O(?) — fill in the blank in your comment.
     * StringBuilder approach complexity: O(n) total characters across all fields.
     */
    static String toCsvRow(String... fields) {
        StringBuilder sb = new StringBuilder();
        // For each field:
        //   1. Append a comma separator (but not before the first field)
        //   2. Determine whether the field needs quoting
        //   3. If yes: open-quote, escape internal quotes by replacing " with "",
        //              append the escaped text, close-quote
        //   4. If no:  append the field as-is
        return sb.toString();
    }

    public static void main(String[] args) {
        System.out.println(toCsvRow("Alice", "30", "London"));
        System.out.println(toCsvRow("Bob", "say \\"hi\\"", "NYC"));
        System.out.println(toCsvRow("Ann", "Paris, France", "28"));
        System.out.println(toCsvRow("", "has\\nnewline", "x"));
    }
}`,
      hints: [
        'Detect quoting need: boolean needsQuotes = f.contains(",") || f.contains("\\\"") || f.contains("\\n"); — all three RFC-4180 trigger characters.',
        'Escape internal double-quotes before appending: sb.append(f.replace("\\\"", "\\\"\\\"")); — this uses String.replace which returns a new String, but that is acceptable because it is a single allocation per field, not an O(n²) loop.',
        'The naive += approach is O(k * totalChars) where k is the number of fields: each += copies the entire row so far into a new buffer. StringBuilder amortises to O(totalChars) with a doubling strategy.',
      ],
      solution: `public class CsvWriter {

    /**
     * Naive += approach: O(k * totalChars) — each iteration of the field loop copies
     * the entire accumulated row into a new String, so total allocations grow quadratically
     * with the number of fields times average field length.
     *
     * StringBuilder approach: O(totalChars) — append is amortised O(1) per character;
     * the internal buffer doubles when capacity is exhausted, so total copy work is O(n).
     */
    static String toCsvRow(String... fields) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) sb.append(',');
            String f = fields[i];
            boolean needsQuotes = f.contains(",") || f.contains("\"") || f.contains("\\n");
            if (needsQuotes) {
                sb.append('"');
                // Escape every " as "" (RFC-4180 section 2.7)
                // String.replace returns a new String, but it's a single O(n) allocation,
                // not an O(n^2) loop — acceptable here.
                sb.append(f.replace("\"", "\"\""));
                sb.append('"');
            } else {
                sb.append(f);
            }
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        // Alice,30,London
        System.out.println(toCsvRow("Alice", "30", "London"));
        // Bob,"say ""hi""",NYC
        System.out.println(toCsvRow("Bob", "say \\"hi\\"", "NYC"));
        // Ann,"Paris, France",28
        System.out.println(toCsvRow("Ann", "Paris, France", "28"));
        // ,"has\\nnewline",x
        System.out.println(toCsvRow("", "has\\nnewline", "x"));
    }
}`,
      explanation: `**The quadratic cost of \`+=\`.**  Suppose you have \`k\` fields of total length \`n\`.
Each \`result += nextField\` allocates a new \`String\` buffer whose size is the current
accumulated length plus the new field's length. After field \`i\` the row has roughly
\`n * i/k\` characters. Summing over all fields: \`(n/k) + (2n/k) + … + n\` = O(k * n/k * k/2) =
O(n * k)\`. For a row with 200 fields of average 20 chars that is 200 * 4000 = 800 000
character copies rather than 4000 total.

**Why \`String.replace\` inside the quoting branch is fine.** It is a single O(m) operation
on one field of length \`m\`, not inside a loop that grows — there is no accumulating
quadratic here.

**Empty field.** An empty string \`""\` contains no comma, quote, or newline, so it emits
nothing between its surrounding commas: \`..., ,...\`. That is correct RFC-4180.

**The single-\`StringBuilder\` rule enforces the discipline.** In production code the JIT
often optimises simple \`+\` chains involving only literals and a few variables, but it
*cannot* optimise \`+=\` in a loop whose body it does not know the iteration count of at
compile time. Reaching for \`StringBuilder\` in any loop that builds a string is a habit
worth building early.`,
    },
    {
      id: 'iterable-range',
      title: 'Iterable NumberRange with a non-static inner Iterator',
      difficulty: 'challenge',
      prompt: `Implement \`NumberRange\`, a class representing an inclusive integer range \`[lo, hi]\`
that is **\`Iterable<Integer>\`**. Its \`iterator()\` method must return a **non-static inner
class** (not a lambda, not an anonymous class, not a static nested class) that implements
\`Iterator<Integer>\`.

**Requirements:**

1. \`NumberRange(int lo, int hi)\` — constructor; throw \`IllegalArgumentException\` if \`lo > hi\`.
2. \`iterator()\` returns a fresh \`RangeIterator\` (inner class) each time it is called.
3. \`RangeIterator\` must not duplicate the \`lo\`/\`hi\` fields — it reads them directly from
   the enclosing \`NumberRange\` instance via the implicit outer reference.
4. \`next()\` must throw \`java.util.NoSuchElementException\` when the iterator is exhausted.
5. Two independent iterators on the same \`NumberRange\` must work concurrently in nested
   for-each loops (each has its own \`current\` cursor).
6. Add a \`size()\` method that returns the count of integers in the range (\`hi - lo + 1\`).

Demonstrate with:

~~~java
NumberRange r = new NumberRange(1, 5);
for (int x : r) {
    for (int y : r) {
        System.out.print("(" + x + "," + y + ") ");
    }
    System.out.println();
}
~~~

Expected output — a 5×5 grid of pairs:
~~~text
(1,1) (1,2) (1,3) (1,4) (1,5)
(2,1) (2,2) (2,3) (2,4) (2,5)
(3,1) (3,2) (3,3) (3,4) (3,5)
(4,1) (4,2) (4,3) (4,4) (4,5)
(5,1) (5,2) (5,3) (5,4) (5,5)
~~~`,
      starter: `import java.util.Iterator;
import java.util.NoSuchElementException;

public class NumberRange implements Iterable<Integer> {

    private final int lo;
    private final int hi;

    public NumberRange(int lo, int hi) {
        if (lo > hi) throw new IllegalArgumentException("lo must be <= hi");
        this.lo = lo;
        this.hi = hi;
    }

    public int size() {
        return hi - lo + 1;
    }

    @Override
    public Iterator<Integer> iterator() {
        // Return a new RangeIterator — it will pick up 'lo' and 'hi'
        // from the enclosing NumberRange via the hidden outer reference.
        return new RangeIterator();
    }

    // TODO: declare RangeIterator as a private non-static inner class here.
    // It needs one field: private int current;
    // Initialise current = lo  (access the outer 'lo' directly).
    // hasNext(): current <= hi
    // next(): guard with hasNext(), then return current++

    public static void main(String[] args) {
        NumberRange r = new NumberRange(1, 5);

        // Nested loops — both iterators must be independent
        for (int x : r) {
            for (int y : r) {
                System.out.print("(" + x + "," + y + ") ");
            }
            System.out.println();
        }

        // size()
        System.out.println("size = " + r.size()); // 5
    }
}`,
      hints: [
        'Declare the inner class without the static keyword: private class RangeIterator implements Iterator<Integer> { ... }. It automatically holds a reference to the enclosing NumberRange instance.',
        'Initialise the cursor as private int current = lo; — this refers to the outer field NumberRange.this.lo via the hidden reference. You do not need to pass lo as a constructor argument.',
        'In next(), check hasNext() first and throw new NoSuchElementException() if the iterator is exhausted. Then return current++ (post-increment: returns the current value and then increments).',
        'Each call to iterator() calls new RangeIterator(), which creates a fresh object with its own current field. That is why two nested for-each loops on the same NumberRange work independently.',
      ],
      solution: `import java.util.Iterator;
import java.util.NoSuchElementException;

public class NumberRange implements Iterable<Integer> {

    private final int lo;
    private final int hi;

    public NumberRange(int lo, int hi) {
        if (lo > hi) throw new IllegalArgumentException("lo must be <= hi");
        this.lo = lo;
        this.hi = hi;
    }

    public int size() {
        return hi - lo + 1;
    }

    @Override
    public Iterator<Integer> iterator() {
        return new RangeIterator();
    }

    // Non-static inner class: each instance implicitly holds a reference to
    // the enclosing NumberRange, giving direct access to lo and hi.
    private class RangeIterator implements Iterator<Integer> {

        private int current = lo;    // reads 'lo' from the enclosing NumberRange

        @Override
        public boolean hasNext() {
            return current <= hi;    // reads 'hi' from the enclosing NumberRange
        }

        @Override
        public Integer next() {
            if (!hasNext()) throw new NoSuchElementException(
                "NumberRange exhausted at " + current);
            return current++;        // post-increment: return current, then advance
        }
    }

    public static void main(String[] args) {
        NumberRange r = new NumberRange(1, 5);

        for (int x : r) {
            for (int y : r) {
                System.out.print("(" + x + "," + y + ") ");
            }
            System.out.println();
        }

        System.out.println("size = " + r.size());
    }
}`,
      explanation: `**Why a non-static inner class is the right tool here.**

The iterator needs to know the enclosing range's \`lo\` and \`hi\`. You could pass them in
via a constructor parameter, but then \`RangeIterator\` would be carrying a copy of data
that the parent already owns — redundant coupling. A non-static inner class solves this
cleanly: \`current = lo\` and \`current <= hi\` access the outer \`NumberRange.this.lo\` and
\`NumberRange.this.hi\` through the hidden reference that every inner-class instance holds.

**Why each for-each loop gets an independent iterator.** Java's enhanced for-loop
desugars to:

~~~java
Iterator<Integer> _it = r.iterator();
while (_it.hasNext()) { int y = _it.next(); ... }
~~~

Every call to \`r.iterator()\` executes \`new RangeIterator()\`, allocating a fresh object
with its own \`current\` field starting at \`lo\`. The outer and inner loops therefore hold
*different* \`RangeIterator\` instances with independent cursors — nested iteration works
correctly.

**The \`NoSuchElementException\` contract.** The \`Iterator\` contract in the JDK specifies
that \`next()\` must throw \`NoSuchElementException\` if there are no more elements — not
return \`null\`, not silently return a default. This makes it safe to call \`next()\` inside
a \`try/catch\` without a prior \`hasNext()\` check (though checking first is the normal
idiom).`,
    },
  ],
  takeaways: [
    'A **static nested class** has no hidden outer reference — prefer it unless you genuinely need to read the enclosing instance\'s private state.',
    '**Non-static inner classes** hold a hidden \`OuterClass.this\` reference; if the inner object outlives the outer one (e.g. stored in a list) it prevents garbage collection — a subtle memory leak.',
    'String \`==\` compares *references*, not content. Literals and compile-time constant expressions share pool entries; \`new String(...)\` always creates a fresh object. **Always use \`equals\`** in production code.',
    'Concatenating strings with \`+=\` inside a loop is O(n²) in total character copies. **Use \`StringBuilder.append()\`** and call \`toString()\` once when the loop ends.',
    'The **sliding-window** pattern (two forward-moving pointers, auxiliary map of last positions) solves most "longest/shortest substring with property P" problems in O(n) time.',
    'A non-static inner class implementing \`Iterator<T>\` is the textbook design: it accesses the parent data structure directly, and each \`iterator()\` call returns a fresh instance with an independent cursor.',
    'Java regex in string literals needs **double backslashes**: the regex token \`\\\\d\` is written \`"\\\\d"\` — one layer for the regex engine, one for the Java string literal.',
  ],
}
