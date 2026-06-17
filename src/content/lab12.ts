import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//  - NO ${ sequences anywhere in content strings.

export const lab12: Lab = {
  id: 'lab-12',
  number: 12,
  title: 'Advanced Java Programming',
  subtitle: 'Sealed types, pattern matching, Optional pipelines, immutability & concurrency correctness',
  estimatedHours: 6,
  concepts: [
    'record',
    'sealed interface',
    'pattern matching switch',
    'guard patterns',
    'Optional',
    'immutability',
    'race condition',
    'AtomicInteger',
    'ExecutorService',
    'Future',
    'Callable',
  ],
  overview: `You know Java basics. This lab targets the **modern and concurrent** parts
that separate intermediate developers from juniors: the closed-hierarchy toolset
(\`sealed\` + \`record\` + exhaustive \`switch\`), Optional done correctly — not as a
dressed-up null check — and the thread-safety fundamentals that every JVM
engineer is expected to explain in an interview.

Each section has teeth. Theory covers the gotchas that trip people up, not just
the happy path. Exercises are production-shaped: you will build an arithmetic
expression evaluator with exhaustive dispatch, replace a nested-null-check mess
with a clean Optional pipeline, reproduce and then fix a race condition, and
write a parallel aggregation that splits work across \`Callable\`s and collects
\`Future\` results correctly.

All examples compile on **JDK 24**. Records, sealed types, pattern matching for
\`switch\`, and \`when\` guards are all fully stable.`,
  theory: [
    {
      id: 'records-nuance',
      heading: 'Records — what the compiler really generates (and the traps)',
      body: `A record declaration is syntactic sugar, but knowing what the compiler emits
matters for interviews and subtle bugs.

~~~java
record Point(double x, double y) {}
~~~

The compiler generates **exactly** these members (nothing more):
- A **canonical constructor** \`Point(double x, double y)\` that assigns both fields.
- Accessors \`x()\` and \`y()\` — note no \`get\` prefix, breaking JavaBeans convention.
- \`equals\`, \`hashCode\`, and \`toString\` based on the declared components.

The class is **implicitly \`final\`** (no subclassing) and every component field is
**\`private final\`** (no post-construction mutation).

**Trap 1 — mutable components break immutability:**

~~~java
record Snapshot(int[] values) {}

Snapshot s = new Snapshot(new int[]{1, 2, 3});
s.values()[0] = 99;   // compiles and runs — the array itself is mutable!
System.out.println(s.values()[0]);   // 99 — record is NOT deeply immutable
~~~

The record field holds a reference that is final; the array behind the reference
is not. Fix with a compact constructor that copies defensively:

~~~java
record Snapshot(int[] values) {
    Snapshot {
        values = values.clone();   // defensive copy in compact constructor
    }
    // Override accessor to return a copy too
    public int[] values() { return values.clone(); }
}
~~~

**Trap 2 — serialisation and \`equals\` across class loaders**: records derive
\`equals\` from component values, not object identity. This is almost always what
you want but breaks the rare "use object as a set-entry with identity semantics"
pattern. In those cases a regular class is better.

**Compact constructor syntax:**

~~~java
record Range(int lo, int hi) {
    Range {   // compact: no explicit parameters, no explicit field assignment
        if (lo > hi) throw new IllegalArgumentException(lo + " > " + hi);
        // fields are assigned implicitly at the end of this block
    }
}
~~~

The compact constructor body runs *before* the implicit field assignment, so
you can normalise or validate arguments before they are locked in.`,
    },
    {
      id: 'sealed-deep',
      heading: 'Sealed types — closing hierarchies and why it matters',
      body: `A **sealed interface or class** restricts which other types may implement or
extend it. The motivation is not restriction for its own sake — it is
**compiler-verified exhaustiveness**.

~~~java
sealed interface Expr permits Num, Add, Mul {}

record Num(int value)         implements Expr {}
record Add(Expr left, Expr right) implements Expr {}
record Mul(Expr left, Expr right) implements Expr {}
~~~

Every permitted subtype must declare one of three modifiers:
- **\`final\`** — cannot be extended further. Records satisfy this implicitly.
- **\`sealed\`** — sealed itself; introduces another level of the hierarchy.
- **\`non-sealed\`** — deliberately re-opens the hierarchy at that node.

**Why \`non-sealed\` exists:** if a library exposes a sealed hierarchy but wants
to allow third-party extensions for one specific variant, it marks that variant
\`non-sealed\`. This is a conscious escape hatch; the overall hierarchy is still
mostly closed.

**The exhaustiveness payoff** — add a new variant and every \`switch\` that misses
it becomes a compile error:

~~~java
sealed interface Notification permits Email, Sms, Push {}

// Somewhere else in the codebase:
String channel(Notification n) {
    return switch (n) {
        case Email e -> "email";
        case Sms s   -> "sms";
        // Forgot Push — compile error: 'switch' expression does not cover all values
    };
}
~~~

Compare this with the pre-sealed pattern of an \`abstract\` class plus a
\`default\` arm: the \`default\` arm silently swallows any new subclass, hiding
the gap until runtime.

**Sealed types and the module system:** \`permits\` can be omitted when all
subtypes are in the same compilation unit (same file or same package). The
compiler infers the permitted list from what it sees. For large projects it is
good style to write \`permits\` explicitly.`,
    },
    {
      id: 'pattern-matching-depth',
      heading: 'Pattern matching — deconstruction patterns and guard semantics',
      body: `Pattern matching in \`switch\` (stable Java 21+) goes beyond simple type
checks: it binds a typed variable and lets you inspect the object inline.

~~~java
static double eval(Expr e) {
    return switch (e) {
        case Num n         -> n.value();
        case Add(var l, var r) -> eval(l) + eval(r);  // record deconstruction
        case Mul(var l, var r) -> eval(l) * eval(r);
    };
}
~~~

**Record deconstruction patterns** (\`case Add(var l, var r)\`) decompose the
record's components directly in the pattern — no need to call accessors inside
the branch. The \`var\` types are inferred; you can also write the concrete types
for clarity (\`case Add(Expr l, Expr r)\`).

**Guard semantics with \`when\`:**

~~~java
static String classify(Expr e) {
    return switch (e) {
        case Num n when n.value() == 0 -> "zero";
        case Num n when n.value() < 0  -> "negative";
        case Num n                     -> "positive";
        case Add a                     -> "addition";
        case Mul m                     -> "multiplication";
    };
}
~~~

Guards are evaluated **after** the type pattern matches but **before** the body
executes. A guarded arm does not prevent subsequent arms from matching — if the
guard is false the switch continues to the next arm. This is why the catch-all
\`case Num n\` must appear **after** the guarded variants.

**Dominance rules:** the compiler rejects a switch where an earlier arm would
always match before a later one. \`case Num n\` dominates \`case Num n when ...\`
so putting the unguarded arm first is a compile error.

**Null handling:** a \`switch\` on a sealed type still throws \`NullPointerException\`
if the value is \`null\`. Add an explicit \`case null\` arm or guard the call site.

~~~java
String result = switch (shape) {
    case null      -> "null shape";
    case Circle c  -> "circle";
    // ...
};
~~~`,
    },
    {
      id: 'optional-idioms',
      heading: 'Optional — the right way and the anti-patterns',
      body: `\`Optional<T>\` signals "this method may return nothing" at the type level. It is
a **return-type contract**, not a null wrapper you sprinkle everywhere.

**Construction:**

~~~java
Optional<String> a = Optional.of("hello");           // throws if null
Optional<String> b = Optional.ofNullable(maybeNull); // empty if null
Optional<String> c = Optional.empty();
~~~

**The pipeline: \`map\`, \`flatMap\`, \`filter\`, terminal:**

~~~java
// Nested-null equivalent written as a pipeline:
// user -> address -> city -> upper-cased city, or "Unknown"
Optional<String> city = findUser(id)                   // Optional<User>
    .map(User::address)                                // Optional<Address>
    .map(Address::city)                                // Optional<String>
    .filter(s -> !s.isBlank())                         // skip blank cities
    .map(String::toUpperCase);                         // transform

String display = city.orElse("Unknown");
~~~

\`flatMap\` is for when the mapping function itself returns an Optional (avoid
nesting \`Optional<Optional<T>>\`):

~~~java
Optional<String> email = findUser(id).flatMap(User::getEmail);
//              ^ getEmail returns Optional<String> already
~~~

**Anti-patterns:**

~~~java
// ANTI-PATTERN 1 — using Optional.get() without checking — NoSuchElementException
String name = opt.get();   // crashes if empty

// ANTI-PATTERN 2 — isPresent() + get() — just a null check in disguise
if (opt.isPresent()) {
    String v = opt.get();   // use opt.ifPresent(v -> ...) instead
}

// ANTI-PATTERN 3 — Optional as a field (makes the class non-serialisable,
// adds heap allocation, signals confused design)
class Foo { Optional<String> name; }   // BAD

// ANTI-PATTERN 4 — Optional as a method parameter
void process(Optional<String> label) {}  // BAD: just use @Nullable or two overloads

// ANTI-PATTERN 5 — wrapping a collection in Optional
Optional<List<String>> items = ...;   // return List.of() instead of Optional.empty()
~~~

**\`orElse\` vs \`orElseGet\`:** \`orElse(value)\` evaluates the fallback eagerly —
the expression is always computed. \`orElseGet(supplier)\` is lazy — the supplier
runs only when the Optional is empty. Use \`orElseGet\` when the fallback is
expensive (a DB call, a new object, a format operation):

~~~java
// eager — creates the expensive object even when opt is present
opt.orElse(new ExpensiveObject());

// lazy — ExpensiveObject created only if opt is empty
opt.orElseGet(ExpensiveObject::new);
~~~`,
    },
    {
      id: 'immutability-design',
      heading: 'Immutability — design rules and the defensive-copy discipline',
      body: `An immutable object's observable state never changes after construction. The
benefits are concrete: free thread safety (no synchronisation needed for reads),
safe sharing, safe use as \`Map\` keys, and simpler reasoning.

**The five rules for a truly immutable class:**

~~~java
public final class ImmutableOrder {         // Rule 1: final class
    private final String id;                // Rule 2: private final fields
    private final List<String> items;

    public ImmutableOrder(String id, List<String> items) {
        this.id    = id;
        this.items = List.copyOf(items);    // Rule 3: defensive copy of mutable input
    }

    public String id()            { return id; }
    public List<String> items()   { return items; }  // Rule 4: already unmodifiable
    // Rule 5: no setters
}
~~~

\`List.copyOf\` (Java 10+) takes a snapshot and makes it unmodifiable in one call.
Mutation attempts throw \`UnsupportedOperationException\`. Same pattern: \`Map.copyOf\`,
\`Set.copyOf\`.

**The gotcha with \`Collections.unmodifiableList\`:** it wraps without copying — the
caller's original list is still live, so modifications through the original
reference affect the wrapped view. \`List.copyOf\` does not have this problem.

~~~java
List<String> source = new ArrayList<>(List.of("a","b"));
List<String> view   = Collections.unmodifiableList(source);  // still shares backing
source.add("c");
System.out.println(view);  // [a, b, c] — the "unmodifiable" view changed!

List<String> snapshot = List.copyOf(source);  // independent snapshot
source.add("d");
System.out.println(snapshot);  // [a, b, c] — unaffected
~~~

**Records and immutability:** a record's components are \`private final\`, so it
is immutable by default — *unless* a component is a mutable object (array, list,
map). See the Trap 1 in the Records section for the fix.`,
    },
    {
      id: 'race-conditions',
      heading: 'Race conditions — visibility, atomicity and the memory model',
      body: `A **race condition** occurs when two threads read and write shared mutable state
concurrently without coordination. The result is non-deterministic.

**The classic example:**

~~~java
// BROKEN — counter++ is not atomic
int counter = 0;

Runnable inc = () -> {
    for (int i = 0; i < 100_000; i++) counter++;
};
Thread t1 = new Thread(inc);
Thread t2 = new Thread(inc);
t1.start(); t2.start();
t1.join();  t2.join();
System.out.println(counter);  // expect 200000; actual: unpredictable (e.g. 138471)
~~~

\`counter++\` expands to three JVM instructions: read, increment, write. Another
thread can interleave between any two of them, causing a lost update.

**Fix A — \`synchronized\`:**

~~~java
class SafeCounter {
    private int count = 0;
    synchronized void increment() { count++; }  // lock on 'this'
    synchronized int  get()       { return count; }
}
~~~

Only one thread can execute a \`synchronized\` method on the same instance at a
time. The \`synchronized\` keyword also creates a **memory barrier** that flushes
cached writes so other threads see fresh values.

**Fix B — \`AtomicInteger\` (preferred for simple counters):**

~~~java
import java.util.concurrent.atomic.AtomicInteger;

AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();    // read-modify-write as a single hardware operation
int snapshot = counter.get();
~~~

\`AtomicInteger\` uses CPU compare-and-swap (CAS) instructions — no OS-level
locking, lower overhead than \`synchronized\`, and easier to use correctly.

**\`volatile\` is not enough for read-modify-write:** \`volatile int counter\` only
guarantees visibility (no stale caches) but not atomicity. \`counter++\` on a
volatile field is still a race. Use atomic types or synchronise the whole
read-modify-write sequence.

**The Java Memory Model (one paragraph):** each thread may cache values in
registers or CPU caches. Without synchronisation or \`volatile\`, a thread may
read stale values. \`synchronized\` and \`volatile\` both establish
happens-before relationships that force cache flushes and prevent reordering
across the boundary.`,
    },
    {
      id: 'executorservice-patterns',
      heading: 'ExecutorService — thread pools, Callable and Future',
      body: `Creating a raw \`Thread\` per task is expensive (OS thread creation costs ~1 ms
and ~1 MB of stack). \`ExecutorService\` reuses a fixed pool of threads across
many tasks.

~~~java
ExecutorService pool = Executors.newFixedThreadPool(4);  // 4 OS threads

// Runnable: fire-and-forget, no result
pool.execute(() -> System.out.println("task"));

// Callable: returns a value via a Future
Future<Long> f = pool.submit(() -> heavyComputation());
Long result = f.get();   // blocks until done; throws ExecutionException on error
pool.shutdown();
~~~

**\`invokeAll\` for fan-out work:**

~~~java
List<Callable<Long>> tasks = List.of(
    () -> sumRange(1,      250_001),
    () -> sumRange(250_001, 500_001),
    () -> sumRange(500_001, 750_001),
    () -> sumRange(750_001, 1_000_001)
);

List<Future<Long>> futures = pool.invokeAll(tasks);  // submits all, blocks until all done
long total = 0;
for (Future<Long> fut : futures) total += fut.get(); // fut.get() is instant here
~~~

**Exception handling with Futures:** if the \`Callable\` throws, \`future.get()\`
wraps the exception in \`ExecutionException\`. Always unwrap and handle it:

~~~java
try {
    long v = future.get();
} catch (ExecutionException ex) {
    Throwable cause = ex.getCause();  // the actual exception from the Callable
    // handle or rethrow cause
} catch (InterruptedException ex) {
    Thread.currentThread().interrupt();  // restore interrupt flag — do not swallow
    throw new RuntimeException(ex);
}
~~~

**\`shutdown\` vs \`shutdownNow\`:** \`shutdown()\` stops accepting new tasks and
waits for running ones to finish. \`shutdownNow()\` interrupts running threads
and returns the list of tasks that never started. Always call one of them —
without it the JVM will not exit because pool threads are non-daemon threads.

**Virtual threads (Java 21+):** \`Executors.newVirtualThreadPerTaskExecutor()\`
creates a lightweight virtual thread per task. Each may block freely without
wasting an OS thread. Use for I/O-bound work at scale; for CPU-bound work
\`newFixedThreadPool(Runtime.getRuntime().availableProcessors())\` remains the
right choice.`,
    },
  ],
  exercises: [
    {
      id: 'expr-eval',
      title: 'Arithmetic expression evaluator (sealed + pattern matching)',
      difficulty: 'core',
      prompt: `Model a small **arithmetic expression tree** with sealed types and evaluate it
using an **exhaustive, recursive pattern-matching switch**.

**Requirements:**

1. Declare \`sealed interface Expr permits Num, Neg, Add, Mul\`.
2. Declare four record implementations:
   - \`record Num(int value)\` — a literal integer.
   - \`record Neg(Expr operand)\` — unary negation.
   - \`record Add(Expr left, Expr right)\` — addition.
   - \`record Mul(Expr left, Expr right)\` — multiplication.
3. Write \`static int eval(Expr e)\` using a \`switch\` expression that:
   - Uses **record deconstruction patterns** on \`Add\` and \`Mul\` (decompose \`left\`/\`right\` directly in the pattern).
   - Requires **no \`default\` arm** because \`Expr\` is sealed.
4. Write \`static String pretty(Expr e)\` that renders the expression as a parenthesised string:
   - \`Num(3)\` → \`"3"\`
   - \`Neg(Num(3))\` → \`"(-3)"\`
   - \`Add(Num(1), Num(2))\` → \`"(1 + 2)"\`
   - \`Mul(Num(2), Add(Num(3), Num(4)))\` → \`"(2 * (3 + 4))"\`
5. In \`main\`, build and evaluate: \`(2 + 3) * -(4 + 1)\` and print the pretty form and result.

The expected result for \`(2 + 3) * -(4 + 1)\` is \`-25\`.`,
      starter: `public class ExprEval {

    sealed interface Expr permits Num, Neg, Add, Mul {}

    record Num(int value)                  implements Expr {}
    record Neg(Expr operand)               implements Expr {}
    record Add(Expr left, Expr right)      implements Expr {}
    record Mul(Expr left, Expr right)      implements Expr {}

    static int eval(Expr e) {
        // TODO: exhaustive switch with record deconstruction on Add and Mul
        // Hint: case Add(var l, var r) -> eval(l) + eval(r);
        return 0;
    }

    static String pretty(Expr e) {
        // TODO: exhaustive switch returning a String
        return "";
    }

    public static void main(String[] args) {
        // (2 + 3) * -(4 + 1)
        Expr expr = new Mul(
            new Add(new Num(2), new Num(3)),
            new Neg(new Add(new Num(4), new Num(1)))
        );
        System.out.println(pretty(expr));  // ((2 + 3) * (-(4 + 1)))
        System.out.println(eval(expr));    // -25
    }
}`,
      hints: [
        'Record deconstruction in a switch arm: \`case Add(var l, var r) -> eval(l) + eval(r);\` — the compiler binds \`l\` and \`r\` to the \`left\` and \`right\` components directly.',
        'For \`Neg\` you can use either a type pattern (\`case Neg n -> -eval(n.operand())\`) or deconstruction (\`case Neg(var op) -> -eval(op)\`).',
        'The compiler knows \`Expr\` has exactly four subtypes and all are covered, so no \`default\` is needed. Adding a fifth subtype later causes every switch that omits it to fail at compile time.',
      ],
      solution: `public class ExprEval {

    sealed interface Expr permits Num, Neg, Add, Mul {}

    record Num(int value)                  implements Expr {}
    record Neg(Expr operand)               implements Expr {}
    record Add(Expr left, Expr right)      implements Expr {}
    record Mul(Expr left, Expr right)      implements Expr {}

    static int eval(Expr e) {
        return switch (e) {
            case Num n               -> n.value();
            case Neg(var op)         -> -eval(op);
            case Add(var l, var r)   -> eval(l) + eval(r);
            case Mul(var l, var r)   -> eval(l) * eval(r);
        };
    }

    static String pretty(Expr e) {
        return switch (e) {
            case Num n               -> String.valueOf(n.value());
            case Neg(var op)         -> "(-" + pretty(op) + ")";
            case Add(var l, var r)   -> "(" + pretty(l) + " + " + pretty(r) + ")";
            case Mul(var l, var r)   -> "(" + pretty(l) + " * " + pretty(r) + ")";
        };
    }

    public static void main(String[] args) {
        // (2 + 3) * -(4 + 1)
        Expr expr = new Mul(
            new Add(new Num(2), new Num(3)),
            new Neg(new Add(new Num(4), new Num(1)))
        );
        System.out.println(pretty(expr));  // ((2 + 3) * (-(4 + 1)))
        System.out.println(eval(expr));    // -25

        // Additional check: individual forms
        System.out.println(eval(new Add(new Num(10), new Neg(new Num(3)))));  // 7
    }
}`,
      explanation: `The sealed interface closes the hierarchy: the compiler knows that every
\`Expr\` is exactly one of \`Num\`, \`Neg\`, \`Add\`, or \`Mul\`. The \`switch\` expression
in \`eval\` covers all four, so no \`default\` is required. If you add a fifth
variant (say \`Div\`) and forget to update \`eval\`, the compiler refuses to compile
— the error surfaces immediately, not at runtime.

Record deconstruction patterns (\`case Add(var l, var r)\`) bind the record's
components directly in the pattern clause. This is more concise than the
equivalent \`case Add a -> eval(a.left()) + eval(a.right())\` and makes the
recursive structure of the evaluation mirror the structure of the data.

The recursion terminates because every recursive call passes a strictly smaller
subexpression: \`Mul\` wraps \`Add\` wraps \`Num\` — the tree is finite and
acyclic. The approach generalises cleanly: add \`Sub\`, \`Div\`, or \`Pow\` and each
requires exactly one new arm in every switch.`,
    },
    {
      id: 'optional-pipeline',
      title: 'Optional pipeline — eliminating nested null checks',
      difficulty: 'core',
      prompt: `A typical data model has nested optional relationships: a \`User\` may have an
\`Address\`, which may have a \`City\`. Getting the city's postal code requires a
chain of null checks in pre-Java-8 style. Replace all of that with an Optional
pipeline.

**Given types (already provided in the starter):**

~~~java
record User(String name, Address address) {}       // address may be null
record Address(String street, City city) {}        // city may be null
record City(String name, String postalCode) {}     // postalCode may be null or blank
~~~

**Implement the following methods — no \`if\`, no \`isPresent()\`, no \`.get()\`:**

1. \`static Optional<String> postalCode(User user)\`
   — returns the user's postal code if the full chain exists, \`Optional.empty()\` otherwise.

2. \`static String displayPostalCode(User user)\`
   — returns the postal code in upper case, or \`"N/A"\` if not found or blank.

3. \`static String cityOrThrow(User user)\`
   — returns the city name or throws \`IllegalStateException("No city on record")\`.

**In \`main\` demonstrate all three on at least two users: one with a full chain and one with a gap in the chain.**

The key goal is the pipeline shape:
\`Optional.ofNullable(user.address()).flatMap(...).map(...).filter(...)\` — no branching.`,
      starter: `import java.util.Optional;

public class OptionalPipeline {

    record User(String name, Address address) {}
    record Address(String street, City city) {}
    record City(String name, String postalCode) {}

    static Optional<String> postalCode(User user) {
        // TODO: chain Optional.ofNullable -> flatMap -> flatMap -> map
        // Remember: address() and city() can be null, so use ofNullable at each step.
        return Optional.empty();
    }

    static String displayPostalCode(User user) {
        // TODO: postalCode(user).filter(blank guard).map(toUpperCase).orElse("N/A")
        return "";
    }

    static String cityOrThrow(User user) {
        // TODO: chain to city name, orElseThrow with a descriptive message
        return "";
    }

    public static void main(String[] args) {
        User full    = new User("Alice", new Address("Main St", new City("Berlin", "10115")));
        User noCity  = new User("Bob",   new Address("Oak Ave", null));
        User noAddr  = new User("Carol", null);

        System.out.println(displayPostalCode(full));    // 10115
        System.out.println(displayPostalCode(noCity));  // N/A
        System.out.println(displayPostalCode(noAddr));  // N/A

        System.out.println(cityOrThrow(full));          // Berlin
        try {
            cityOrThrow(noCity);
        } catch (IllegalStateException e) {
            System.out.println("Caught: " + e.getMessage());
        }
    }
}`,
      hints: [
        'Use \`flatMap\` when the mapping function itself returns an Optional: \`Optional.ofNullable(user.address()).flatMap(a -> Optional.ofNullable(a.city()))\` — if you used \`map\` here you would get \`Optional<Optional<City>>\`.',
        'Chain to postal code with a final \`map\`: \`.map(City::postalCode)\`. Then in \`displayPostalCode\` add \`.filter(s -> !s.isBlank())\` before \`.map(String::toUpperCase)\`.',
        'For \`cityOrThrow\`, stop the chain at the city step and call \`.orElseThrow(() -> new IllegalStateException("No city on record"))\`.',
      ],
      solution: `import java.util.Optional;

public class OptionalPipeline {

    record User(String name, Address address) {}
    record Address(String street, City city) {}
    record City(String name, String postalCode) {}

    static Optional<String> postalCode(User user) {
        return Optional.ofNullable(user.address())
                .flatMap(a -> Optional.ofNullable(a.city()))
                .map(City::postalCode);
    }

    static String displayPostalCode(User user) {
        return postalCode(user)
                .filter(s -> !s.isBlank())
                .map(String::toUpperCase)
                .orElse("N/A");
    }

    static String cityOrThrow(User user) {
        return Optional.ofNullable(user.address())
                .flatMap(a -> Optional.ofNullable(a.city()))
                .map(City::name)
                .orElseThrow(() -> new IllegalStateException("No city on record"));
    }

    public static void main(String[] args) {
        User full   = new User("Alice", new Address("Main St", new City("Berlin", "10115")));
        User noCity = new User("Bob",   new Address("Oak Ave", null));
        User noAddr = new User("Carol", null);

        System.out.println(displayPostalCode(full));    // 10115
        System.out.println(displayPostalCode(noCity));  // N/A
        System.out.println(displayPostalCode(noAddr));  // N/A

        System.out.println(cityOrThrow(full));          // Berlin
        try {
            cityOrThrow(noCity);
        } catch (IllegalStateException e) {
            System.out.println("Caught: " + e.getMessage());
        }
    }
}`,
      explanation: `The nested-null equivalent of \`postalCode\` would be:

~~~java
if (user.address() != null) {
    if (user.address().city() != null) {
        return user.address().city().postalCode();
    }
}
return null;
~~~

The Optional pipeline expresses the same logic without nesting and without
returning \`null\`. The critical method choice is \`flatMap\` vs \`map\`:
- \`map(a -> Optional.ofNullable(a.city()))\` would produce \`Optional<Optional<City>>\` — nested Optionals are useless.
- \`flatMap(a -> Optional.ofNullable(a.city()))\` flattens it to \`Optional<City>\`.

The \`filter(s -> !s.isBlank())\` step shows that Optional's pipeline handles
validation too — a blank postal code is treated the same as an absent one in
\`displayPostalCode\`.

\`orElseThrow\` with a \`Supplier\` is lazy: the exception is only constructed when
the Optional is empty, making it the right choice even when the exception message
is computed. Note that \`orElseThrow()\` with no arguments throws
\`NoSuchElementException\` — prefer the supplier form to give the caller a useful
message.`,
    },
    {
      id: 'race-condition-fix',
      title: 'Race condition: demonstrate and fix',
      difficulty: 'core',
      prompt: `Reproduce a race condition with a plain \`int\` counter, then fix it two ways:
with \`synchronized\` and with \`AtomicInteger\`.

**Part 1 — broken counter (just run it, observe the wrong result):**

Implement \`brokenCount()\` that launches **5 threads**, each incrementing a shared
\`int counter\` 100 000 times, then returns the final value. The expected result is
500 000 but the actual result will almost certainly be lower.

**Part 2 — synchronized fix:**

Implement \`syncCount()\` that does the same work but wraps the increment in a
\`synchronized\` block on a shared lock object. Result must always be 500 000.

**Part 3 — AtomicInteger fix:**

Implement \`atomicCount()\` that does the same work but uses an \`AtomicInteger\`
and \`incrementAndGet()\`. Result must always be 500 000.

**In \`main\`, call all three and print the results. Run several times to see that Part 1
is non-deterministic while Parts 2 and 3 are always correct.**

Constraints:
- Each method must join all threads before returning.
- Do not use \`ExecutorService\` — use raw \`Thread\` objects to keep the mechanics visible.`,
      starter: `import java.util.concurrent.atomic.AtomicInteger;

public class RaceDemo {

    static final int THREADS   = 5;
    static final int OPS_EACH  = 100_000;

    static int brokenCount() throws InterruptedException {
        // TODO: shared int counter (field or array trick), 5 threads each doing OPS_EACH++
        // Join all threads. Return final counter value.
        return 0;
    }

    static int syncCount() throws InterruptedException {
        // TODO: same, but synchronize on a lock object for each increment
        return 0;
    }

    static int atomicCount() throws InterruptedException {
        // TODO: same, but use AtomicInteger.incrementAndGet()
        return 0;
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println("Expected  : " + (THREADS * OPS_EACH));
        System.out.println("Broken    : " + brokenCount());
        System.out.println("Sync      : " + syncCount());
        System.out.println("Atomic    : " + atomicCount());
    }
}`,
      hints: [
        'To share a mutable \`int\` across lambdas, use a single-element \`int[] counter = {0}\` — the array reference is effectively final, the element inside is not.',
        'For the synchronized fix: \`Object lock = new Object();\` and in each thread: \`synchronized(lock) { counter[0]++; }\` — this serialises all increments.',
        'For AtomicInteger: \`AtomicInteger counter = new AtomicInteger(0);\`, then in each thread: \`counter.incrementAndGet();\` — no lock needed, hardware CAS handles it.',
      ],
      solution: `import java.util.concurrent.atomic.AtomicInteger;

public class RaceDemo {

    static final int THREADS   = 5;
    static final int OPS_EACH  = 100_000;

    static int brokenCount() throws InterruptedException {
        int[] counter = {0};   // array trick: reference is effectively final

        Thread[] threads = new Thread[THREADS];
        for (int i = 0; i < THREADS; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < OPS_EACH; j++) counter[0]++;  // RACE
            });
        }
        for (Thread t : threads) t.start();
        for (Thread t : threads) t.join();
        return counter[0];
    }

    static int syncCount() throws InterruptedException {
        int[] counter = {0};
        Object lock = new Object();

        Thread[] threads = new Thread[THREADS];
        for (int i = 0; i < THREADS; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < OPS_EACH; j++) {
                    synchronized (lock) { counter[0]++; }
                }
            });
        }
        for (Thread t : threads) t.start();
        for (Thread t : threads) t.join();
        return counter[0];
    }

    static int atomicCount() throws InterruptedException {
        AtomicInteger counter = new AtomicInteger(0);

        Thread[] threads = new Thread[THREADS];
        for (int i = 0; i < THREADS; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < OPS_EACH; j++) counter.incrementAndGet();
            });
        }
        for (Thread t : threads) t.start();
        for (Thread t : threads) t.join();
        return counter.get();
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println("Expected  : " + (THREADS * OPS_EACH));
        System.out.println("Broken    : " + brokenCount());
        System.out.println("Sync      : " + syncCount());
        System.out.println("Atomic    : " + atomicCount());
    }
}`,
      explanation: `\`counter[0]++\` is three JVM bytecodes: \`iaload\` (read), \`iadd\` (add 1),
\`iastore\` (write back). Two threads can both read the same value before either
writes back — one update is lost. With 5 threads each doing 100 000 increments,
millions of these interleaving windows exist; the result is consistently less
than 500 000 and varies between runs.

The \`int[]\` trick is necessary because lambdas require captured variables to be
effectively final — the array reference is final, but the element inside is
writable. A single-element array is the standard workaround for a mutable
closure variable.

\`synchronized(lock)\` serialises the three-instruction read-modify-write into an
atomic unit from the perspective of other threads. It also flushes CPU caches,
enforcing visibility. The cost is contention: all 5 threads compete for the same
lock.

\`AtomicInteger.incrementAndGet()\` uses a hardware compare-and-swap (CAS)
instruction that atomically checks if the current value equals the expected
value and, if so, updates it. No OS-level lock is acquired. CAS retries
automatically if another thread updates the value first, making it correct and
typically faster than \`synchronized\` for this specific pattern.

The lesson: for a simple counter, reach for \`AtomicInteger\`. For a larger
critical section that modifies multiple related fields together,
\`synchronized\` (or \`ReentrantLock\`) is the right tool.`,
    },
    {
      id: 'parallel-aggregation',
      title: 'Concurrent aggregation with ExecutorService',
      difficulty: 'challenge',
      prompt: `Compute the **sum of squares** of all integers from 1 to 8 000 000 in
parallel, split across an \`ExecutorService\` with 4 threads.

**Requirements:**

1. Implement \`static long sumOfSquaresRange(long from, long to)\` — sequential
   helper that sums \`i * i\` for \`from <= i < to\` (exclusive upper bound).

2. In \`main\`:
   a. Compute the answer **sequentially** (single call to \`sumOfSquaresRange\`)
      and record the wall-clock time with \`System.nanoTime()\`.
   b. Split the range \`[1, 8_000_001)\` into 4 equal chunks, create a
      \`Callable<Long>\` for each chunk, and submit them via \`invokeAll\`.
   c. Sum the \`Future<Long>\` results for the parallel total, recording time.
   d. Assert both totals are equal (print a \`PASS\`/\`FAIL\` line).
   e. Shut the executor down properly with \`shutdown\` + \`awaitTermination\`.

3. **Exception handling:** wrap the \`future.get()\` calls in a try-catch that:
   - On \`ExecutionException\`: prints the cause and rethrows as \`RuntimeException\`.
   - On \`InterruptedException\`: restores the interrupt flag and rethrows.

The **closed-form expected value** for sum of squares 1..n is \`n*(n+1)*(2n+1)/6\`.
For n = 8 000 000 the expected result is 170 666 693 333 336 000. Print it for
verification.

Do not use \`ForkJoinPool\` — use \`Executors.newFixedThreadPool\`.`,
      starter: `import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

public class ParallelSumOfSquares {

    static long sumOfSquaresRange(long from, long to) {
        // TODO: sum i*i for from <= i < to
        return 0L;
    }

    public static void main(String[] args) throws InterruptedException {
        final long N       = 8_000_000L;
        final int  THREADS = 4;
        final long CHUNK   = N / THREADS;   // 2_000_000

        // Sequential baseline
        long seqStart = System.nanoTime();
        long seqTotal = sumOfSquaresRange(1, N + 1);
        long seqMs    = (System.nanoTime() - seqStart) / 1_000_000;
        System.out.printf("Sequential : %d  (%d ms)%n", seqTotal, seqMs);

        // Expected closed-form: n*(n+1)*(2n+1)/6
        long expected = N * (N + 1) * (2 * N + 1) / 6;
        System.out.printf("Expected   : %d%n", expected);

        ExecutorService pool = Executors.newFixedThreadPool(THREADS);

        // TODO:
        // 1. Build List<Callable<Long>> of 4 tasks using sumOfSquaresRange
        // 2. invokeAll -> List<Future<Long>>
        // 3. Sum futures with proper InterruptedException / ExecutionException handling
        // 4. Shutdown pool
        // 5. Print parallel result, time, and PASS/FAIL

        long parTotal = 0L; // replace with actual result
        System.out.printf("Parallel   : %d%n", parTotal);
        System.out.println(seqTotal == parTotal ? "PASS" : "FAIL");
    }
}`,
      hints: [
        'Build the task list in a loop: \`long from = i * CHUNK + 1; long to = (i == THREADS - 1) ? N + 1 : from + CHUNK;\` — the last chunk catches any remainder when N is not perfectly divisible.',
        'Wrap \`future.get()\` in a try-catch: \`ExecutionException\` wraps the Callable\'s exception in \`ex.getCause()\`; for \`InterruptedException\` call \`Thread.currentThread().interrupt()\` before rethrowing to preserve the interrupt signal.',
        'The closed-form sum-of-squares for 1..8000000 overflows a 32-bit int — keep everything as \`long\` throughout. The intermediate product N*(N+1)*(2N+1) is about 1.0e21, which also overflows \`long\`; compute it as \`N * (N + 1) / 6 * (2 * N + 1)\` or use \`BigInteger\` just for the verification.',
      ],
      solution: `import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

public class ParallelSumOfSquares {

    static long sumOfSquaresRange(long from, long to) {
        long total = 0L;
        for (long i = from; i < to; i++) total += i * i;
        return total;
    }

    public static void main(String[] args) throws InterruptedException {
        final long N       = 8_000_000L;
        final int  THREADS = 4;
        final long CHUNK   = N / THREADS;

        // Sequential baseline
        long seqStart = System.nanoTime();
        long seqTotal = sumOfSquaresRange(1, N + 1);
        long seqMs    = (System.nanoTime() - seqStart) / 1_000_000;
        System.out.printf("Sequential : %d  (%d ms)%n", seqTotal, seqMs);

        // Closed-form: N*(N+1)*(2N+1)/6 — computed carefully to avoid long overflow
        // N/6 * (N+1) * (2N+1) works because N=8_000_000 is divisible by 6.
        long expected = (N / 6) * (N + 1) * (2 * N + 1);
        System.out.printf("Expected   : %d%n", expected);

        ExecutorService pool = Executors.newFixedThreadPool(THREADS);

        List<Callable<Long>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            final long from = i * CHUNK + 1;
            final long to   = (i == THREADS - 1) ? N + 1 : from + CHUNK;
            tasks.add(() -> sumOfSquaresRange(from, to));
        }

        long parStart = System.nanoTime();
        List<Future<Long>> futures;
        try {
            futures = pool.invokeAll(tasks);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw ex;
        }

        long parTotal = 0L;
        for (Future<Long> f : futures) {
            try {
                parTotal += f.get();
            } catch (ExecutionException ex) {
                System.err.println("Task failed: " + ex.getCause());
                throw new RuntimeException(ex.getCause());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw ex;
            }
        }
        long parMs = (System.nanoTime() - parStart) / 1_000_000;

        pool.shutdown();
        pool.awaitTermination(10, TimeUnit.SECONDS);

        System.out.printf("Parallel   : %d  (%d ms)%n", parTotal, parMs);
        System.out.println(seqTotal == parTotal ? "PASS" : "FAIL");
    }
}`,
      explanation: `The design principle is **task independence**: each \`Callable\` operates on a
disjoint numeric range and writes into its own local \`total\`. There is no
shared mutable state between tasks — no \`AtomicLong\`, no \`synchronized\`.
Independence is what makes the parallel version correct without any explicit
synchronisation.

\`invokeAll\` submits all tasks and returns only after every one has finished.
The returned \`List<Future<Long>>\` is in submission order, so iterating it and
calling \`f.get()\` is O(1) per call — all tasks have already completed. If a
task threw an exception, \`f.get()\` unwraps it from the \`ExecutionException\`
wrapper; the \`ex.getCause()\` call recovers the original exception.

The interrupt-flag discipline (\`Thread.currentThread().interrupt()\` before
rethrowing) is important: swallowing an \`InterruptedException\` without
restoring the flag silently cancels the interrupt signal for the calling thread.
Code higher up in the call stack that checks the flag (e.g. a blocking I/O
call) would never see the interrupt.

The off-by-one at the chunk boundary (\`to = N + 1\` for the last chunk) ensures
that every integer from 1 to N inclusive is covered exactly once. The
closed-form \`N/6 * (N+1) * (2N+1)\` is evaluated with integer division taken
first (\`N/6\`) because 8 000 000 is exactly divisible by 6, making the full
product fit in a \`long\`. For arbitrary N, use \`BigInteger\` or a mathematically
equivalent reordering.`,
    },
  ],
  takeaways: [
    '**Sealed interfaces** close the type hierarchy: add a variant and every switch that omits it fails at compile time — exhaustiveness is enforced, not hoped for.',
    '**Record deconstruction patterns** (\`case Add(var l, var r)\`) decompose record components directly in the switch arm, eliminating accessor calls and making recursive evaluators mirror the shape of the data.',
    '\`Optional\` is a **return-type contract**, not a null wrapper. Chain \`flatMap\`/\`map\`/\`filter\`/\`orElse\` declaratively; never use \`isPresent()\` + \`get()\`, and never use Optional as a field or parameter.',
    '\`counter++\` is **not atomic**: read-modify-write can interleave. Fix simple counters with \`AtomicInteger\`; use \`synchronized\` when a critical section spans multiple related state changes.',
    '**Task independence** is the cleanest concurrency pattern: design work units that operate on disjoint data, submit them via \`ExecutorService\`, and aggregate results in the main thread — no shared mutable state, no synchronisation needed.',
    'Always handle \`InterruptedException\` by restoring the interrupt flag (\`Thread.currentThread().interrupt()\`) before rethrowing — swallowing the exception silently cancels the signal for upstream callers.',
    '\`invokeAll\` + \`Future.get()\` is the idiom for fork-join work: submit all tasks, collect futures in order, call \`get()\` on each (instant after \`invokeAll\` returns), always call \`pool.shutdown()\` to let the JVM exit.',
  ],
}
