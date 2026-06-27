import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab07: Lab = {
  id: 'lab-07',
  number: 7,
  title: 'I/O & Exception Handling',
  subtitle: 'Exception design, suppressed exceptions, retry semantics & robust file I/O',
  estimatedHours: 6,
  concepts: [
    'exception hierarchy',
    'checked vs unchecked',
    'custom exception',
    'exception chaining',
    'try-with-resources',
    'AutoCloseable',
    'suppressed exceptions',
    'finally gotchas',
    'Files',
    'BufferedReader',
    'BufferedWriter',
  ],
  overview: `You already know \`try/catch/finally\` and can throw a basic exception. This lab
goes deeper — to the parts that trip up experienced engineers in code reviews and
interviews: **suppressed exceptions** when two resources fail simultaneously,
the **return-in-finally** bug that silently drops a thrown exception, exception
hierarchies designed for a real domain, retry semantics that distinguish
recoverable from fatal failures, and robust file I/O that accumulates errors
rather than failing fast.

The theory sections focus on nuance and gotchas. The exercises are at
mid-interview difficulty — you will be expected to reason about close() ordering,
exception propagation paths, and API design trade-offs.`,
  theory: [
    {
      id: 'hierarchy-nuance',
      heading: 'Exception hierarchy: the parts that actually matter',
      body: `The tree everyone draws:

~~~text
Throwable
├── Error          (OutOfMemoryError, StackOverflowError — do not catch)
└── Exception
    ├── RuntimeException           ← unchecked; no throws declaration needed
    │   ├── NullPointerException
    │   ├── IllegalArgumentException
    │   ├── IllegalStateException
    │   └── NumberFormatException
    └── (direct Exception subclasses) ← checked; compiler enforces handling
        ├── IOException
        │   └── FileNotFoundException
        └── SQLException
~~~

**Three design rules that matter in interviews:**

1. Throw **unchecked** (\`RuntimeException\`) for programming errors the caller cannot
   reasonably recover from at the call site — null input to a non-null parameter, an
   illegal state machine transition.
2. Throw **checked** (\`Exception\`) when the failure is *environmental* and the caller
   can meaningfully handle it — file not found, network timeout, database constraint
   violation.
3. Do not use \`Exception\` or \`Throwable\` as a catch-all in production code. Catching
   \`Exception\` swallows \`RuntimeException\`s you wanted to propagate; catching
   \`Throwable\` catches \`Error\`s the JVM emits when it is in an unrecoverable state.

**The \`throws\` declaration is an API contract**, not just a syntax requirement. When
you wrap a checked exception in an unchecked one to avoid the \`throws\` declaration,
document why — the information loss is real.

~~~java
// Good wrapping: preserves the cause
throw new UncheckedIOException(ioException);   // java.io convenience wrapper in JDK 8+

// Bad wrapping: destroys the cause
catch (IOException e) { throw new RuntimeException("I/O failed"); }  // ← cause lost!
~~~`,
    },
    {
      id: 'finally-gotchas',
      heading: 'finally gotchas that fail interviews',
      body: `**Gotcha 1 — return in finally overrides the thrown exception:**

~~~java
static String load() {
    try {
        throw new IllegalStateException("broken");
    } finally {
        return "ok";   // ← the exception is silently DISCARDED
    }
}
System.out.println(load());  // prints "ok" — exception gone forever
~~~

The JVM discards the pending exception and returns the \`finally\` value. This is one
of the nastiest silent bugs in Java. **Rule: never use \`return\`, \`break\`, or \`continue\`
inside \`finally\`.**

**Gotcha 2 — exception thrown in finally masks the original:**

~~~java
static void demo() {
    try {
        throw new IllegalStateException("original");
    } finally {
        throw new RuntimeException("from finally");  // original is LOST
    }
}
~~~

Only \`"from finally"\` propagates. The original exception is completely dropped —
no stack trace, no log entry, nothing. This is exactly what \`try-with-resources\`
solves (see the next section).

**Gotcha 3 — finally still runs even after return:**

~~~java
static int counter() {
    try {
        return 1;        // "1" is queued as the return value
    } finally {
        System.out.println("finally runs");   // prints before the caller sees 1
        // returning here would replace 1 — gotcha 1 again
    }
}
~~~

The rule: \`finally\` **always runs** before the method actually returns. The return
value is frozen at the \`return\` statement but handed off only after \`finally\`
completes.`,
    },
    {
      id: 'suppressed-exceptions',
      heading: 'Suppressed exceptions and try-with-resources internals',
      body: `When a resource's \`close()\` throws *and* the try body also threw, the JVM faces two
exceptions. Old-style \`finally\` drops one silently (gotcha 2 above). Try-with-resources
keeps both — the body exception becomes the primary and the \`close()\` exception is
**attached as a suppressed exception**:

~~~java
class BrokenResource implements AutoCloseable {
    @Override
    public void close() {
        throw new RuntimeException("close failed");
    }
}

try (var r = new BrokenResource()) {
    throw new IllegalStateException("body failed");   // primary exception
}
// JVM calls r.close(), which throws "close failed"
// "close failed" is SUPPRESSED, not dropped
// "body failed" propagates; "close failed" is attached
~~~

Retrieve suppressed exceptions with \`e.getSuppressed()\`:

~~~java
try (var r = new BrokenResource()) {
    throw new IllegalStateException("body failed");
} catch (IllegalStateException e) {
    System.out.println("Primary  : " + e.getMessage());
    for (Throwable s : e.getSuppressed()) {
        System.out.println("Suppressed: " + s.getMessage());
    }
}
// Primary  : body failed
// Suppressed: close failed
~~~

**Multiple resources close in reverse declaration order.** If you have:

~~~java
try (var a = new A(); var b = new B()) { ... }
~~~

\`b.close()\` is called first, then \`a.close()\`. If both throw, the second
suppressed exception is attached to the first suppressed exception — the chain
is always reachable, never silently dropped.

**Implement \`AutoCloseable\`** for any resource that needs deterministic cleanup:

~~~java
public class ManagedConnection implements AutoCloseable {
    private final String id;
    ManagedConnection(String id) { this.id = id; System.out.println("open  " + id); }

    @Override
    public void close() {
        System.out.println("close " + id);   // guaranteed to be called
    }
}
~~~`,
    },
    {
      id: 'exception-design',
      heading: 'Designing a custom exception hierarchy',
      body: `For any non-trivial domain, a single exception type is not enough. Design a small
hierarchy:

~~~java
// Base checked exception for the domain
public class ParseException extends Exception {
    private final int lineNumber;

    public ParseException(int lineNumber, String message) {
        super("Line " + lineNumber + ": " + message);
        this.lineNumber = lineNumber;
    }

    public ParseException(int lineNumber, String message, Throwable cause) {
        super("Line " + lineNumber + ": " + message, cause);
        this.lineNumber = lineNumber;
    }

    public int getLineNumber() { return lineNumber; }
}

// Specific subclasses carry structured context
public class MissingFieldException extends ParseException {
    private final String fieldName;

    public MissingFieldException(int lineNumber, String fieldName) {
        super(lineNumber, "missing field: " + fieldName);
        this.fieldName = fieldName;
    }

    public String getFieldName() { return fieldName; }
}

public class InvalidValueException extends ParseException {
    private final String rawValue;

    public InvalidValueException(int lineNumber, String fieldName, String rawValue) {
        super(lineNumber, "invalid value for '" + fieldName + "': " + rawValue);
        this.rawValue = rawValue;
    }

    public String getRawValue() { return rawValue; }
}
~~~

Callers can catch the base type (\`ParseException\`) for a broad handler or a specific
subtype for targeted recovery. **Always include a \`(String, Throwable)\` constructor**
in every exception class — it costs nothing and makes exception chaining possible
anywhere in the hierarchy.`,
    },
    {
      id: 'exception-chaining',
      heading: 'Exception chaining and translation',
      body: `When a low-level exception (e.g. \`IOException\`, \`SQLException\`) crosses an
abstraction boundary, **translate it into a domain exception** — but preserve the
original as the cause so the full stack trace survives for debugging:

~~~java
class ConfigLoader {
    public Config load(String filename) throws ConfigException {
        try {
            String text = Files.readString(Path.of(filename));
            return parse(text);
        } catch (IOException e) {
            // Translate I/O error into a domain exception, preserving cause
            throw new ConfigException("Cannot load config from: " + filename, e);
        }
    }
}
~~~

Printing or logging \`e.getCause()\` (or letting it reach the JVM's top-level handler)
gives you the complete chain — both the domain error and the root I/O cause.

**Multi-catch (\`|\`)** keeps code DRY when two unrelated exceptions deserve identical
handling — but only if they genuinely call for the same response:

~~~java
try {
    int val = Integer.parseInt(line.trim());
    process(Path.of(args[val]));
} catch (NumberFormatException | IOException e) {
    System.err.println("Skipping line: " + e.getMessage());
}
// e is effectively final inside a multi-catch block
~~~

**Never** use multi-catch to suppress the difference when the two exceptions really
should be handled differently — that is just hiding logic in a union type.`,
    },
    {
      id: 'nio-file',
      heading: 'File I/O idioms with java.nio.file',
      body: `Prefer \`java.nio.file\` over the old \`java.io.File\` API for all new code.

**Small files — read everything at once:**

~~~java
String text  = Files.readString(Path.of("config.txt"));    // whole file as String
List<String> lines = Files.readAllLines(Path.of("log.txt")); // one element per line
~~~

**Large files — stream line by line (one line in memory at a time):**

~~~java
try (var reader = Files.newBufferedReader(Path.of("huge.csv"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        process(line);
    }
}
~~~

**Writing:**

~~~java
// Overwrite with a list of lines
Files.write(Path.of("out.txt"), List.of("a", "b", "c"));

// Append to an existing file
Files.writeString(Path.of("log.txt"), "entry\\n",
    StandardOpenOption.CREATE, StandardOpenOption.APPEND);

// Incremental writes — most flexible
try (var writer = Files.newBufferedWriter(Path.of("out.csv"))) {
    for (String row : rows) { writer.write(row); writer.newLine(); }
}
~~~

**Path resolution:** \`Path.of("file.txt")\` is relative to the JVM's working directory.
In an IDE that is typically the project root (the folder containing \`src/\`).

**Never swallow \`IOException\`** with an empty catch block. At minimum log
\`e.getMessage()\`; for batch jobs, accumulate errors and continue (see exercise 3).`,
    },
    {
      id: 'retry-semantics',
      heading: 'Retry semantics: recoverable vs fatal exceptions',
      body: `A common real-world pattern is retrying an operation after a **transient** failure
(network glitch, temporary lock contention) while letting **fatal** failures propagate
immediately. The key is to retry only the exception types you can recover from:

~~~java
@FunctionalInterface
public interface CheckedSupplier<T> {
    T get() throws Exception;
}

static <T> T retryOnce(CheckedSupplier<T> operation, Class<? extends Exception> retryOn)
        throws Exception {
    try {
        return operation.get();
    } catch (Exception e) {
        if (retryOn.isInstance(e)) {
            System.err.println("Transient failure, retrying: " + e.getMessage());
            return operation.get();   // second attempt — any exception propagates
        }
        throw e;  // non-retryable: rethrow unchanged
    }
}
~~~

Usage:

~~~java
String result = retryOnce(
    () -> fetchFromNetwork("https://api.example.com/data"),
    java.io.IOException.class
);
~~~

The idiom generalises to N retries with exponential backoff using \`Thread.sleep\`
(which throws \`InterruptedException\` — remember to restore the interrupt flag:
\`Thread.currentThread().interrupt()\` before rethrowing).

**The critical design question**: which exceptions are retryable? \`IOException\`
from a file read is usually not retryable (the file is missing or corrupt).
\`IOException\` from a network call often is. Document the contract.`,
    },
  ],
  exercises: [
    {
      id: 'invalid-token-exception',
      title: 'Design a checked exception: InvalidTokenException + parseInts',
      difficulty: 'warmup',
      prompt: `Design and implement a **custom checked exception** that carries structured
context, then use it in a real parsing method.

**Step 1 — define the exception:**

Create \`class InvalidTokenException extends Exception\` with:
- fields: \`String token\` (the bad text) and \`int index\` (zero-based position in the array)
- a constructor \`InvalidTokenException(String token, int index)\` that builds a helpful
  message such as \`"Token at index 2 is not an integer: \\"abc\\""\`
- getters \`getToken()\` and \`getIndex()\`

**Step 2 — implement the parser:**

~~~java
static int[] parseInts(String csv) throws InvalidTokenException
~~~

- Split \`csv\` on \`","\` (no limit argument needed here).
- Attempt to parse each token as an integer with \`Integer.parseInt\`.
- On the **first** non-integer token, throw \`InvalidTokenException\` with the bad token
  and its zero-based index. Do **not** accumulate errors — fail fast on the first bad token.
- Return an \`int[]\` of the parsed values if all tokens are valid.

**Step 3 — write \`main\`:**

Call \`parseInts\` twice and handle the exception:

1. \`"1,2,3"\` — should succeed; print the array values on one line.
2. \`"10,abc,30"\` — should throw; catch \`InvalidTokenException\` and print both
   \`getIndex()\` and \`getToken()\`.

Expected output:

~~~text
Parsed: 1 2 3
Bad token at index 1: "abc"
~~~`,
      starter: `public class TokenParser {

    /**
     * Thrown when a comma-separated token cannot be parsed as an integer.
     * Carries the bad token text and its zero-based index for structured handling.
     */
    static class InvalidTokenException extends Exception {
        private final String token;
        private final int index;

        public InvalidTokenException(String token, int index) {
            // TODO: call super() with a message like:
            //   Token at index <index> is not an integer: "<token>"
            super("TODO");
            this.token = token;
            this.index = index;
        }

        public String getToken() { return token; }
        public int    getIndex() { return index; }
    }

    /**
     * Parse a comma-separated string of integers.
     * Throws InvalidTokenException on the first token that is not a valid integer.
     */
    static int[] parseInts(String csv) throws InvalidTokenException {
        String[] parts = csv.split(",");
        int[] result = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            // TODO: try Integer.parseInt(parts[i].trim())
            //       catch NumberFormatException and throw InvalidTokenException
        }
        return result;
    }

    public static void main(String[] args) {
        // Test 1: valid input
        try {
            int[] nums = parseInts("1,2,3");
            // TODO: print "Parsed: " followed by each number separated by spaces
        } catch (InvalidTokenException e) {
            System.out.println("Unexpected error: " + e.getMessage());
        }

        // Test 2: invalid token
        try {
            parseInts("10,abc,30");
            System.out.println("Should not reach here");
        } catch (InvalidTokenException e) {
            // TODO: print:  Bad token at index <index>: "<token>"
        }
    }
}`,
      hints: [
        'In the \`InvalidTokenException\` constructor call \`super("Token at index " + index + " is not an integer: \\"" + token + "\\"");\` — the escaped quotes keep the message readable.',
        'Inside \`parseInts\`, wrap \`Integer.parseInt(parts[i].trim())\` in a try/catch(NumberFormatException). In the catch, throw \`new InvalidTokenException(parts[i].trim(), i)\`.',
        'In \`main\`, print the array with a loop: \`StringBuilder sb = new StringBuilder("Parsed:");\` then append each number, or use a simple enhanced-for with a flag for the separator.',
      ],
      solution: `public class TokenParser {

    static class InvalidTokenException extends Exception {
        private final String token;
        private final int index;

        public InvalidTokenException(String token, int index) {
            super("Token at index " + index + " is not an integer: \\"" + token + "\\"");
            this.token = token;
            this.index = index;
        }

        public String getToken() { return token; }
        public int    getIndex() { return index; }
    }

    static int[] parseInts(String csv) throws InvalidTokenException {
        String[] parts = csv.split(",");
        int[] result = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String trimmed = parts[i].trim();
            try {
                result[i] = Integer.parseInt(trimmed);
            } catch (NumberFormatException e) {
                throw new InvalidTokenException(trimmed, i);
            }
        }
        return result;
    }

    public static void main(String[] args) {
        // Test 1: all valid
        try {
            int[] nums = parseInts("1,2,3");
            StringBuilder sb = new StringBuilder("Parsed:");
            for (int n : nums) sb.append(" ").append(n);
            System.out.println(sb);
        } catch (InvalidTokenException e) {
            System.out.println("Unexpected error: " + e.getMessage());
        }

        // Test 2: bad token at index 1
        try {
            parseInts("10,abc,30");
            System.out.println("Should not reach here");
        } catch (InvalidTokenException e) {
            System.out.println("Bad token at index " + e.getIndex() + ": \\"" + e.getToken() + "\\"");
        }
    }
}`,
      explanation: `**Why a checked exception here?** \`InvalidTokenException\` extends \`Exception\` (not
\`RuntimeException\`), so the compiler forces every caller of \`parseInts\` to either
catch it or declare \`throws InvalidTokenException\`. This is the right choice: a bad
token is an *environmental* condition (malformed input from outside the program), not
a programming error — callers can meaningfully handle it.

**Structured fields vs message parsing.** The exception stores \`token\` and \`index\` as
typed fields with getters. A caller that wants to highlight the bad token in a UI or
log a structured error can call \`e.getIndex()\` and \`e.getToken()\` directly — no string
parsing required. This is the core design rule from the theory: **never force callers
to parse your own error messages** to recover structured information.

**Wrapping \`NumberFormatException\`.** \`Integer.parseInt\` throws an unchecked
\`NumberFormatException\`. By catching it and rethrowing as \`InvalidTokenException\` the
method translates a low-level library exception into a domain exception with richer
context. The original \`NumberFormatException\` could be preserved as a cause
(\`super(..., e)\`) — a production-quality version would do exactly that so the full
chain appears in logs.

**Fail-fast vs accumulate.** This exercise throws on the *first* bad token. Compare this
to the CSV processor exercise (exercise 3) which accumulates all errors before reporting.
Both are valid strategies — fail-fast is appropriate when partial results are not useful;
accumulation is appropriate in batch contexts where you want a full error report.`,
    },
    {
      id: 'dual-resource-suppressed',
      title: 'Two AutoCloseable resources and getSuppressed()',
      difficulty: 'core',
      prompt: `Implement **two custom \`AutoCloseable\` classes** that each throw from \`close()\`,
then demonstrate exactly how try-with-resources handles them.

**Part 1 — implement the resources:**

\`TrackedResource\` wraps a \`String\` name. Its constructor prints \`"open  <name>"\`.
Its \`close()\` prints \`"close <name>"\` and — if a boolean \`failOnClose\` was passed as
\`true\` to the constructor — throws \`RuntimeException("close failed: <name>")\`.

**Part 2 — the demo:**

Write a \`main\` that opens **two** \`TrackedResource\` instances in a single
try-with-resources block: \`outer\` (declared first, \`failOnClose = true\`) and \`inner\`
(declared second, \`failOnClose = true\`). The try body throws
\`IllegalStateException("body exception")\`.

After catching the primary exception:
- Print the primary exception message.
- Iterate over \`e.getSuppressed()\` and print each suppressed message.

Then answer in a comment: in what order were the resources closed, and which
exception ended up primary vs suppressed?

**Expected output (order matters):**

~~~text
open  outer
open  inner
close inner
close outer
Primary  : body exception
Suppressed[0]: close failed: inner
Suppressed[1]: close failed: outer
~~~`,
      starter: `public class DualResource {

    static class TrackedResource implements AutoCloseable {
        private final String name;
        private final boolean failOnClose;

        public TrackedResource(String name, boolean failOnClose) {
            this.name = name;
            this.failOnClose = failOnClose;
            // TODO: print "open  <name>"
        }

        @Override
        public void close() {
            // TODO: print "close <name>", then throw if failOnClose
        }
    }

    public static void main(String[] args) {
        try (
            var outer = new TrackedResource("outer", true);
            var inner = new TrackedResource("inner", true)
        ) {
            // TODO: throw IllegalStateException("body exception")
        } catch (IllegalStateException e) {
            // TODO: print primary message and all suppressed messages
        }
    }
}`,
      hints: [
        'Resources declared in a single try-with-resources block close in reverse order: inner closes first, then outer. This mirrors the LIFO order of stack unwinding.',
        'The body exception becomes the primary. Each close() exception is attached via addSuppressed() in the order the closes are called (inner first, then outer).',
        'Loop over getSuppressed() with a for-each and print index + message to match the expected output format.',
      ],
      solution: `public class DualResource {

    static class TrackedResource implements AutoCloseable {
        private final String name;
        private final boolean failOnClose;

        public TrackedResource(String name, boolean failOnClose) {
            this.name = name;
            this.failOnClose = failOnClose;
            System.out.println("open  " + name);
        }

        @Override
        public void close() {
            System.out.println("close " + name);
            if (failOnClose) {
                throw new RuntimeException("close failed: " + name);
            }
        }
    }

    public static void main(String[] args) {
        try (
            var outer = new TrackedResource("outer", true);
            var inner = new TrackedResource("inner", true)
        ) {
            throw new IllegalStateException("body exception");
        } catch (IllegalStateException e) {
            System.out.println("Primary  : " + e.getMessage());
            Throwable[] suppressed = e.getSuppressed();
            for (int i = 0; i < suppressed.length; i++) {
                System.out.println("Suppressed[" + i + "]: " + suppressed[i].getMessage());
            }
        }
        // Close order: inner first (declared last), then outer (declared first) — LIFO.
        // Primary exception: "body exception" (the one thrown in the try body).
        // Suppressed[0]: "close failed: inner" (first close called).
        // Suppressed[1]: "close failed: outer" (second close called).
    }
}`,
      explanation: `Resources in a try-with-resources block close in **reverse declaration order** — last
declared, first closed. This mirrors the LIFO order of stack frames: inner resources
that depend on outer ones are torn down first.

When the try body throws and \`close()\` also throws, the JVM calls
\`bodyException.addSuppressed(closeException)\` internally for each resource, in the
order closes are attempted. The body exception is always the primary; no information is
lost. Contrast this with old-style \`finally\` (snippet B from the warmup), where the
second exception completely replaces the first.

Practical implication: when you see a suppressed exception in a stack trace (it is
indented and labelled \`Suppressed:\` by the JVM's default exception printer), that is
almost always a \`close()\` failure inside try-with-resources. Look at both the primary
and every suppressed exception before diagnosing the root cause.`,
    },
    {
      id: 'csv-accumulator',
      title: 'CSV parser with accumulated errors and a custom exception hierarchy',
      difficulty: 'core',
      prompt: `Build a CSV processor that reads a product catalogue, **never fails fast** (one
bad row should not stop parsing the rest), writes valid rows to an output file, and
prints a structured error report using a **custom exception hierarchy**.

**Setup — create \`products.csv\` in your project root** (the directory your IDE
uses as the working directory, typically the folder containing \`src/\`):

~~~text
name,price,quantity
Anvil,49.99,10
Rocket,1200.00,3
Birdseed,,100
ACME Bomb,-5.00,20
Dehydrated Boulders,99.99,abc
,25.00,5
Portable Hole,0.01,1
~~~

**Custom exception hierarchy (three classes):**

- \`RowParseException extends Exception\` — base; stores \`int lineNumber\`, string
  message, optional cause; getter \`getLineNumber()\`.
- \`InvalidFieldException extends RowParseException\` — stores \`String fieldName\`
  and \`String rawValue\`; getter \`getFieldName()\`.
- \`MissingFieldException extends RowParseException\` — stores \`String fieldName\`;
  getter \`getFieldName()\`.

**Processor requirements:**

1. Open reader (\`products.csv\`) and writer (\`products_valid.csv\`) in one
   try-with-resources block.
2. Read and copy the header line.
3. For each data row (starting at line 2): split on \`","\` with limit \`-1\`.
   - Throw \`MissingFieldException\` if the field is blank (name, price, or quantity).
   - Throw \`InvalidFieldException\` if price is not a positive double or quantity is
     not a non-negative int.
   - Catch the exception *per row*, add it to a \`List<RowParseException> errors\`
     list, and continue to the next row.
4. Write valid rows to \`products_valid.csv\`.
5. Print final report (example format):

~~~text
Processed 7 rows: 4 valid, 3 invalid.
  Line 4: [birdseed] missing field: price
  Line 5: [ACME Bomb] invalid field price = "-5.00" (must be > 0)
  Line 6: [Dehydrated Boulders] invalid field quantity = "abc"
  Line 7: [missing name] missing field: name
~~~

*(Your exact row numbers and messages may vary slightly — match the spirit.)*`,
      starter: `import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

// ---- Exception hierarchy (put these in the same file or separate files) ----

class RowParseException extends Exception {
    private final int lineNumber;
    public RowParseException(int lineNumber, String message) {
        super(message);
        this.lineNumber = lineNumber;
    }
    public RowParseException(int lineNumber, String message, Throwable cause) {
        super(message, cause);
        this.lineNumber = lineNumber;
    }
    public int getLineNumber() { return lineNumber; }
}

class InvalidFieldException extends RowParseException {
    private final String fieldName;
    private final String rawValue;
    // TODO: constructor + getters
    public InvalidFieldException(int lineNumber, String fieldName, String rawValue) {
        super(lineNumber, "invalid field " + fieldName + " = \\"" + rawValue + "\\"");
        this.fieldName = fieldName;
        this.rawValue  = rawValue;
    }
    public String getFieldName() { return fieldName; }
    public String getRawValue()  { return rawValue;  }
}

class MissingFieldException extends RowParseException {
    private final String fieldName;
    // TODO: constructor + getter
    public MissingFieldException(int lineNumber, String fieldName) {
        super(lineNumber, "missing field: " + fieldName);
        this.fieldName = fieldName;
    }
    public String getFieldName() { return fieldName; }
}

// ---- Main processor ----

public class CsvProcessor {

    /**
     * Validate one data row; throws RowParseException on the first problem found.
     * fields[0]=name, fields[1]=price, fields[2]=quantity
     */
    static void validate(int lineNumber, String[] fields) throws RowParseException {
        // TODO: check field count, then name blank, price, quantity
    }

    public static void main(String[] args) {
        Path inputPath  = Path.of("products.csv");
        Path outputPath = Path.of("products_valid.csv");

        List<RowParseException> errors = new ArrayList<>();
        int totalRows = 0;
        int validRows = 0;

        // TODO: open reader + writer in one try-with-resources block,
        //       copy header, loop rows, call validate(), accumulate errors.

        // TODO: print final report
    }
}`,
      hints: [
        'Split with \`line.split(",", -1)\` (limit = -1) so trailing empty fields are preserved and counted correctly.',
        'In the row loop, call \`validate(lineNumber, fields)\` inside its own try/catch (RowParseException). Do not let an exception from one row exit the while loop.',
        'Track a \`rowNumber\` counter starting at 2 (row 1 is the header). Increment it regardless of whether the row was valid or invalid.',
      ],
      solution: `import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

class RowParseException extends Exception {
    private final int lineNumber;
    public RowParseException(int lineNumber, String message) {
        super(message);
        this.lineNumber = lineNumber;
    }
    public RowParseException(int lineNumber, String message, Throwable cause) {
        super(message, cause);
        this.lineNumber = lineNumber;
    }
    public int getLineNumber() { return lineNumber; }
}

class InvalidFieldException extends RowParseException {
    private final String fieldName;
    private final String rawValue;
    public InvalidFieldException(int lineNumber, String fieldName, String rawValue) {
        super(lineNumber, "invalid field " + fieldName + " = \\"" + rawValue + "\\"");
        this.fieldName = fieldName;
        this.rawValue  = rawValue;
    }
    public String getFieldName() { return fieldName; }
    public String getRawValue()  { return rawValue;  }
}

class MissingFieldException extends RowParseException {
    private final String fieldName;
    public MissingFieldException(int lineNumber, String fieldName) {
        super(lineNumber, "missing field: " + fieldName);
        this.fieldName = fieldName;
    }
    public String getFieldName() { return fieldName; }
}

public class CsvProcessor {

    static void validate(int lineNumber, String[] fields) throws RowParseException {
        if (fields.length != 3) {
            throw new RowParseException(lineNumber,
                "expected 3 fields, got " + fields.length);
        }
        String name     = fields[0].trim();
        String priceRaw = fields[1].trim();
        String qtyRaw   = fields[2].trim();

        if (name.isBlank()) {
            throw new MissingFieldException(lineNumber, "name");
        }
        if (priceRaw.isBlank()) {
            throw new MissingFieldException(lineNumber, "price");
        }
        try {
            double price = Double.parseDouble(priceRaw);
            if (price <= 0) throw new InvalidFieldException(lineNumber, "price", priceRaw);
        } catch (NumberFormatException e) {
            throw new InvalidFieldException(lineNumber, "price", priceRaw);
        }
        if (qtyRaw.isBlank()) {
            throw new MissingFieldException(lineNumber, "quantity");
        }
        try {
            int qty = Integer.parseInt(qtyRaw);
            if (qty < 0) throw new InvalidFieldException(lineNumber, "quantity", qtyRaw);
        } catch (NumberFormatException e) {
            throw new InvalidFieldException(lineNumber, "quantity", qtyRaw);
        }
    }

    public static void main(String[] args) {
        Path inputPath  = Path.of("products.csv");
        Path outputPath = Path.of("products_valid.csv");

        List<RowParseException> errors = new ArrayList<>();
        int totalRows = 0;
        int validRows = 0;

        try (
            var reader = Files.newBufferedReader(inputPath);
            var writer = Files.newBufferedWriter(outputPath)
        ) {
            // Copy header
            String header = reader.readLine();
            if (header != null) {
                writer.write(header);
                writer.newLine();
            }

            int rowNumber = 2;
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) { rowNumber++; continue; }
                totalRows++;
                String[] fields = line.split(",", -1);
                try {
                    validate(rowNumber, fields);
                    writer.write(line);
                    writer.newLine();
                    validRows++;
                } catch (RowParseException e) {
                    errors.add(e);
                }
                rowNumber++;
            }
        } catch (IOException e) {
            System.err.println("I/O error: " + e.getMessage());
            System.exit(1);
        }

        int invalidRows = totalRows - validRows;
        System.out.println("Processed " + totalRows + " rows: "
            + validRows + " valid, " + invalidRows + " invalid.");
        for (RowParseException e : errors) {
            System.out.println("  Line " + e.getLineNumber() + ": " + e.getMessage());
        }
    }
}`,
      explanation: `**Exception hierarchy as structured data.** \`RowParseException\` is the base type
a generic error handler can catch; the subclasses carry structured fields (\`fieldName\`,
\`rawValue\`) that code inspecting specific errors can use without parsing the message
string. This is the key design principle: **never force callers to parse your own error
messages** to recover structured information.

**split with limit -1.** Without the limit argument, \`"a,,b".split(",")\` gives
\`{"a","","b"}\` correctly, but \`"a,b,".split(",")\` drops the trailing empty string and
gives only \`{"a","b"}\` — wrong field count silently. Passing \`-1\` disables the
trailing-empty-string trimming.

**Per-row try/catch.** The validate call and writer.write are both wrapped in a
try/catch inside the loop. An exception on row 4 does not exit the while loop; it adds
to the errors list and continues to row 5. This "collect errors, continue processing"
pattern is standard in batch jobs, import pipelines, and file validators.

**Single try-with-resources for both reader and writer.** If the writer's \`close()\`
throws (e.g. a flush failure), it becomes a suppressed exception on any body exception,
or propagates on its own if the body succeeded — never silently dropped.`,
    },
    {
      id: 'retry-wrapper',
      title: 'Generic retry-with-backoff wrapper',
      difficulty: 'challenge',
      prompt: `Implement a generic **retry-with-backoff** utility that:

1. Accepts a \`CheckedSupplier<T>\` (a functional interface that can throw \`Exception\`),
   a \`maxAttempts\` count, a \`retryDelayMs\` delay between attempts, and a
   \`Class<? extends Exception> retryOn\` type that identifies retryable exceptions.
2. Runs the supplier. If it throws an exception that **is an instance of** \`retryOn\`,
   it waits \`retryDelayMs\` milliseconds and tries again, up to \`maxAttempts\` total.
3. If the exception is **not** an instance of \`retryOn\`, it rethrows immediately without
   retry.
4. If all \`maxAttempts\` are exhausted, wraps the last exception in a
   \`RetryExhaustedException\` (a custom unchecked exception that stores the attempt count
   and has the last exception as its cause).
5. Restores the interrupt flag if a \`Thread.sleep\` is interrupted
   (\`Thread.currentThread().interrupt()\`) before rethrowing \`InterruptedException\`
   wrapped in \`RuntimeException\`.

**Test it** by writing a \`main\` that simulates a flaky network call:

- A counter starts at 0. The supplier increments it and throws \`IOException("flaky")\`
  on attempts 1 and 2, but returns \`"success"\` on attempt 3.
- Call the wrapper with \`maxAttempts = 3\`, \`retryDelayMs = 10\`, \`retryOn = IOException.class\`.
- Print the result.

Then test the non-retryable path: the supplier always throws \`IllegalStateException\`;
call with \`retryOn = IOException.class\` and confirm the \`IllegalStateException\` escapes
immediately (after exactly 1 attempt).

Expected output:

~~~text
Attempt 1 failed (retryable): flaky
Attempt 2 failed (retryable): flaky
Result: success
Attempt 1 failed (non-retryable): fatal
Non-retryable exception propagated: fatal
~~~`,
      starter: `import java.io.IOException;

// Functional interface that can throw any checked exception
@FunctionalInterface
interface CheckedSupplier<T> {
    T get() throws Exception;
}

// Thrown when all retry attempts are exhausted
class RetryExhaustedException extends RuntimeException {
    private final int attempts;

    public RetryExhaustedException(int attempts, Throwable cause) {
        super("All " + attempts + " attempt(s) exhausted", cause);
        this.attempts = attempts;
    }

    public int getAttempts() { return attempts; }
}

public class RetryWrapper {

    /**
     * Execute the supplier with retry logic.
     *
     * @param supplier    the operation to attempt
     * @param maxAttempts total number of attempts (>= 1)
     * @param retryDelayMs milliseconds to wait between attempts
     * @param retryOn     exception type that should trigger a retry
     * @return the supplier's result on success
     * @throws RetryExhaustedException if all attempts fail with a retryable exception
     * @throws Exception               immediately if a non-retryable exception is thrown
     */
    static <T> T retry(
            CheckedSupplier<T> supplier,
            int maxAttempts,
            long retryDelayMs,
            Class<? extends Exception> retryOn) throws Exception {
        // TODO: implement the retry loop
        return null;
    }

    public static void main(String[] args) throws Exception {
        // Test 1: retryable path — succeed on attempt 3
        int[] counter = {0};
        String result = retry(
            () -> {
                counter[0]++;
                if (counter[0] < 3) throw new IOException("flaky");
                return "success";
            },
            3, 10, IOException.class
        );
        System.out.println("Result: " + result);

        // Test 2: non-retryable exception escapes immediately
        try {
            retry(
                () -> { throw new IllegalStateException("fatal"); },
                3, 10, IOException.class
            );
        } catch (IllegalStateException e) {
            System.out.println("Non-retryable exception propagated: " + e.getMessage());
        }
    }
}`,
      hints: [
        'Use a for loop from 1 to maxAttempts. Catch Exception in the loop body. Use retryOn.isInstance(e) to decide whether to retry or rethrow immediately.',
        'On a retryable exception, call Thread.sleep(retryDelayMs) inside a try/catch(InterruptedException). In the catch, call Thread.currentThread().interrupt() to restore the interrupt flag before wrapping and rethrowing.',
        'After the loop exits (all attempts exhausted), you have the last exception saved in a variable — throw new RetryExhaustedException(maxAttempts, lastException).',
      ],
      solution: `import java.io.IOException;

@FunctionalInterface
interface CheckedSupplier<T> {
    T get() throws Exception;
}

class RetryExhaustedException extends RuntimeException {
    private final int attempts;

    public RetryExhaustedException(int attempts, Throwable cause) {
        super("All " + attempts + " attempt(s) exhausted", cause);
        this.attempts = attempts;
    }

    public int getAttempts() { return attempts; }
}

public class RetryWrapper {

    static <T> T retry(
            CheckedSupplier<T> supplier,
            int maxAttempts,
            long retryDelayMs,
            Class<? extends Exception> retryOn) throws Exception {

        Exception lastException = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return supplier.get();   // success — return immediately
            } catch (Exception e) {
                if (!retryOn.isInstance(e)) {
                    // Non-retryable: rethrow unchanged, no delay, no further attempts
                    System.out.println("Attempt " + attempt + " failed (non-retryable): " + e.getMessage());
                    throw e;
                }
                lastException = e;
                System.out.println("Attempt " + attempt + " failed (retryable): " + e.getMessage());
                if (attempt < maxAttempts) {
                    try {
                        Thread.sleep(retryDelayMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();   // restore interrupt flag
                        throw new RuntimeException("Retry interrupted", ie);
                    }
                }
            }
        }

        throw new RetryExhaustedException(maxAttempts, lastException);
    }

    public static void main(String[] args) throws Exception {
        // Test 1: succeed on attempt 3
        int[] counter = {0};
        String result = retry(
            () -> {
                counter[0]++;
                if (counter[0] < 3) throw new IOException("flaky");
                return "success";
            },
            3, 10, IOException.class
        );
        System.out.println("Result: " + result);

        // Test 2: non-retryable exception escapes immediately
        try {
            retry(
                () -> { throw new IllegalStateException("fatal"); },
                3, 10, IOException.class
            );
        } catch (IllegalStateException e) {
            System.out.println("Non-retryable exception propagated: " + e.getMessage());
        }
    }
}`,
      explanation: `**\`retryOn.isInstance(e)\`** is the key line: it is equivalent to \`e instanceof retryOn\`
but works with a \`Class\` reference at runtime. This makes the method generic —
the caller decides which exception type is retryable without the wrapper needing to
know anything about the domain.

**Non-retryable exceptions rethrow immediately.** The method's declared \`throws Exception\`
allows checked exceptions to propagate. The caller of \`retry\` must handle or declare them.
This preserves the checked-exception contract: if the supplier can throw a checked
exception that is not the retryable type, the caller is forced to deal with it.

**Interrupt flag restoration.** \`Thread.sleep\` throws \`InterruptedException\` if another
thread calls \`interrupt()\` on this thread. Catching it and doing nothing would clear the
interrupted status silently, making it impossible for the caller to detect cancellation.
Calling \`Thread.currentThread().interrupt()\` before rethrowing restores the flag. This
is a widely-known but often-skipped correctness requirement in concurrent code.

**\`RetryExhaustedException\` is unchecked** (\`extends RuntimeException\`) by design.
Retry exhaustion is a fundamental failure of the operation — it is not a condition the
immediate caller can recover from at the call site, so forcing them to \`catch\` or
\`throws\` it would be noise. The cause is preserved so the full failure chain is visible
in logs.`,
    },
  ],
  takeaways: [
    '**Never put \`return\`, \`break\`, or \`continue\` inside \`finally\`** — they silently discard any in-flight exception, one of the most dangerous silent bugs in Java.',
    'Old-style \`finally\` blocks that themselves throw **replace** the original exception. Try-with-resources fixes this by **suppressing** the close() exception and attaching it to the primary via \`addSuppressed()\` — neither exception is lost.',
    'Resources in a try-with-resources block close in **reverse declaration order** (LIFO). Retrieve close() failures with \`e.getSuppressed()\` rather than assuming there is only one exception.',
    'Design custom exception hierarchies so callers can catch the base type for broad handling or a specific subtype for targeted recovery. **Always include a \`(String, Throwable)\` constructor** for chaining — never discard the cause.',
    'When translating a low-level exception into a domain exception, pass the original as the cause: \`throw new DomainException("...", cause)\`. Losing the cause means losing the root stack trace.',
    'For batch/file processing, **accumulate errors per record and continue** rather than failing fast — one bad CSV row should not prevent the remaining 999 from being processed.',
    'Retry logic must distinguish **retryable** exceptions (\`IOException\` from a network call) from **fatal** ones (\`IllegalStateException\`). Always restore the interrupt flag (\`Thread.currentThread().interrupt()\`) when catching \`InterruptedException\` in a retry sleep.',
  ],
}
