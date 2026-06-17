import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.

export const lab08: Lab = {
  id: 'lab-08',
  number: 8,
  title: 'Design Patterns I — Creational & Structural',
  subtitle: 'Singleton (IODH & volatile), Builder (validation), Adapter, Decorator chain — trade-offs and anti-patterns',
  estimatedHours: 6,
  concepts: [
    'Singleton',
    'initialization-on-demand holder',
    'volatile',
    'Builder',
    'validation in build()',
    'Adapter',
    'Decorator',
    'SOLID',
    'Open/Closed Principle',
    'composition over inheritance',
  ],
  overview: `You already know what a design pattern is. This lab skips the Wikipedia tour
and goes straight to the parts that matter in code reviews and interviews:

- **When** each pattern is warranted (and when it is overkill)
- **Why** the naive implementation breaks under concurrency or edge inputs
- **Trade-offs** that interviewers probe — e.g. double-checked locking without \`volatile\`,
  Builder required vs. optional fields, Decorator vs. subclassing

The exercises are realistic implementations at mid-interview depth: thread-safe lazy
Singleton via the Initialization-on-Demand Holder idiom, a fluent Builder that centralises
validation in \`build()\`, a data-source Decorator chain (echoing \`java.io\`), and an Adapter
bridging a legacy interface to a modern target. Each one has a deliberate subtle part —
the part most candidates get wrong.`,
  theory: [
    {
      id: 'patterns-why',
      heading: 'What patterns actually give you — and what they cost',
      body: `Design patterns are **named, proven solutions to recurring design problems**. The GoF
catalogue (1994) groups them into three categories; this lab covers two:

| Category | Patterns covered | Core question they answer |
|----------|-----------------|--------------------------|
| **Creational** | Singleton, Builder | *How* and *when* are objects created? |
| **Structural** | Adapter, Decorator | *How* are objects composed at runtime? |

**Three concrete benefits:**

1. **Shared vocabulary** — "We used the Decorator here" conveys the full structural
   intent without a diagram.
2. **Battle-tested structure** — The pattern already handled the common edge cases so
   you don't rediscover them.
3. **Predictable trade-offs** — Each pattern has documented costs you can weigh consciously.

**The hidden cost interviewers look for:** indirection. Every pattern adds at least one
layer of abstraction. If you cannot name the *specific friction* the pattern removes, you
are probably over-engineering.

### SOLID touchpoints

The patterns in this lab map to SOLID principles:

- **Singleton** — can *violate* Single Responsibility by becoming a global grab-bag;
  prefer dependency injection so objects are testable.
- **Builder** — upholds SRP by moving construction logic out of the class body.
- **Adapter** — upholds Dependency Inversion by letting high-level code depend on a
  target interface, not a legacy concrete class.
- **Decorator** — upholds the Open/Closed Principle: extend behaviour by wrapping,
  not by modifying.`,
    },
    {
      id: 'singleton',
      heading: 'Singleton — why naive implementations break and two correct idioms',
      body: `**Intent:** guarantee exactly one instance of a class, with a global access point.

### The broken double-checked locking (interview trap)

This code *looks* correct but has a data race on JDK < 5 and is still **undefined behaviour**
without \`volatile\`:

~~~java
// BROKEN — do not use
public final class Broken {
    private static Broken instance;          // no volatile!

    private Broken() {}

    public static Broken getInstance() {
        if (instance == null) {
            synchronized (Broken.class) {
                if (instance == null) {
                    instance = new Broken(); // (1) allocate, (2) init, (3) publish
                }
            }
        }
        return instance;
    }
}
~~~

The JVM (and CPU) may reorder (3) before (2): another thread reads a non-null but
**partially-initialised** reference. The fix is \`private static volatile Broken instance;\` —
\`volatile\` establishes a happens-before edge so every thread sees the fully-initialised
object.

### Correct DCL with volatile

~~~java
public final class ConnectionPool {
    private static volatile ConnectionPool instance;   // volatile is mandatory

    private ConnectionPool() { /* expensive setup */ }

    public static ConnectionPool getInstance() {
        if (instance == null) {                       // fast path — no lock
            synchronized (ConnectionPool.class) {
                if (instance == null) {               // recheck inside lock
                    instance = new ConnectionPool();
                }
            }
        }
        return instance;
    }
}
~~~

The first null-check avoids synchronisation on every call once the instance exists.
The second null-check inside the lock prevents a race between two threads that both
passed the first check concurrently.

### Initialization-on-Demand Holder (IODH) — preferred for lazy singletons

A simpler, lock-free alternative that relies on the JVM class-loading contract:

~~~java
public final class ConnectionPool {

    private ConnectionPool() { /* expensive setup */ }

    // Static inner class is loaded lazily by the JVM — only when first referenced.
    // Class initialisation is guaranteed thread-safe by the JVM spec.
    private static final class Holder {
        static final ConnectionPool INSTANCE = new ConnectionPool();
    }

    public static ConnectionPool getInstance() {
        return Holder.INSTANCE;   // triggers class load on first call, never again
    }
}
~~~

**Why it is better than DCL:** no \`volatile\` needed, no explicit synchronisation,
impossible to observe a partially-constructed instance. The JVM class-initialisation
lock guarantees that \`Holder.INSTANCE\` is fully constructed before \`getInstance()\`
returns to any caller, in any thread.

### When to reach for each form

| Situation | Recommended form |
|-----------|-----------------|
| Stateless or cheaply initialised | \`public enum Foo { INSTANCE; }\` |
| Lazy + expensive initialisation | Initialization-on-Demand Holder |
| Legacy code with explicit \`volatile\` | Double-checked locking (add \`volatile\`!) |
| Testable / injectable | Neither — pass as a constructor argument |

### Anti-pattern: Singleton as a global grab-bag

The biggest Singleton abuse is adding unrelated state to it because "it's already global":

~~~java
// AVOID — SRP violation
public enum AppSingleton {
    INSTANCE;
    public Config config;
    public Database db;
    public MetricsCollector metrics;  // unrelated things piling up
}
~~~

Each concern should be its own injectable dependency, not a field on a singleton.`,
    },
    {
      id: 'builder',
      heading: 'Builder — required vs. optional fields and validation in build()',
      body: `**Intent:** Construct a complex object step-by-step, keeping the product immutable
and the construction logic out of the product class.

### The telescoping-constructor anti-pattern

~~~java
// AVOID — which int is maxRetries and which is timeoutMs?
new HttpClient("https://api.example.com", null, 30_000, 3, true, false, null);
~~~

Six positional arguments, four are optional, all look the same to the compiler. The
Builder pattern makes the call-site self-documenting and compiler-enforced.

### Required vs. optional fields

The canonical rule:
- **Required fields** go in the \`Builder\` constructor — the compiler refuses to compile
  a call that omits them.
- **Optional fields** are declared with defaults on the \`Builder\` — callers only override
  what differs.

~~~java
public final class HttpClient {
    // product fields — all final for immutability
    private final String  baseUrl;         // required
    private final int     timeoutMs;       // optional, default 10_000
    private final int     maxRetries;      // optional, default 0
    private final boolean followRedirects; // optional, default true

    private HttpClient(Builder b) {
        this.baseUrl         = b.baseUrl;
        this.timeoutMs       = b.timeoutMs;
        this.maxRetries      = b.maxRetries;
        this.followRedirects = b.followRedirects;
    }

    public static final class Builder {
        private final String baseUrl;            // required — set by constructor
        private int     timeoutMs       = 10_000;
        private int     maxRetries      = 0;
        private boolean followRedirects = true;

        public Builder(String baseUrl) {
            if (baseUrl == null || baseUrl.isBlank())
                throw new IllegalArgumentException("baseUrl is required");
            this.baseUrl = baseUrl;
        }

        public Builder timeoutMs(int ms)               { this.timeoutMs = ms;      return this; }
        public Builder maxRetries(int r)               { this.maxRetries = r;       return this; }
        public Builder followRedirects(boolean f)      { this.followRedirects = f;  return this; }

        public HttpClient build() {
            // cross-field validation belongs here, not in setters
            if (timeoutMs <= 0)    throw new IllegalArgumentException("timeoutMs must be > 0");
            if (maxRetries < 0)    throw new IllegalArgumentException("maxRetries must be >= 0");
            return new HttpClient(this);
        }
    }
}

// Usage — reads like prose, impossible to confuse args:
HttpClient client = new HttpClient.Builder("https://api.example.com")
        .timeoutMs(30_000)
        .maxRetries(3)
        .build();
~~~

### Why validation belongs in build(), not in setters

Setters run one field at a time, so they cannot validate **relationships** between
fields. Only \`build()\` sees the complete picture:

~~~java
public HttpClient build() {
    if (maxRetries > 0 && timeoutMs < 1_000)
        throw new IllegalArgumentException(
            "Retries with a sub-second timeout cause rapid hammering; raise timeoutMs");
    return new HttpClient(this);
}
~~~

This is impossible to enforce in individual setters. Centralising it in \`build()\`
also gives you a single test target for all invalid-combination cases.`,
    },
    {
      id: 'adapter',
      heading: 'Adapter — bridging incompatible interfaces without touching either side',
      body: `**Intent:** Convert the interface of a class into another interface that clients
expect. Adapter lets classes with incompatible interfaces collaborate.

**When to reach for it:** you have a *legacy class* (or a third-party library) with a
useful implementation but the wrong interface, and you cannot change either side.

### Object adapter (composition — preferred)

~~~java
// ---- Adaptee: legacy payment gateway, interface you cannot change ----
public class LegacyPaymentGateway {
    public boolean charge(long amountCents, String cardToken) {
        // legacy implementation
        System.out.printf("Charging %d cents to token %s%n", amountCents, cardToken);
        return true;
    }
}

// ---- Target: the interface the rest of your system depends on ----
public interface PaymentProcessor {
    void processPayment(double amountGbp, String cardToken);
}

// ---- Adapter: wraps the legacy class, exposes the target interface ----
public final class LegacyPaymentAdapter implements PaymentProcessor {
    private final LegacyPaymentGateway gateway;

    public LegacyPaymentAdapter(LegacyPaymentGateway gateway) {
        this.gateway = gateway;
    }

    @Override
    public void processPayment(double amountGbp, String cardToken) {
        long cents = Math.round(amountGbp * 100);   // unit conversion is the adapter's job
        boolean ok = gateway.charge(cents, cardToken);
        if (!ok) throw new RuntimeException("Payment failed for token " + cardToken);
    }
}
~~~

Callers depend only on \`PaymentProcessor\`. Swapping the underlying gateway means writing
a new Adapter, not editing every call site. This is Dependency Inversion in practice.

### JDK examples

- \`java.io.InputStreamReader\` — adapts a byte-oriented \`InputStream\` to a
  character-oriented \`Reader\`.
- \`Arrays.asList(T[] a)\` — adapts a plain array to the \`List<T>\` interface.
- \`Collections.enumeration(Collection<E>)\` — adapts a \`Collection\` to the legacy
  \`Enumeration\` interface.

### Object adapter vs. class adapter

An *object adapter* wraps the adaptee (has-a). A *class adapter* extends the adaptee
(is-a), which in Java requires the adaptee to not be \`final\`. Prefer object adapters:
they work with any class, play well with dependency injection, and are easier to test
(you can mock the adaptee).`,
    },
    {
      id: 'decorator',
      heading: 'Decorator — composing behaviour at runtime without subclassing',
      body: `**Intent:** Attach additional responsibilities to an object dynamically. Decorators
offer a flexible alternative to subclassing for extending functionality.

**The inheritance explosion problem:**

Suppose you have an \`InputStream\` and want to add: (a) buffering, (b) compression, (c)
encryption — independently composable. Subclassing produces:
\`BufferedInputStream\`, \`CompressedInputStream\`, \`EncryptedInputStream\`,
\`BufferedCompressedInputStream\`, \`BufferedEncryptedInputStream\`, \`CompressedEncryptedInputStream\`,
\`BufferedCompressedEncryptedInputStream\` — 7 classes for 3 features. With N features it
is 2^N classes. The Decorator pattern handles the same with exactly N decorator classes.

### Structure

~~~java
// ---- Component interface ----
public interface DataSource {
    void write(String data);
    String read();
    String getDescription();
}

// ---- Concrete component ----
public final class FileDataSource implements DataSource {
    private final String filename;
    private String contents = "";

    public FileDataSource(String filename) { this.filename = filename; }

    @Override public void   write(String data) { this.contents = data; }
    @Override public String read()             { return contents; }
    @Override public String getDescription()   { return "File(" + filename + ")"; }
}

// ---- Abstract decorator — implements + wraps the same interface ----
public abstract class DataSourceDecorator implements DataSource {
    protected final DataSource wrapped;
    protected DataSourceDecorator(DataSource wrapped) { this.wrapped = wrapped; }

    @Override public void   write(String data) { wrapped.write(data); }
    @Override public String read()             { return wrapped.read(); }
    @Override public String getDescription()   { return wrapped.getDescription(); }
}

// ---- Concrete decorators ----
public final class BufferedDataSource extends DataSourceDecorator {
    public BufferedDataSource(DataSource ds) { super(ds); }
    @Override public String getDescription() { return "Buffered(" + wrapped.getDescription() + ")"; }
    // real impl would batch writes; here we just show the pattern
}

public final class CompressionDataSource extends DataSourceDecorator {
    public CompressionDataSource(DataSource ds) { super(ds); }
    @Override public String getDescription() { return "Compressed(" + wrapped.getDescription() + ")"; }
    @Override public void write(String data) { wrapped.write("[compressed]" + data); }
    @Override public String read()           { return wrapped.read().replace("[compressed]", ""); }
}

public final class EncryptionDataSource extends DataSourceDecorator {
    public EncryptionDataSource(DataSource ds) { super(ds); }
    @Override public String getDescription() { return "Encrypted(" + wrapped.getDescription() + ")"; }
    @Override public void write(String data) { wrapped.write("[enc]" + data); }
    @Override public String read()           { return wrapped.read().replace("[enc]", ""); }
}
~~~

Stack any combination at runtime:

~~~java
DataSource ds = new EncryptionDataSource(
                    new CompressionDataSource(
                        new BufferedDataSource(
                            new FileDataSource("report.txt"))));

ds.write("sales data");
System.out.println(ds.getDescription());
// Encrypted(Compressed(Buffered(File(report.txt))))
~~~

**The decorator invariant:** every decorator *is a* \`DataSource\` (implements the interface)
AND *has a* \`DataSource\` (wraps one). This makes any decorator transparently substitutable
for any other, regardless of chain depth. The JDK \`java.io\` package is built exactly on
this pattern: \`BufferedInputStream\`, \`GZIPInputStream\`, \`CipherInputStream\` are all
\`InputStream\` decorators.

### Decorator vs. subclassing — when to choose

| Factor | Subclassing | Decorator |
|--------|-------------|-----------|
| Known, fixed number of combinations | Fine | Overkill |
| Independent features that must compose freely | Class explosion | Ideal |
| Add behaviour to a class you cannot extend | Impossible | Possible |
| Runtime choice of features | Impossible | Natural |`,
    },
    {
      id: 'anti-patterns',
      heading: 'Anti-patterns and the over-engineering trap',
      body: `Every pattern has a failure mode — applying it where it adds more complexity than it removes.

| Pattern | Common abuse | Signal it's wrong |
|---------|-------------|-------------------|
| **Singleton** | Used for every "utility" class; turns into global mutable state | If you'd pass it as a constructor arg, do that instead |
| **Builder** | Applied to a two-field immutable record | A record or two-param constructor is clearer |
| **Adapter** | Used when you own both sides of the mismatch | Fix the interface directly instead |
| **Decorator** | Six-deep chain for a simple one-off transformation | A plain method call or a single subclass is clearer |

### The three-question test

Before adding a pattern, answer:

1. **What specific friction does this remove today?** (If you can't name it, don't add the pattern.)
2. **What does it cost** — extra files, indirection, harder debugging?
3. **Is there a simpler path** that covers 90% of the need?

Patterns are tools for solving real problems, not trophies for demonstrating knowledge.`,
    },
  ],
  exercises: [
    {
      id: 'iodh-singleton',
      title: 'Lazy thread-safe Singleton via the Initialization-on-Demand Holder idiom',
      difficulty: 'core',
      prompt: `Implement a \`MetricsRegistry\` Singleton that is **lazily initialised** and
**thread-safe without using \`synchronized\` or \`volatile\`** by applying the
**Initialization-on-Demand Holder (IODH)** idiom.

Requirements:

1. The registry holds a \`Map<String, Long>\` of named counters.
2. \`void increment(String name)\` — add 1 to the named counter (create it at 0 first if absent).
3. \`long get(String name)\` — return the current value, or 0 if never incremented.
4. \`Map<String, Long> snapshot()\` — return an **unmodifiable copy** of all counters.
5. \`static MetricsRegistry getInstance()\` using the holder idiom.

Additionally, in a comment block directly above the holder class, write **2–3 sentences**
explaining why this idiom is safe without explicit synchronisation.

Write a \`main\` that:
- Calls \`increment("requests")\` three times and \`increment("errors")\` once.
- Verifies the same instance is returned by two \`getInstance()\` calls (\`==\`).
- Prints the snapshot.

Expected output:

~~~text
Same instance: true
{errors=1, requests=3}
~~~`,
      starter: `import java.util.HashMap;
import java.util.Map;
import java.util.Collections;

public final class MetricsRegistry {

    private final Map<String, Long> counters = new HashMap<>();

    private MetricsRegistry() {
        // expensive: imagine loading initial state from a database
    }

    // TODO: implement increment(String name)

    // TODO: implement get(String name)

    // TODO: implement snapshot()

    // TODO: add a 2-3 sentence comment block explaining IODH safety,
    //       then declare the private static final class Holder { ... }

    public static MetricsRegistry getInstance() {
        // TODO: return Holder.INSTANCE
        return null;
    }

    public static void main(String[] args) {
        MetricsRegistry a = MetricsRegistry.getInstance();
        MetricsRegistry b = MetricsRegistry.getInstance();

        a.increment("requests");
        a.increment("requests");
        a.increment("requests");
        a.increment("errors");

        System.out.println("Same instance: " + (a == b));
        System.out.println(a.snapshot());
    }
}`,
      hints: [
        'The Holder pattern: declare a private static final inner class with a single static final field: static final MetricsRegistry INSTANCE = new MetricsRegistry();. The JVM only loads (and initialises) a class the first time it is referenced, and class initialisation is guaranteed to complete before any thread can read the class\'s static fields.',
        'The safety argument: the JVM specification (§12.4) guarantees that class initialisation is single-threaded and fully-visible to all threads that subsequently read the class. No explicit lock is needed because the JVM\'s class-loading lock does the job implicitly.',
        'For snapshot(), use Collections.unmodifiableMap(new HashMap<>(counters)) — the defensive copy prevents callers from seeing later mutations; unmodifiableMap prevents them from mutating the copy.',
      ],
      solution: `import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class MetricsRegistry {

    private final Map<String, Long> counters = new HashMap<>();

    private MetricsRegistry() {}

    public void increment(String name) {
        counters.merge(name, 1L, Long::sum);
    }

    public long get(String name) {
        return counters.getOrDefault(name, 0L);
    }

    public Map<String, Long> snapshot() {
        // defensive copy so callers cannot observe future mutations,
        // wrapped in unmodifiableMap so they cannot mutate the copy either
        return Collections.unmodifiableMap(new HashMap<>(counters));
    }

    // The JVM loads a class only when it is first actively used (JLS §12.4.1).
    // Holder is never referenced until getInstance() is called, so MetricsRegistry
    // is not constructed until that moment — lazy initialisation for free.
    // The JVM's class-initialisation lock guarantees the static field assignment
    // completes and is fully visible before any thread can read INSTANCE.
    private static final class Holder {
        static final MetricsRegistry INSTANCE = new MetricsRegistry();
    }

    public static MetricsRegistry getInstance() {
        return Holder.INSTANCE;
    }

    public static void main(String[] args) {
        MetricsRegistry a = MetricsRegistry.getInstance();
        MetricsRegistry b = MetricsRegistry.getInstance();

        a.increment("requests");
        a.increment("requests");
        a.increment("requests");
        a.increment("errors");

        System.out.println("Same instance: " + (a == b));
        System.out.println(a.snapshot());
    }
}`,
      explanation: `**Why IODH is correct without \`synchronized\` or \`volatile\`:**
The JVM specification (§12.4.2) mandates that class initialisation is sequentially
performed by the first thread that references a class, and that all subsequent threads
observe the fully-initialised state via the class-loading lock. \`Holder\` is a distinct
class from \`MetricsRegistry\`, so it is only loaded when \`Holder.INSTANCE\` is first
referenced — inside \`getInstance()\`. Until that point, the holder class does not exist
in the JVM at all. Once it is loaded, \`INSTANCE\` is fully visible to every thread.

**Why not just use \`volatile\` DCL?** IODH is strictly simpler: fewer moving parts, no
\`volatile\` keyword to forget, and the concurrency correctness does not depend on your
memory of the Java Memory Model. The trade-off is that it only works when the singleton
has no dependencies that are known only at runtime — if construction needs arguments,
you must use DCL with \`volatile\`.

**The \`snapshot()\` implementation** illustrates defensive copying: \`new HashMap<>(counters)\`
takes a point-in-time copy so the snapshot cannot diverge from later increments, and
\`Collections.unmodifiableMap\` prevents the caller from mutating it. This two-layer
defence is the standard JDK idiom for exposing internal collections read-only.`,
    },
    {
      id: 'builder-http-request',
      title: 'Builder with required fields, optional fields, and cross-field validation',
      difficulty: 'core',
      prompt: `Design an immutable \`HttpRequest\` class using the Builder pattern.

**Required fields** (enforced by the Builder constructor):
- \`method\` — one of \`"GET"\`, \`"POST"\`, \`"PUT"\`, \`"DELETE"\`, \`"PATCH"\`
- \`url\` — a non-blank URL string

**Optional fields** with defaults:
- \`body\` — \`String\`, default \`null\`
- \`timeoutMs\` — \`int\`, default \`10_000\`
- \`maxRetries\` — \`int\`, default \`0\`
- \`followRedirects\` — \`boolean\`, default \`true\`

**Validation rules (all enforced inside \`build()\`)**:
1. \`"GET"\` and \`"DELETE"\` requests must have a \`null\` body — throw \`IllegalStateException\`.
2. \`"POST"\` and \`"PUT"\` requests must have a non-null, non-blank body — throw \`IllegalStateException\`.
3. \`timeoutMs\` must be > 0.
4. \`maxRetries\` must be in [0, 10].

Provide a \`toString()\` like:

~~~text
HttpRequest{GET https://api.example.com/users, timeout=10000ms, retries=0}
~~~

Write a \`main\` that:
- Builds and prints a valid GET and a valid POST.
- Attempts to build a GET with a body and catches the \`IllegalStateException\`, printing its message.`,
      starter: `public final class HttpRequest {

    private final String  method;
    private final String  url;
    private final String  body;
    private final int     timeoutMs;
    private final int     maxRetries;
    private final boolean followRedirects;

    private HttpRequest(Builder b) {
        // TODO: assign all fields from b
    }

    // TODO: add getters

    @Override
    public String toString() {
        // TODO: HttpRequest{GET https://..., timeout=Xms, retries=Y}
        return "";
    }

    public static final class Builder {
        // required
        private final String method;
        private final String url;
        // optional with defaults
        private String  body            = null;
        private int     timeoutMs       = 10_000;
        private int     maxRetries      = 0;
        private boolean followRedirects = true;

        public Builder(String method, String url) {
            // TODO: validate method (whitelist) and url (non-blank), assign
        }

        // TODO: fluent setters for body, timeoutMs, maxRetries, followRedirects

        public HttpRequest build() {
            // TODO: enforce the four cross-field / range validation rules, then return new HttpRequest(this)
            return null;
        }
    }

    public static void main(String[] args) {
        // TODO: build and print valid GET and POST
        // TODO: attempt GET with body, catch IllegalStateException, print message
    }
}`,
      hints: [
        'In the Builder constructor, check that method is one of the allowed values using a Set or a switch — throw IllegalArgumentException for an unknown method. Check that url is not null and not blank.',
        'In build(), the method-body rules are cross-field: you need to see both method and body at the same time. That\'s why they live in build() rather than in the body() setter — the setter cannot know the method.',
        'For the allowed-methods whitelist: private static final Set<String> ALLOWED = Set.of("GET", "POST", "PUT", "DELETE", "PATCH"); then if (!ALLOWED.contains(method)) throw ...',
      ],
      solution: `import java.util.Set;

public final class HttpRequest {

    private static final Set<String> BODY_FORBIDDEN = Set.of("GET", "DELETE");
    private static final Set<String> BODY_REQUIRED  = Set.of("POST", "PUT");
    private static final Set<String> ALLOWED_METHODS =
            Set.of("GET", "POST", "PUT", "DELETE", "PATCH");

    private final String  method;
    private final String  url;
    private final String  body;
    private final int     timeoutMs;
    private final int     maxRetries;
    private final boolean followRedirects;

    private HttpRequest(Builder b) {
        this.method          = b.method;
        this.url             = b.url;
        this.body            = b.body;
        this.timeoutMs       = b.timeoutMs;
        this.maxRetries      = b.maxRetries;
        this.followRedirects = b.followRedirects;
    }

    public String  getMethod()          { return method; }
    public String  getUrl()             { return url; }
    public String  getBody()            { return body; }
    public int     getTimeoutMs()       { return timeoutMs; }
    public int     getMaxRetries()      { return maxRetries; }
    public boolean isFollowRedirects()  { return followRedirects; }

    @Override
    public String toString() {
        return "HttpRequest{" + method + " " + url
                + ", timeout=" + timeoutMs + "ms"
                + ", retries=" + maxRetries + "}";
    }

    public static final class Builder {
        private final String method;
        private final String url;
        private String  body            = null;
        private int     timeoutMs       = 10_000;
        private int     maxRetries      = 0;
        private boolean followRedirects = true;

        public Builder(String method, String url) {
            if (method == null || !ALLOWED_METHODS.contains(method.toUpperCase()))
                throw new IllegalArgumentException("Unknown HTTP method: " + method);
            if (url == null || url.isBlank())
                throw new IllegalArgumentException("url must not be blank");
            this.method = method.toUpperCase();
            this.url    = url;
        }

        public Builder body(String body)                  { this.body = body;             return this; }
        public Builder timeoutMs(int ms)                  { this.timeoutMs = ms;           return this; }
        public Builder maxRetries(int r)                  { this.maxRetries = r;           return this; }
        public Builder followRedirects(boolean f)         { this.followRedirects = f;      return this; }

        public HttpRequest build() {
            if (timeoutMs <= 0)
                throw new IllegalArgumentException("timeoutMs must be > 0");
            if (maxRetries < 0 || maxRetries > 10)
                throw new IllegalArgumentException("maxRetries must be in [0, 10]");
            if (BODY_FORBIDDEN.contains(method) && body != null)
                throw new IllegalStateException(method + " requests must not have a body");
            if (BODY_REQUIRED.contains(method) && (body == null || body.isBlank()))
                throw new IllegalStateException(method + " requests require a non-blank body");
            return new HttpRequest(this);
        }
    }

    public static void main(String[] args) {
        HttpRequest get = new Builder("GET", "https://api.example.com/users")
                .timeoutMs(5_000)
                .build();
        System.out.println(get);

        HttpRequest post = new Builder("POST", "https://api.example.com/users")
                .body("{\\"name\\":\\"Alice\\"}")
                .timeoutMs(15_000)
                .maxRetries(3)
                .build();
        System.out.println(post);

        try {
            new Builder("GET", "https://api.example.com/users")
                    .body("should not be here")
                    .build();
        } catch (IllegalStateException e) {
            System.out.println("Caught: " + e.getMessage());
        }
    }
}`,
      explanation: `**Why validation belongs in \`build()\` and not in the setters:**
The method-body rules are *relationships* between two fields. The \`body()\` setter
knows the body but not the method; the \`Builder(method, url)\` constructor knows the
method but not the body yet. Only \`build()\` has both in scope simultaneously.
Centralising all rules there also gives you a **single, predictable test target**: write
one test per invalid combination and point them all at \`build()\`.

**The allowed-methods \`Set\` whitelist** is the idiomatic Java approach: O(1) lookup,
easily extended, no chained \`||s\`. Moving the sets to static constants on the outer
class (\`BODY_FORBIDDEN\`, \`BODY_REQUIRED\`) makes both the Builder and future readers
see the intent immediately.

**Required vs. optional enforcement at the API level:** the Builder constructor signature
\`(String method, String url)\` makes it a **compile-time error** to omit method or url.
The \`body\`, \`timeoutMs\`, \`maxRetries\`, and \`followRedirects\` fields on the Builder class
have defaults, so a call with only method + url is valid. This split is the most important
structural decision in Builder design.`,
    },
    {
      id: 'adapter-analytics',
      title: 'Adapter — bridging a legacy analytics client to a modern interface',
      difficulty: 'core',
      prompt: `Your codebase uses a \`TrackingService\` interface across dozens of call sites:

~~~java
public interface TrackingService {
    /** Track a named event with an optional string payload. */
    void track(String eventName, String payload);

    /** Track a timing measurement in milliseconds. */
    void trackTiming(String operation, long durationMs);
}
~~~

You have acquired a third-party \`LegacyAnalyticsClient\` that you cannot modify:

~~~java
public final class LegacyAnalyticsClient {
    // Sends a raw analytics hit.
    // category:  broad grouping (e.g. "event", "timing")
    // action:    specific action name
    // label:     optional free-form string (may be null)
    // value:     integer value, or -1 if not applicable
    public void send(String category, String action, String label, int value) {
        System.out.printf("ANALYTICS category=%s action=%s label=%s value=%d%n",
                category, action, label, value);
    }
}
~~~

**Task:** Write \`LegacyAnalyticsAdapter implements TrackingService\` that wraps
\`LegacyAnalyticsClient\` and satisfies \`TrackingService\` by mapping:

- \`track(name, payload)\` → \`send("event", name, payload, -1)\`
- \`trackTiming(op, durationMs)\` → \`send("timing", op, null, (int) durationMs)\` — clamp
  \`durationMs\` to \`Integer.MAX_VALUE\` if it exceeds it, do not throw.

Write a \`main\` that creates the adapter and calls both methods through the
\`TrackingService\` interface (so the adapter variable is typed as \`TrackingService\`).

Expected output:

~~~text
ANALYTICS category=event action=page_view label=homepage value=-1
ANALYTICS category=timing action=db_query label=null value=42
~~~`,
      starter: `public final class LegacyAnalyticsClient {
    public void send(String category, String action, String label, int value) {
        System.out.printf("ANALYTICS category=%s action=%s label=%s value=%d%n",
                category, action, label, value);
    }
}

public interface TrackingService {
    void track(String eventName, String payload);
    void trackTiming(String operation, long durationMs);
}

public final class LegacyAnalyticsAdapter implements TrackingService {

    private final LegacyAnalyticsClient client;

    public LegacyAnalyticsAdapter(LegacyAnalyticsClient client) {
        // TODO: assign
    }

    @Override
    public void track(String eventName, String payload) {
        // TODO: delegate to client.send(...) with the correct mapping
    }

    @Override
    public void trackTiming(String operation, long durationMs) {
        // TODO: delegate, clamping durationMs to Integer.MAX_VALUE if needed
    }

    public static void main(String[] args) {
        TrackingService tracker = new LegacyAnalyticsAdapter(new LegacyAnalyticsClient());
        // TODO: call track and trackTiming
    }
}`,
      hints: [
        'The adapter\'s job is pure translation. Do not add business logic — that belongs in callers. Keep each override a single delegation call plus a data conversion.',
        'Clamping: int safeValue = durationMs > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) durationMs; — the cast is safe only after the guard.',
        'The variable in main should be typed as TrackingService, not LegacyAnalyticsAdapter. This is the whole point: the adapter is invisible to callers.',
      ],
      solution: `public class AnalyticsDemo {

    public static final class LegacyAnalyticsClient {
        public void send(String category, String action, String label, int value) {
            System.out.printf("ANALYTICS category=%s action=%s label=%s value=%d%n",
                    category, action, label, value);
        }
    }

    public interface TrackingService {
        void track(String eventName, String payload);
        void trackTiming(String operation, long durationMs);
    }

    public static final class LegacyAnalyticsAdapter implements TrackingService {
        private final LegacyAnalyticsClient client;

        public LegacyAnalyticsAdapter(LegacyAnalyticsClient client) {
            if (client == null) throw new IllegalArgumentException("client must not be null");
            this.client = client;
        }

        @Override
        public void track(String eventName, String payload) {
            client.send("event", eventName, payload, -1);
        }

        @Override
        public void trackTiming(String operation, long durationMs) {
            int safeValue = durationMs > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) durationMs;
            client.send("timing", operation, null, safeValue);
        }
    }

    public static void main(String[] args) {
        TrackingService tracker =
                new LegacyAnalyticsAdapter(new LegacyAnalyticsClient());

        tracker.track("page_view", "homepage");
        tracker.trackTiming("db_query", 42L);
    }
}`,
      explanation: `**The adapter's only job is translation.** It converts the target interface method
signature (\`track\`, \`trackTiming\`) into the adaptee's call (\`send\`), mapping units and
argument positions. No business logic lives here — that would violate Single Responsibility.

**The clamping guard** (\`durationMs > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) durationMs\`)
is the subtle correctness detail. Without it, a value like 3_000_000_000L silently
truncates to a negative \`int\` on cast, producing garbage analytics data. Clamping is
the right behaviour: a 49-day timing measurement is almost certainly a bug in the caller,
but sending \`Integer.MAX_VALUE\` is at least a valid, non-negative value.

**Why the variable is typed \`TrackingService\` in \`main\`:** the adapter is an implementation
detail. From \`main\`'s perspective, there is only a \`TrackingService\`. If the analytics
vendor changes, you write a new adapter — none of the dozen call sites that use
\`TrackingService\` change. This is the Dependency Inversion Principle: high-level code
depends on the abstraction (\`TrackingService\`), not the concretion (\`LegacyAnalyticsClient\`).`,
    },
    {
      id: 'decorator-datasource',
      title: 'Decorator chain — composable data-source transforms (buffering, compression, encryption)',
      difficulty: 'challenge',
      prompt: `Build a **data-source Decorator chain** modelling how \`java.io\` wraps streams.

You need:

1. A \`DataSource\` interface:
~~~java
public interface DataSource {
    void   write(String data);
    String read();
    String description();   // returns the chain description, e.g. "Encrypted(Compressed(File))"
}
~~~

2. \`FileDataSource\` — the base concrete component. Stores the last written string in memory
   (simulating a file). Description: \`"File"\`.

3. \`DataSourceDecorator\` — abstract class that holds and delegates to a \`DataSource\`.

4. Three concrete decorators:

| Decorator | \`write\` transform | \`read\` inverse transform | Description wrapper |
|-----------|--------------------|--------------------------|--------------------|
| \`BufferedDataSource\` | prepend \`"[buf]"\` | strip leading \`"[buf]"\` | \`"Buffered(...)"\` |
| \`CompressionDataSource\` | prepend \`"[zip]"\` | strip leading \`"[zip]"\` | \`"Compressed(...)"\` |
| \`EncryptionDataSource\` | prepend \`"[enc]"\` | strip leading \`"[enc]"\` | \`"Encrypted(...)"\` |

(The prefix approach is a placeholder for real transforms — the structural pattern is
what matters.)

5. A \`main\` that:
   - Creates a plain \`FileDataSource\`, writes \`"sales report"\`, reads it back, prints both.
   - Creates a fully-decorated chain \`Encrypted(Compressed(Buffered(File)))\`, writes
     \`"sales report"\`, then reads and **round-trips correctly** (read strips prefixes
     in the correct order), prints the description, raw stored value, and round-tripped value.

Expected output (exact):

~~~text
--- plain ---
wrote: sales report
read:  sales report

--- decorated ---
description: Encrypted(Compressed(Buffered(File)))
raw stored:  [enc][zip][buf]sales report
round-trip:  sales report
~~~

**Bonus:** explain in a comment inside \`main\` why the **order of decoration matters** and
what happens if you put \`Encryption\` innermost instead of outermost.`,
      starter: `public class DataSourceDemo {

    interface DataSource {
        void   write(String data);
        String read();
        String description();
    }

    // TODO: implement FileDataSource

    // TODO: implement abstract DataSourceDecorator

    // TODO: implement BufferedDataSource, CompressionDataSource, EncryptionDataSource

    public static void main(String[] args) {
        // --- plain ---
        // TODO: create FileDataSource, write "sales report", read back, print

        // --- decorated ---
        // TODO: chain Encryption > Compression > Buffered > File
        // TODO: write "sales report" through the chain
        // TODO: print description, raw stored value (read from innermost FileDataSource), round-tripped value

        // BONUS: add a comment explaining why order of decoration matters
    }
}`,
      hints: [
        'DataSourceDecorator holds a final DataSource wrapped field and delegates all three interface methods to it by default. Concrete decorators override write() and read() to add/strip their prefix, and override description() to wrap the delegate\'s description string.',
        'The write transform applies outermost-last: Encryption.write calls Compression.write, which calls Buffered.write, which calls File.write. So the innermost decorator\'s prefix ends up closest to the raw data. The stored string is "[enc][zip][buf]sales report".',
        'To print the raw stored value, keep a reference to the inner FileDataSource (before wrapping) and call read() on it directly. For the round-trip, call read() on the outermost (encrypted) source — each decorator strips its own prefix.',
      ],
      solution: `public class DataSourceDemo {

    interface DataSource {
        void   write(String data);
        String read();
        String description();
    }

    // ---- Concrete component ----
    static final class FileDataSource implements DataSource {
        private String content = "";

        @Override public void   write(String data) { this.content = data; }
        @Override public String read()             { return content; }
        @Override public String description()      { return "File"; }
    }

    // ---- Abstract decorator ----
    static abstract class DataSourceDecorator implements DataSource {
        protected final DataSource wrapped;
        DataSourceDecorator(DataSource wrapped) { this.wrapped = wrapped; }

        @Override public void   write(String data) { wrapped.write(data); }
        @Override public String read()             { return wrapped.read(); }
        @Override public String description()      { return wrapped.description(); }
    }

    // ---- Concrete decorators ----
    static final class BufferedDataSource extends DataSourceDecorator {
        BufferedDataSource(DataSource ds) { super(ds); }

        @Override public void write(String data)  { wrapped.write("[buf]" + data); }
        @Override public String read()            {
            String raw = wrapped.read();
            return raw.startsWith("[buf]") ? raw.substring(5) : raw;
        }
        @Override public String description()     { return "Buffered(" + wrapped.description() + ")"; }
    }

    static final class CompressionDataSource extends DataSourceDecorator {
        CompressionDataSource(DataSource ds) { super(ds); }

        @Override public void write(String data)  { wrapped.write("[zip]" + data); }
        @Override public String read()            {
            String raw = wrapped.read();
            return raw.startsWith("[zip]") ? raw.substring(5) : raw;
        }
        @Override public String description()     { return "Compressed(" + wrapped.description() + ")"; }
    }

    static final class EncryptionDataSource extends DataSourceDecorator {
        EncryptionDataSource(DataSource ds) { super(ds); }

        @Override public void write(String data)  { wrapped.write("[enc]" + data); }
        @Override public String read()            {
            String raw = wrapped.read();
            return raw.startsWith("[enc]") ? raw.substring(5) : raw;
        }
        @Override public String description()     { return "Encrypted(" + wrapped.description() + ")"; }
    }

    public static void main(String[] args) {
        // --- plain ---
        FileDataSource plain = new FileDataSource();
        plain.write("sales report");
        System.out.println("--- plain ---");
        System.out.println("wrote: sales report");
        System.out.println("read:  " + plain.read());

        System.out.println();

        // --- decorated ---
        // Keep a direct reference to the innermost FileDataSource to inspect raw storage.
        FileDataSource inner = new FileDataSource();
        DataSource chain = new EncryptionDataSource(
                               new CompressionDataSource(
                                   new BufferedDataSource(inner)));

        chain.write("sales report");

        System.out.println("--- decorated ---");
        System.out.println("description: " + chain.description());
        System.out.println("raw stored:  " + inner.read());    // bypasses all decorators
        System.out.println("round-trip:  " + chain.read());    // each decorator strips its own prefix

        // BONUS — order of decoration matters because transformations are not commutative.
        // Outermost write runs first and delegates inward, so the innermost decorator's
        // prefix is closest to the raw data. On read, the outermost decorator strips its
        // prefix first, then the next, and so on inward — each layer must undo exactly
        // what it added on write. If Encryption were innermost, write would store
        // "[buf][zip][enc]sales report" and read would try to strip "[enc]" from
        // "[buf][zip][enc]..." — which it would see correctly — but then Compression
        // would try to strip "[zip]" from "[enc]..." which is wrong. The decorators
        // must be stacked in the same order on both write and read paths; if the chain
        // is constructed differently on the two sides, the round-trip breaks.
    }
}`,
      explanation: `**The decorator invariant revisited:** every decorator is a \`DataSource\` and wraps a
\`DataSource\`. This means any piece of code that accepts a \`DataSource\` can receive a
chain of arbitrary depth — the complexity is hidden behind a single interface.

**Why order of decoration matters (the bonus answer):**
\`write\` delegates inward: the outermost decorator adds its prefix first, then calls the
next decorator's \`write\`, which adds its prefix, and so on. The raw storage therefore
looks like the outermost prefix first: \`[enc][zip][buf]data\`. On \`read\`, each decorator
strips its own prefix and delegates inward to get the rest. If you reverse the order,
the prefixes accumulate in a different order on write, and the read stripping logic
expects a different order — the round-trip fails silently (returning a string still
wrapped in some prefixes, or stripping prefixes that don't exist and returning the raw
string with unexpected characters).

**The \`inner\` reference trick:** keeping a direct reference to \`FileDataSource\` before
wrapping it lets you read the raw stored value to verify what each layer wrote, without
touching the decorator chain. This is a useful debugging technique in production code
too — keep a reference to the unwrapped component if you ever need to inspect the raw
state.

**Connection to \`java.io\`:** \`new DataInputStream(new BufferedInputStream(new FileInputStream(path)))\`
is structurally identical to this exercise. \`FileInputStream\` is the concrete component;
\`BufferedInputStream\` and \`DataInputStream\` are decorators. Every \`InputStream\` method
on \`DataInputStream\` delegates through \`BufferedInputStream\` down to \`FileInputStream\`
— exactly the chain you built here.`,
    },
  ],
  takeaways: [
    'The **Initialization-on-Demand Holder** idiom gives a lazy, thread-safe Singleton with no \`volatile\` or explicit locks — the JVM class-loading contract provides the happens-before guarantee implicitly.',
    'Double-checked locking **requires \`volatile\`** on the instance field; omitting it is a data race: another thread may observe a partially-constructed object even when the reference is non-null.',
    'The **Builder** pattern\'s key structural decision is required fields in the constructor (compiler-enforced), optional fields as fluent setters with defaults, and **all cross-field validation in \`build()\`** where the complete picture is visible.',
    'The **Adapter** pattern\'s job is pure translation — no business logic. The caller depends only on the target interface; swapping the underlying implementation means writing a new adapter, not editing call sites (Dependency Inversion Principle).',
    'The **Decorator** pattern satisfies the Open/Closed Principle: add behaviour by writing a new decorator class, not by modifying existing ones. The pattern avoids class explosion (2^N subclasses for N independent features) by composing N decorator classes at runtime.',
    'Decorator **order matters**: write delegates inward (outermost prefix is applied first, ends up outermost in storage); read unwraps outward. Reversing the decoration order breaks the round-trip unless transforms are commutative.',
    'Before applying any pattern, name the **specific friction it removes today**. A two-field class does not need a Builder; a single implementation does not need a Factory; global state that could be injected should not be a Singleton.',
  ],
}
