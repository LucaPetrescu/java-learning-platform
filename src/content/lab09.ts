import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//  - NO unescaped backtick anywhere in a string literal.
//  - NO ${ sequence anywhere.

export const lab09: Lab = {
  id: 'lab-09',
  number: 9,
  title: 'Design Patterns II — Behavioural',
  subtitle: 'Strategy, Observer, Template Method, Command, State & Iterator',
  estimatedHours: 6,
  concepts: [
    'Strategy',
    'Observer',
    'Template Method',
    'Command',
    'State',
    'Iterator',
    'SOLID',
    'Open/Closed Principle',
    'functional interfaces',
    'undo/redo',
  ],
  overview: `You know what design patterns are. This lab is about **using them fluently** —
knowing *when* each pattern is the right call, its trade-offs, and the subtle
implementation details that separate a textbook answer from production-quality code.

Five canonical GoF behavioural patterns are covered:

- **Strategy** — interchangeable algorithms; how lambdas collapse the boilerplate
- **Observer** — publish/subscribe, safe unsubscription, and the snapshot guard
- **Template Method** — algorithm skeletons, hooks vs abstract methods, Hollywood Principle
- **Command** — requests as objects, undo/redo stacks, the state-capture problem
- **State** — behaviour that varies with lifecycle state, and how it differs from Strategy

Plus a brief tour of **Iterator**, the pattern Java has already baked into the language.

Throughout, every pattern is anchored to the **Open/Closed Principle**: add behaviour
by writing new code, not by editing existing code. Behavioural patterns are the toolbox
that makes OCP practical rather than theoretical.

**Prerequisite:** comfortable with interfaces, inheritance, generics, lambdas, and
\`ArrayDeque\`. JDK 24 is assumed.`,
  theory: [
    {
      id: 'behavioural-overview',
      heading: 'Behavioural patterns — the big picture',
      body: `The **Gang of Four** grouped patterns into three families:

| Family | Concern | Examples |
|--------|---------|---------|
| Creational | *How* objects are made | Factory, Builder, Singleton |
| Structural | *How* objects are composed | Adapter, Decorator, Composite |
| **Behavioural** | *How* objects communicate and control flow | **Strategy, Observer, Template Method, Command, State, Iterator** |

Behavioural patterns do not change the shape of your object graph — they govern the
**flow of control and responsibility** at runtime.

**Why they matter at the intermediate level:**

Without them, behaviour change means touching existing classes — adding \`if/else\`
branches or \`switch\` statements. Each touch risks regressions and violates the
**Open/Closed Principle** (OCP): classes should be *open for extension but closed for
modification*. Behavioural patterns make OCP operational.

A quick orientation:

~~~text
Pattern          Core question it answers                   OCP mechanism
────────────────────────────────────────────────────────────────────────────────────
Strategy         Which algorithm should run?                New class/lambda per variant
Observer         Who cares that something changed?          New subscriber without touching subject
Template Method  Same steps, different details?             New subclass per variation
Command          What was requested, and can it be undone?  New command class per operation
State            What can I do right now?                   New state class per lifecycle state
Iterator         How do I traverse this collection?         New iterator class per structure
────────────────────────────────────────────────────────────────────────────────────
~~~

A useful rule of thumb: if you are adding an \`if (type == X)\` branch to an existing
class, a behavioural pattern is probably a better fit.`,
    },
    {
      id: 'strategy',
      heading: 'Strategy — interchangeable algorithms',
      body: `**Intent:** define a family of algorithms, encapsulate each one, and make them
interchangeable at runtime without the calling code knowing the difference.

**When to reach for it:** the same object needs to perform the same logical operation
in different ways depending on context (e.g. discount rules, retry policies, sorting
strategies, compression codecs, authentication methods).

**Classic structure:**

~~~java
// 1. The Strategy interface
@FunctionalInterface
interface RetryPolicy {
    boolean shouldRetry(int attempts, Exception lastError);
}

// 2. Named implementations (or lambdas — see below)
class ExponentialBackoff implements RetryPolicy {
    private final int maxAttempts;
    ExponentialBackoff(int max) { this.maxAttempts = max; }

    @Override
    public boolean shouldRetry(int attempts, Exception e) {
        return attempts < maxAttempts;
    }
}

// 3. Context delegates to its strategy
class HttpClient {
    private RetryPolicy policy;
    HttpClient(RetryPolicy policy) { this.policy = policy; }
    void setPolicy(RetryPolicy policy) { this.policy = policy; }

    // (simplified) request loop
    void get(String url) {
        int attempts = 0;
        Exception last = null;
        do {
            try { /* issue request */ return; }
            catch (Exception e) { last = e; attempts++; }
        } while (policy.shouldRetry(attempts, last));
        throw new RuntimeException("All retries exhausted", last);
    }
}
~~~

**Lambda shortcut:** because \`RetryPolicy\` is a \`@FunctionalInterface\` (one abstract
method), any matching lambda is a valid strategy — no named class needed:

~~~java
// Never retry
RetryPolicy never = (attempts, e) -> false;

// Retry up to 3 times, only for IOExceptions
RetryPolicy selective = (attempts, e) ->
    attempts < 3 && e instanceof java.io.IOException;

HttpClient client = new HttpClient(selective);
~~~

This is exactly how \`java.util.Comparator\` works: every
\`list.sort((a, b) -> a.compareTo(b))\` is a lambda Strategy.

**Trade-offs vs inheritance:**

| | Inheritance | Strategy |
|-|-------------|---------|
| Varies | At compile time (subclass) | At runtime (swap policy field) |
| Sharing | Via protected methods (leaky) | Via the strategy's own state |
| Combining | Multiple inheritance nightmare | Compose two strategies |
| Lambda | Not applicable | Drop-in if single abstract method |

**Interview depth:** A common follow-up is "could you use a \`default\` method in the
interface to compose strategies?" — yes: \`default RetryPolicy andThen(RetryPolicy other)\`
could delegate to \`this\` first and fall through to \`other\`, following the same pattern
as \`Predicate.and()\` in the JDK.`,
    },
    {
      id: 'observer',
      heading: 'Observer — publish/subscribe',
      body: `**Intent:** when one object (the *Subject*) changes state, all dependent objects
(*Observers*) are notified automatically without the Subject knowing their concrete types.

**When to reach for it:** one-to-many event delivery — GUI listeners, domain event buses,
change tracking, real-time data feeds.

**Classic structure:**

~~~java
import java.util.ArrayList;
import java.util.List;

interface StockObserver {
    void onPriceChange(String ticker, double newPrice);
}

class StockFeed {
    private final List<StockObserver> listeners = new ArrayList<>();

    void subscribe(StockObserver o)   { listeners.add(o); }
    void unsubscribe(StockObserver o) { listeners.remove(o); }

    void publish(String ticker, double price) {
        // Snapshot prevents ConcurrentModificationException if a listener
        // unsubscribes itself during the notification loop.
        for (StockObserver o : new ArrayList<>(listeners)) {
            o.onPriceChange(ticker, price);
        }
    }
}
~~~

**The snapshot guard is the detail interviewers ask about.** Without it:

~~~java
// BROKEN — ConcurrentModificationException if listener calls unsubscribe inside onPriceChange
for (StockObserver o : listeners) o.onPriceChange(ticker, price);
~~~

**Typed generic variant:** you can build a stronger event bus that carries typed event
objects and routes by event class, giving subscribers compile-time type safety:

~~~java
import java.util.*;
import java.util.function.Consumer;

class EventBus {
    private final Map<Class<?>, List<Consumer<Object>>> handlers = new HashMap<>();

    @SuppressWarnings("unchecked")
    <T> void on(Class<T> type, Consumer<T> handler) {
        handlers.computeIfAbsent(type, k -> new ArrayList<>())
                .add((Consumer<Object>) handler);
    }

    void emit(Object event) {
        List<Consumer<Object>> hs = handlers.get(event.getClass());
        if (hs != null) for (Consumer<Object> h : new ArrayList<>(hs)) h.accept(event);
    }
}
~~~

**Java's deprecated \`Observable\`:** \`java.util.Observable\` and \`java.util.Observer\`
were deprecated in Java 9 because \`Observable\` is a *class*, preventing your subject
from extending anything else. Roll your own interface as above, or use Spring's
\`ApplicationEvent\` / reactive \`Flow.Publisher\`.

**OCP angle:** adding a new subscriber type never requires touching the Subject — it
only sees the Observer interface.`,
    },
    {
      id: 'template-method',
      heading: 'Template Method — algorithm skeleton',
      body: `**Intent:** define the *skeleton* of an algorithm in a base class, deferring
customisable steps to subclasses. The overall sequence is fixed; the details vary.

**When to reach for it:** you have multiple variations of a multi-step process that
share the same control flow but differ in individual steps — data import pipelines,
report generators, game AI loops, HTTP request handlers.

~~~java
abstract class DataImport {

    // THE TEMPLATE METHOD — final locks down the sequence
    public final void run() {
        load();
        validate();
        transform();
        save();
        onComplete();   // hook — optional override
    }

    protected abstract void load();
    protected abstract void validate();
    protected abstract void transform();
    protected abstract void save();

    // Hook: sensible default, subclass may override
    protected void onComplete() {
        System.out.println("Import finished.");
    }
}

class CsvImport extends DataImport {
    @Override protected void load()      { /* read file */ }
    @Override protected void validate()  { /* check headers */ }
    @Override protected void transform() { /* parse rows */ }
    @Override protected void save()      { /* write to DB */ }
}
~~~

**Hooks vs abstract methods:**

| | Abstract method | Hook |
|-|----------------|------|
| Subclass obligation | **Must** override | May override |
| Default body | None (forced) | Provided (opt-in) |
| Use case | Step is always needed | Optional extension point |

**Hollywood Principle:** "don't call us, we'll call you." The base class invokes the
abstract methods at the right time — subclasses never decide when to call \`load()\`.

**Marking \`run()\` as \`final\`** is deliberate: no subclass can accidentally reorder or
skip pipeline steps. This is an important design decision, not an oversight.

**Trade-off vs Strategy:** Template Method uses inheritance; Strategy uses composition.
Inheritance is a stronger coupling — prefer Strategy when you want to mix and match
steps independently, or when the "strategy" needs to change at runtime.

**Real-world uses:** \`javax.servlet.HttpServlet\` (override \`doGet\`, \`doPost\`),
JUnit test lifecycle (\`@BeforeEach\` = pre-hook), Spring's
\`AbstractMessageListenerContainer\`.`,
    },
    {
      id: 'command',
      heading: 'Command — encapsulating a request as an object',
      body: `**Intent:** encapsulate a request as a first-class object so it can be queued,
logged, scheduled, and **undone**.

**When to reach for it:** undo/redo (text editors, CAD tools), macro recording,
job queues, transactional batch operations.

**Core structure:**

~~~java
interface Command {
    void execute();
    void undo();
}

// Receiver — knows how to do the actual work
class Canvas {
    private final java.awt.Color[][] pixels;
    // ... drawing operations
}

// Concrete command — captures ALL state needed to reverse itself
class DrawPixelCommand implements Command {
    private final Canvas canvas;
    private final int x, y;
    private final java.awt.Color newColor;
    private java.awt.Color previousColor;  // saved during execute, used by undo

    DrawPixelCommand(Canvas c, int x, int y, java.awt.Color color) {
        this.canvas = c; this.x = x; this.y = y; this.newColor = color;
    }

    @Override
    public void execute() {
        previousColor = canvas.getPixel(x, y);  // save before changing
        canvas.setPixel(x, y, newColor);
    }

    @Override
    public void undo() {
        canvas.setPixel(x, y, previousColor);   // restore saved value
    }
}

// Invoker — owns the undo/redo stacks
import java.util.ArrayDeque;
import java.util.Deque;

class CommandManager {
    private final Deque<Command> history  = new ArrayDeque<>();
    private final Deque<Command> redoStack = new ArrayDeque<>();

    void execute(Command cmd) {
        cmd.execute();
        history.push(cmd);
        redoStack.clear();  // a new action invalidates the redo stack
    }

    void undo() {
        if (!history.isEmpty()) {
            Command cmd = history.pop();
            cmd.undo();
            redoStack.push(cmd);
        }
    }

    void redo() {
        if (!redoStack.isEmpty()) {
            Command cmd = redoStack.pop();
            cmd.execute();
            history.push(cmd);
        }
    }
}
~~~

**The state-capture rule (the subtle part):** a command must save enough state *inside
\`execute()\`* to reverse itself. For \`AppendCommand\` that is just the length appended;
for a delete it is the deleted content; for a replace it is the old value. Getting this
wrong breaks undo.

**Macro commands:** wrap a \`List<Command>\` in a composite command — execute forwards,
undo in reverse. One Ctrl-Z undoes the whole macro.

**\`ArrayDeque\` as a stack:** use \`push()\`/\`pop()\`, not the deprecated \`Stack\` class.
\`ArrayDeque\` is unsynchronised and faster; synchronise explicitly if needed.`,
    },
    {
      id: 'state',
      heading: 'State — behaviour that varies with lifecycle state',
      body: `**Intent:** let an object alter its behaviour when its internal state changes; the
object appears to change its class.

**When to reach for it:** objects with distinct lifecycle states where valid operations
differ per state — order processing (pending / confirmed / shipped / delivered),
TCP connections (listen / established / close-wait), vending machines.

~~~java
interface OrderState {
    void pay(Order order);
    void ship(Order order);
    void cancel(Order order);
}

class PendingState implements OrderState {
    @Override public void pay(Order o) {
        System.out.println("Payment received.");
        o.setState(new PaidState());
    }
    @Override public void ship(Order o)   { System.out.println("Must pay first."); }
    @Override public void cancel(Order o) {
        System.out.println("Order cancelled.");
        o.setState(new CancelledState());
    }
}

class PaidState implements OrderState {
    @Override public void pay(Order o)    { System.out.println("Already paid."); }
    @Override public void ship(Order o) {
        System.out.println("Shipping order.");
        o.setState(new ShippedState());
    }
    @Override public void cancel(Order o) { System.out.println("Cannot cancel — already paid."); }
}

// ShippedState, CancelledState ... follow the same pattern

class Order {
    private OrderState state = new PendingState();
    void setState(OrderState s) { this.state = s; }
    void pay()    { state.pay(this); }
    void ship()   { state.ship(this); }
    void cancel() { state.cancel(this); }
}
~~~

**Key difference from Strategy:**

| | Strategy | State |
|-|---------|-------|
| Who changes it? | *Client* passes a strategy | *State itself* transitions the context |
| When? | Usually once, before use | Throughout the object's life |
| States know each other? | No | Yes — they reference other state classes |
| Purpose | "Which algorithm?" | "What am I allowed to do right now?" |

Without this pattern you end up with a \`switch (currentState)\` in every method —
every new state forces edits to every method. With State, adding a new state is
adding one new class that implements the interface.`,
    },
    {
      id: 'iterator',
      heading: 'Iterator — uniform traversal (already in Java)',
      body: `**Intent:** provide a way to access elements of a collection sequentially without
exposing its underlying representation.

Java makes this a language-level contract:

- \`java.lang.Iterable<T>\` — any object that can produce an \`Iterator\`
- \`java.util.Iterator<T>\` — \`hasNext()\`, \`next()\`, optional \`remove()\`
- \`for-each\` desugars to \`iterator()\` plus the loop

~~~java
import java.util.Iterator;

// A custom lazy range — computes values on demand, allocates no array
class Range implements Iterable<Integer> {
    private final int from, to;
    Range(int from, int to) { this.from = from; this.to = to; }

    @Override
    public Iterator<Integer> iterator() {
        return new Iterator<>() {
            int current = from;
            @Override public boolean hasNext() { return current <= to; }
            @Override public Integer next()    { return current++; }
        };
    }
}

// Consumer sees nothing about how values are produced
for (int n : new Range(1, 1_000_000)) {
    if (n > 5) break;   // stops without allocating the rest
    System.out.print(n + " ");   // 1 2 3 4 5
}
~~~

**Java Streams extend this further.** \`Stream\` is a lazy, composable iterator with
\`map\`, \`filter\`, \`reduce\`, parallel execution, and short-circuit operations. The same
Range could be expressed as \`IntStream.rangeClosed(1, 1_000_000)\`.

**When to implement \`Iterable\` manually:** only when your data structure genuinely
benefits from for-each support (e.g. a custom tree or pagination cursor). For
collection-like types, prefer delegating to \`List\`/\`Set\` and exposing their iterators.`,
    },
  ],
  exercises: [
    {
      id: 'strategy-retry',
      title: 'Strategy + lambdas: composable retry policies',
      difficulty: 'core',
      prompt: `Design and implement a **retry policy** system that shows why lambdas and the
Strategy pattern belong together.

**Requirements:**

1. Declare a \`@FunctionalInterface\` named \`RetryPolicy\` with one method:
   \`boolean shouldRetry(int attemptNumber, Exception cause)\`.
   (\`attemptNumber\` starts at 1 for the first failure.)

2. Implement three named class strategies:
   - \`NoRetry\` — always returns \`false\`.
   - \`MaxAttempts(int max)\` — retry while \`attemptNumber < max\`.
   - \`ExponentialBackoff(int maxAttempts)\` — same ceiling as \`MaxAttempts\`,
     but also sleeps \`50 * 2^(attemptNumber-1)\` ms before returning \`true\`
     (use \`Thread.sleep\`; swallow or rethrow the \`InterruptedException\` as a
     \`RuntimeException\`).

3. Add a \`default\` method to \`RetryPolicy\`:
   ~~~java
   default RetryPolicy and(RetryPolicy other) {
       return (attempt, cause) -> this.shouldRetry(attempt, cause)
                               && other.shouldRetry(attempt, cause);
   }
   ~~~
   This lets you compose policies without a new class.

4. Create a \`Task\` class with a constructor that accepts a \`Runnable\` and a \`RetryPolicy\`.
   Add a method \`void run()\` that executes the \`Runnable\`, catches any \`RuntimeException\`,
   and retries according to the policy. If all retries are exhausted it rethrows the last
   exception.

5. In \`main\`, demonstrate:
   - A task that always fails, using \`NoRetry\` — fails immediately.
   - A task that fails twice then succeeds, using \`new MaxAttempts(3)\`.
   - A composed policy: retry at most 4 times, and only when the exception is
     an \`IllegalStateException\`. Use \`and()\` with an anonymous lambda, not a new class.

Expected output shape:

~~~text
[Attempt 1] Failing...
Task failed after 1 attempt(s).

[Attempt 1] Failing... [Attempt 2] Failing... [Attempt 3] OK
Task succeeded on attempt 3.

[Attempt 1] ISE hit... [Attempt 2] ISE hit...
Task failed: wrong type on attempt 3 — policy rejected.
~~~

**What to think about:**
- The \`and()\` default method is the same pattern as \`Predicate.and()\` in the JDK —
  Strategy + functional interface + default composition methods is idiomatic modern Java.
- Why is \`ExponentialBackoff\` a class rather than a lambda? (It has mutable/stateful
  sleep behaviour and a configuration field.)`,
      starter: `@FunctionalInterface
interface RetryPolicy {
    boolean shouldRetry(int attemptNumber, Exception cause);

    // TODO: add default and(RetryPolicy other) composition method
}

class NoRetry implements RetryPolicy {
    // TODO
}

class MaxAttempts implements RetryPolicy {
    private final int max;
    MaxAttempts(int max) { this.max = max; }
    // TODO
}

class ExponentialBackoff implements RetryPolicy {
    private final int maxAttempts;
    ExponentialBackoff(int max) { this.maxAttempts = max; }
    // TODO: shouldRetry — sleep before returning true
}

class Task {
    private final Runnable work;
    private final RetryPolicy policy;

    Task(Runnable work, RetryPolicy policy) {
        this.work   = work;
        this.policy = policy;
    }

    void run() {
        // TODO: attempt loop; retry only when policy says so; rethrow on exhaustion
    }
}

public class StrategyRetry {
    public static void main(String[] args) {
        // TODO: demonstrate all three scenarios
    }
}`,
      hints: [
        'In Task.run(), catch RuntimeException, increment an attempt counter, then call policy.shouldRetry(attempt, e). If it returns false, rethrow e.',
        'The composed "only ISE" policy is a lambda: (attempt, cause) -> cause instanceof IllegalStateException. Chain it with .and(new MaxAttempts(4)).',
        'ExponentialBackoff.shouldRetry: compute delay as 50L * (1L << (attemptNumber - 1)), call Thread.sleep(delay) inside a try/catch, then return attemptNumber < maxAttempts.',
      ],
      solution: `@FunctionalInterface
interface RetryPolicy {
    boolean shouldRetry(int attemptNumber, Exception cause);

    default RetryPolicy and(RetryPolicy other) {
        return (attempt, cause) -> this.shouldRetry(attempt, cause)
                                && other.shouldRetry(attempt, cause);
    }
}

class NoRetry implements RetryPolicy {
    @Override
    public boolean shouldRetry(int attempt, Exception cause) { return false; }
}

class MaxAttempts implements RetryPolicy {
    private final int max;
    MaxAttempts(int max) { this.max = max; }

    @Override
    public boolean shouldRetry(int attempt, Exception cause) { return attempt < max; }
}

class ExponentialBackoff implements RetryPolicy {
    private final int maxAttempts;
    ExponentialBackoff(int max) { this.maxAttempts = max; }

    @Override
    public boolean shouldRetry(int attempt, Exception cause) {
        long delay = 50L * (1L << (attempt - 1));  // 50, 100, 200, 400 ...
        try { Thread.sleep(delay); }
        catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted during backoff", ie);
        }
        return attempt < maxAttempts;
    }
}

class Task {
    private final Runnable work;
    private final RetryPolicy policy;

    Task(Runnable work, RetryPolicy policy) {
        this.work   = work;
        this.policy = policy;
    }

    void run() {
        int attempt = 0;
        while (true) {
            try {
                work.run();
                System.out.println("Task succeeded on attempt " + (attempt + 1) + ".");
                return;
            } catch (RuntimeException e) {
                attempt++;
                if (!policy.shouldRetry(attempt, e)) {
                    System.out.println("Task failed after " + attempt + " attempt(s).");
                    throw e;
                }
            }
        }
    }
}

public class StrategyRetry {
    public static void main(String[] args) {
        System.out.println("=== NoRetry ===");
        try {
            new Task(() -> { throw new RuntimeException("always fails"); }, new NoRetry()).run();
        } catch (RuntimeException ignored) {}

        System.out.println();
        System.out.println("=== MaxAttempts(3): fails twice then succeeds ===");
        int[] counter = {0};
        new Task(() -> {
            counter[0]++;
            System.out.print("[Attempt " + counter[0] + "] ");
            if (counter[0] < 3) throw new RuntimeException("not yet");
            System.out.println("OK");
        }, new MaxAttempts(3)).run();

        System.out.println();
        System.out.println("=== Composed: max 4 attempts AND only ISE ===");
        RetryPolicy policy = new MaxAttempts(4)
                .and((attempt, cause) -> cause instanceof IllegalStateException);
        int[] n = {0};
        try {
            new Task(() -> {
                n[0]++;
                System.out.print("[Attempt " + n[0] + "] ");
                if (n[0] < 3) throw new IllegalStateException("ISE");
                throw new RuntimeException("wrong type");
            }, policy).run();
        } catch (RuntimeException ignored) {}
    }
}`,
      explanation: `The \`default and()\` method on the interface is the key insight. Because \`RetryPolicy\`
is a functional interface, any implementation — class or lambda — automatically inherits
\`and()\`, allowing fluent composition without a dedicated combinator class. The JDK uses
this pattern extensively: \`Predicate.and()\`, \`Predicate.or()\`, \`Function.andThen()\`.

\`ExponentialBackoff\` has to be a named class (not a lambda) because it carries a
configuration field (\`maxAttempts\`) and has real sleep behaviour. A lambda works when
the strategy is stateless or captures an effectively-final local variable; once you
need construction parameters, a class is cleaner.

The composition test drives home the OCP point: adding an "only on ISE" filter required
zero changes to \`Task\`, \`MaxAttempts\`, or any existing class — one lambda, chained.`,
    },
    {
      id: 'observer-event-bus',
      title: 'Observer: typed event bus with safe unsubscription',
      difficulty: 'core',
      prompt: `Build a small typed **event bus** and expose two critical implementation details
that interviewers probe.

**Requirements:**

1. Create two record types (JDK 16+):
   ~~~java
   record OrderPlaced(String orderId, double amount) {}
   record PaymentFailed(String orderId, String reason) {}
   ~~~

2. Implement \`class EventBus\` with:
   - \`<T> void subscribe(Class<T> eventType, java.util.function.Consumer<T> handler)\`
   - \`<T> void unsubscribe(Class<T> eventType, java.util.function.Consumer<T> handler)\`
   - \`<T> void publish(T event)\` — dispatches to all handlers registered for \`event.getClass()\`

   Internal storage: \`Map<Class<?>, List<Consumer<Object>>>\`.

3. Publish must iterate a **snapshot copy** of the handler list so a handler can
   safely unsubscribe itself (or others) inside its own callback.

4. In \`main\`:
   - Register an \`OrderPlaced\` handler that prints the order.
   - Register a \`PaymentFailed\` handler that prints the failure reason.
   - Register a second \`OrderPlaced\` handler that **unsubscribes itself** after
     the first event (a one-shot listener).
   - Publish two \`OrderPlaced\` events and one \`PaymentFailed\` event.
   - Verify the one-shot handler fires only once.

Expected output shape:

~~~text
[OrderLogger] Placed: ORD-001 for £99.00
[OneShot] First order seen — unsubscribing myself.
[OrderLogger] Placed: ORD-002 for £149.00
[PaymentHandler] FAILED: ORD-003 — card declined
~~~

**What to think about:**
- Why store \`Consumer<Object>\` internally rather than \`Consumer<T>\`?
  (Type erasure: at runtime all generics are erased, so the map's key is the raw \`Class<?>.\`)
- Why does the one-shot self-unsubscription require the snapshot guard?
- What happens if two handlers for the same event type are equal by reference vs by lambda?
  (\`List.remove\` uses \`equals\` — lambdas created at different call sites are NOT equal,
  so store the same lambda instance to unsubscribe successfully.)`,
      starter: `import java.util.*;
import java.util.function.Consumer;

record OrderPlaced(String orderId, double amount) {}
record PaymentFailed(String orderId, String reason) {}

class EventBus {
    // Map from event type to list of handlers (stored as Consumer<Object>)
    private final Map<Class<?>, List<Consumer<Object>>> handlers = new HashMap<>();

    @SuppressWarnings("unchecked")
    public <T> void subscribe(Class<T> eventType, Consumer<T> handler) {
        handlers.computeIfAbsent(eventType, k -> new ArrayList<>())
                .add((Consumer<Object>) handler);
    }

    @SuppressWarnings("unchecked")
    public <T> void unsubscribe(Class<T> eventType, Consumer<T> handler) {
        List<Consumer<Object>> list = handlers.get(eventType);
        if (list != null) {
            list.remove((Consumer<Object>) handler);
        }
    }

    public <T> void publish(T event) {
        // TODO: look up handlers by event.getClass(), iterate a SNAPSHOT copy,
        //       call each handler. Do nothing if no handlers registered.
    }
}

public class ObserverEventBus {
    public static void main(String[] args) {
        EventBus bus = new EventBus();

        // TODO: register handlers, including a one-shot that unsubscribes itself
        // TODO: publish two OrderPlaced and one PaymentFailed events
    }
}`,
      hints: [
        'In publish, get the list, null-check it, then iterate new ArrayList<>(list) — the snapshot prevents ConcurrentModificationException when a handler calls unsubscribe.',
        'Store the one-shot lambda in a local variable BEFORE passing it to subscribe, so you can reference the same instance inside the lambda to pass to unsubscribe.',
        'The @SuppressWarnings("unchecked") cast (Consumer<Object>) handler is safe because the map is keyed by the same Class<T> you used at subscribe time — the event type guarantees the cast succeeds.',
      ],
      solution: `import java.util.*;
import java.util.function.Consumer;

record OrderPlaced(String orderId, double amount) {}
record PaymentFailed(String orderId, String reason) {}

class EventBus {
    private final Map<Class<?>, List<Consumer<Object>>> handlers = new HashMap<>();

    @SuppressWarnings("unchecked")
    public <T> void subscribe(Class<T> eventType, Consumer<T> handler) {
        handlers.computeIfAbsent(eventType, k -> new ArrayList<>())
                .add((Consumer<Object>) handler);
    }

    @SuppressWarnings("unchecked")
    public <T> void unsubscribe(Class<T> eventType, Consumer<T> handler) {
        List<Consumer<Object>> list = handlers.get(eventType);
        if (list != null) list.remove((Consumer<Object>) handler);
    }

    @SuppressWarnings("unchecked")
    public <T> void publish(T event) {
        List<Consumer<Object>> list = handlers.get(event.getClass());
        if (list == null) return;
        // Snapshot so handlers can safely unsubscribe during dispatch
        for (Consumer<Object> h : new ArrayList<>(list)) {
            h.accept(event);
        }
    }
}

public class ObserverEventBus {
    public static void main(String[] args) {
        EventBus bus = new EventBus();

        // Regular order logger
        Consumer<OrderPlaced> orderLogger = e ->
            System.out.printf("[OrderLogger] Placed: %s for £%.2f%n", e.orderId(), e.amount());

        // One-shot: fires once then removes itself — must hold a reference to itself
        Consumer<OrderPlaced>[] oneShotHolder = new Consumer[1];
        oneShotHolder[0] = e -> {
            System.out.println("[OneShot] First order seen — unsubscribing myself.");
            bus.unsubscribe(OrderPlaced.class, oneShotHolder[0]);
        };

        // Payment failure handler
        Consumer<PaymentFailed> payHandler = e ->
            System.out.printf("[PaymentHandler] FAILED: %s — %s%n", e.orderId(), e.reason());

        bus.subscribe(OrderPlaced.class,  orderLogger);
        bus.subscribe(OrderPlaced.class,  oneShotHolder[0]);
        bus.subscribe(PaymentFailed.class, payHandler);

        bus.publish(new OrderPlaced("ORD-001", 99.00));
        bus.publish(new OrderPlaced("ORD-002", 149.00));
        bus.publish(new PaymentFailed("ORD-003", "card declined"));
    }
}`,
      explanation: `The array trick (\`Consumer<OrderPlaced>[] oneShotHolder = new Consumer[1]\`) lets the lambda
capture a reference to itself. Java lambdas cannot directly reference the variable being
assigned (it would not be effectively final at that point), but capturing a single-element
array is a well-known workaround: the array reference is effectively final; the slot inside
it is mutable.

The snapshot in \`publish\` (\`new ArrayList<>(list)\`) is what makes self-unsubscription
safe. Without it, removing from the list while iterating it throws
\`ConcurrentModificationException\`. This is the single most commonly missed detail in
Observer implementations.

The unchecked cast \`(Consumer<Object>) handler\` is safe because subscribe and unsubscribe
are parameterised by the same \`Class<T>\`; at the call site the compiler already ensured
the handler accepts \`T\`. The cast is purely an erasure workaround.`,
    },
    {
      id: 'command-undo-redo',
      title: 'Command: text buffer with full undo and redo',
      difficulty: 'challenge',
      prompt: `Implement a **mini text editor** that supports multiple command types and full
**undo/redo** — the most complete form of the Command pattern.

**Requirements:**

1. Define \`interface Command\` with \`void execute()\` and \`void undo()\`.

2. Create \`TextBuffer\` (the Receiver) backed by a \`StringBuilder\` with:
   - \`void append(String text)\`
   - \`void deleteLast(int count)\` — remove the last N chars; clamp to \`[0, length]\`
   - \`void replaceAll(String oldStr, String newStr)\` — replace every occurrence
   - \`String content()\`

3. Implement three concrete commands:
   - \`AppendCommand(TextBuffer, String)\` — undo: delete same char count.
   - \`DeleteLastCommand(TextBuffer, int)\` — undo: re-append the deleted substring,
     which must be saved inside \`execute()\` before deletion.
   - \`ReplaceAllCommand(TextBuffer, String old, String newStr)\` — undo: swap back
     (call \`replaceAll(newStr, old)\`).

4. Create \`Editor\` with:
   - \`void execute(Command)\` — run, push to \`history\`, **clear the redo stack**
   - \`void undo()\` — pop from \`history\`, call \`undo()\`, push onto \`redoStack\`
   - \`void redo()\` — pop from \`redoStack\`, call \`execute()\` again, push back to \`history\`
   - Print "Nothing to undo." / "Nothing to redo." when the respective stack is empty
   - \`void print(String label)\`

5. In \`main\`, run this exact sequence and verify the output matches:

~~~text
After append "Hello, ":          [Hello, ]
After append "World!":           [Hello, World!]
After deleteLast(6):             [Hello, ]
After replaceAll Hello->Howdy:   [Howdy, ]
--- undo replaceAll ---
After undo:                      [Hello, ]
--- redo replaceAll ---
After redo:                      [Howdy, ]
--- undo replaceAll ---
After undo:                      [Hello, ]
--- undo deleteLast ---
After undo:                      [Hello, World!]
--- undo append World! ---
After undo:                      [Hello, ]
--- undo append Hello, ---
After undo:                      []
--- undo on empty ---
Nothing to undo.
--- redo past top ---
After redo:                      [Hello, ]
Nothing to redo.
~~~

**What to think about:**
- Why must \`execute()\` clear the redo stack? (Branching history — after a new action,
  the old "future" is no longer reachable.)
- \`DeleteLastCommand\` must save the deleted text inside \`execute()\`, not the constructor.
  Why? (At construction time the text hasn't been deleted yet; the buffer content is
  correct only at execution time.)`,
      starter: `import java.util.ArrayDeque;
import java.util.Deque;

interface Command {
    void execute();
    void undo();
}

class TextBuffer {
    private final StringBuilder sb = new StringBuilder();

    public void append(String text) { sb.append(text); }

    public void deleteLast(int count) {
        int start = Math.max(0, sb.length() - count);
        sb.delete(start, sb.length());
    }

    public void replaceAll(String old, String nw) {
        int idx;
        while ((idx = sb.indexOf(old)) != -1)
            sb.replace(idx, idx + old.length(), nw);
    }

    public String content() { return sb.toString(); }
}

class AppendCommand implements Command {
    // TODO: fields
    AppendCommand(TextBuffer buf, String text) { /* TODO */ }
    @Override public void execute() { /* TODO */ }
    @Override public void undo()    { /* TODO */ }
}

class DeleteLastCommand implements Command {
    private String saved;  // captured inside execute(), not constructor
    // TODO: other fields
    DeleteLastCommand(TextBuffer buf, int count) { /* TODO */ }
    @Override public void execute() { /* TODO: save then delete */ }
    @Override public void undo()    { /* TODO: re-append saved */ }
}

class ReplaceAllCommand implements Command {
    // TODO: fields
    ReplaceAllCommand(TextBuffer buf, String old, String nw) { /* TODO */ }
    @Override public void execute() { /* TODO */ }
    @Override public void undo()    { /* TODO: swap old and nw */ }
}

class Editor {
    private final TextBuffer buf      = new TextBuffer();
    private final Deque<Command> history   = new ArrayDeque<>();
    private final Deque<Command> redoStack = new ArrayDeque<>();

    public void execute(Command cmd) {
        // TODO: run, push to history, clear redo stack
    }

    public void undo() {
        // TODO: pop from history, undo, push to redoStack; guard empty
    }

    public void redo() {
        // TODO: pop from redoStack, execute again, push to history; guard empty
    }

    public void print(String label) {
        System.out.printf("%-40s [%s]%n", label, buf.content());
    }

    public TextBuffer buf() { return buf; }
}

public class CommandUndoRedo {
    public static void main(String[] args) {
        Editor ed = new Editor();
        // TODO: reproduce the sequence from the spec
    }
}`,
      hints: [
        'In DeleteLastCommand.execute(): String content = buf.content(); int start = Math.max(0, content.length() - count); saved = content.substring(start); then call buf.deleteLast(count). In undo(), call buf.append(saved).',
        'In Editor.execute(): cmd.execute(); history.push(cmd); redoStack.clear(); — clearing the redo stack is the branching-history rule.',
        'In Editor.redo(): Command cmd = redoStack.pop(); cmd.execute(); history.push(cmd); — re-execute, then push back to history so it can be undone again.',
      ],
      solution: `import java.util.ArrayDeque;
import java.util.Deque;

interface Command {
    void execute();
    void undo();
}

class TextBuffer {
    private final StringBuilder sb = new StringBuilder();

    public void append(String text) { sb.append(text); }

    public void deleteLast(int count) {
        int start = Math.max(0, sb.length() - count);
        sb.delete(start, sb.length());
    }

    public void replaceAll(String old, String nw) {
        int idx;
        while ((idx = sb.indexOf(old)) != -1)
            sb.replace(idx, idx + old.length(), nw);
    }

    public String content() { return sb.toString(); }
}

class AppendCommand implements Command {
    private final TextBuffer buf;
    private final String text;
    AppendCommand(TextBuffer buf, String text) { this.buf = buf; this.text = text; }
    @Override public void execute() { buf.append(text); }
    @Override public void undo()    { buf.deleteLast(text.length()); }
}

class DeleteLastCommand implements Command {
    private final TextBuffer buf;
    private final int count;
    private String saved;

    DeleteLastCommand(TextBuffer buf, int count) { this.buf = buf; this.count = count; }

    @Override
    public void execute() {
        String content = buf.content();
        int start = Math.max(0, content.length() - count);
        saved = content.substring(start);   // capture BEFORE deletion
        buf.deleteLast(count);
    }

    @Override
    public void undo() { buf.append(saved); }
}

class ReplaceAllCommand implements Command {
    private final TextBuffer buf;
    private final String old;
    private final String nw;

    ReplaceAllCommand(TextBuffer buf, String old, String nw) {
        this.buf = buf; this.old = old; this.nw = nw;
    }

    @Override public void execute() { buf.replaceAll(old, nw); }
    @Override public void undo()    { buf.replaceAll(nw, old); }
}

class Editor {
    private final TextBuffer buf       = new TextBuffer();
    private final Deque<Command> history    = new ArrayDeque<>();
    private final Deque<Command> redoStack  = new ArrayDeque<>();

    public void execute(Command cmd) {
        cmd.execute();
        history.push(cmd);
        redoStack.clear();   // new action invalidates the redo branch
    }

    public void undo() {
        if (history.isEmpty()) { System.out.println("Nothing to undo."); return; }
        Command cmd = history.pop();
        cmd.undo();
        redoStack.push(cmd);
    }

    public void redo() {
        if (redoStack.isEmpty()) { System.out.println("Nothing to redo."); return; }
        Command cmd = redoStack.pop();
        cmd.execute();
        history.push(cmd);
    }

    public void print(String label) {
        System.out.printf("%-40s [%s]%n", label, buf.content());
    }

    public TextBuffer buf() { return buf; }
}

public class CommandUndoRedo {
    public static void main(String[] args) {
        Editor ed = new Editor();

        ed.execute(new AppendCommand(ed.buf(), "Hello, "));
        ed.print("After append \"Hello, \":");

        ed.execute(new AppendCommand(ed.buf(), "World!"));
        ed.print("After append \"World!\":");

        ed.execute(new DeleteLastCommand(ed.buf(), 6));
        ed.print("After deleteLast(6):");

        ed.execute(new ReplaceAllCommand(ed.buf(), "Hello", "Howdy"));
        ed.print("After replaceAll Hello->Howdy:");

        System.out.println("--- undo replaceAll ---");
        ed.undo();
        ed.print("After undo:");

        System.out.println("--- redo replaceAll ---");
        ed.redo();
        ed.print("After redo:");

        System.out.println("--- undo replaceAll ---");
        ed.undo();
        ed.print("After undo:");

        System.out.println("--- undo deleteLast ---");
        ed.undo();
        ed.print("After undo:");

        System.out.println("--- undo append World! ---");
        ed.undo();
        ed.print("After undo:");

        System.out.println("--- undo append Hello, ---");
        ed.undo();
        ed.print("After undo:");

        System.out.println("--- undo on empty ---");
        ed.undo();   // prints "Nothing to undo."

        System.out.println("--- redo past top ---");
        ed.redo();   // re-appends "Hello, "
        ed.print("After redo:");
        ed.redo();   // prints "Nothing to redo."
    }
}`,
      explanation: `**The state-capture rule** is the core lesson: \`DeleteLastCommand\` saves the deleted
substring inside \`execute()\`, not the constructor. At construction time the buffer has
not been touched — the text to delete hasn't been identified yet. At execution time the
buffer is in exactly the right state to snapshot the characters about to disappear.

**The redo clear rule:** calling \`execute()\` clears \`redoStack\` because history is now
on a new branch. This mirrors how every real editor works: after you type a character,
the redo stack empties. Forgetting this produces phantom redos — a classic bug.

**\`ArrayDeque\` as a stack:** \`push\`/\`pop\` give LIFO semantics; the deprecated
\`java.util.Stack\` is synchronised and inherits from \`Vector\`, making it slower and
semantically odd. \`ArrayDeque\` is the idiomatic replacement for all stack and deque use.`,
    },
    {
      id: 'template-method-pipeline',
      title: 'Template Method: data-import pipeline with hooks',
      difficulty: 'core',
      prompt: `Design a **data-import pipeline** using Template Method that demonstrates the
difference between abstract steps and optional hooks, and the Hollywood Principle.

**Requirements:**

1. Create \`abstract class DataImport\` with:
   - A \`public final void run()\` template method that calls, in order:
     \`load()\`, \`validate()\`, \`transform()\`, \`save()\`, \`onComplete()\`.
   - \`protected abstract void load()\`
   - \`protected abstract void validate()\`
   - \`protected abstract void transform()\`
   - \`protected abstract void save()\`
   - A *hook* \`protected void onComplete()\` with default body printing \`"Import finished."\`.
   - A second *hook* \`protected boolean shouldAbortOnValidationError()\` that returns
     \`false\` by default. Override it to \`true\` if the subclass wants to stop on validation
     errors.
   - Modify \`run()\` so that after \`validate()\` it checks
     \`shouldAbortOnValidationError()\` — if true, print \`"Aborting: validation failed."\`
     and return without calling \`transform()\`, \`save()\`, or \`onComplete()\`.

2. Implement three concrete subclasses:
   - \`CsvImport\` — normal pipeline; prints step messages; does NOT override
     \`shouldAbortOnValidationError\`.
   - \`JsonImport\` — overrides \`onComplete()\` to print an audit line, then calls
     \`super.onComplete()\`.
   - \`StrictCsvImport\` — extends \`CsvImport\`; overrides \`shouldAbortOnValidationError()\`
     to return \`true\`, simulating a file with bad headers.

3. In \`main\`, run all three and show that \`StrictCsvImport\` aborts after validate.

Expected output:

~~~text
=== CsvImport ===
[CSV] Loading file
[CSV] Validating headers
[CSV] Transforming rows
[CSV] Saving to database
Import finished.

=== JsonImport ===
[JSON] Fetching from API
[JSON] Checking schema
[JSON] Flattening objects
[JSON] Publishing to queue
[AUDIT] JsonImport run completed
Import finished.

=== StrictCsvImport ===
[CSV] Loading file
[CSV] Validating headers
Aborting: validation failed.
~~~

**What to think about:**
- Why is \`run()\` marked \`final\`? What happens if a subclass can override it?
- \`shouldAbortOnValidationError\` is a boolean hook — it influences control flow
  in the template without the subclass needing to know about the surrounding logic.
- Why does \`JsonImport.onComplete()\` call \`super.onComplete()\` at the end, not
  the beginning? (Order matters for audit/completion semantics.)`,
      starter: `abstract class DataImport {

    // Template method — final so the pipeline order is guaranteed
    public final void run() {
        load();
        validate();
        // TODO: check shouldAbortOnValidationError(); abort if true
        transform();
        save();
        onComplete();
    }

    protected abstract void load();
    protected abstract void validate();
    protected abstract void transform();
    protected abstract void save();

    // Hook: default "done" message
    protected void onComplete() {
        System.out.println("Import finished.");
    }

    // Hook: return true to stop the pipeline after a validation error
    protected boolean shouldAbortOnValidationError() { return false; }
}

class CsvImport extends DataImport {
    @Override protected void load()      { System.out.println("[CSV] Loading file"); }
    @Override protected void validate()  { System.out.println("[CSV] Validating headers"); }
    @Override protected void transform() { System.out.println("[CSV] Transforming rows"); }
    @Override protected void save()      { System.out.println("[CSV] Saving to database"); }
}

class JsonImport extends DataImport {
    @Override protected void load()      { System.out.println("[JSON] Fetching from API"); }
    @Override protected void validate()  { System.out.println("[JSON] Checking schema"); }
    @Override protected void transform() { System.out.println("[JSON] Flattening objects"); }
    @Override protected void save()      { System.out.println("[JSON] Publishing to queue"); }
    // TODO: override onComplete to print audit line, then call super
}

class StrictCsvImport extends CsvImport {
    // TODO: override shouldAbortOnValidationError to return true
}

public class TemplateMethodPipeline {
    public static void main(String[] args) {
        DataImport[] pipelines = { new CsvImport(), new JsonImport(), new StrictCsvImport() };
        for (DataImport p : pipelines) {
            System.out.println("=== " + p.getClass().getSimpleName() + " ===");
            p.run();
            System.out.println();
        }
    }
}`,
      hints: [
        'In run(), after calling validate(), add: if (shouldAbortOnValidationError()) { System.out.println("Aborting: validation failed."); return; }',
        'JsonImport.onComplete() should print the audit line first, then call super.onComplete() — this way the audit line appears before the generic "Import finished." message.',
        'StrictCsvImport only needs one override: @Override protected boolean shouldAbortOnValidationError() { return true; }',
      ],
      solution: `abstract class DataImport {

    public final void run() {
        load();
        validate();
        if (shouldAbortOnValidationError()) {
            System.out.println("Aborting: validation failed.");
            return;
        }
        transform();
        save();
        onComplete();
    }

    protected abstract void load();
    protected abstract void validate();
    protected abstract void transform();
    protected abstract void save();

    protected void onComplete() {
        System.out.println("Import finished.");
    }

    protected boolean shouldAbortOnValidationError() { return false; }
}

class CsvImport extends DataImport {
    @Override protected void load()      { System.out.println("[CSV] Loading file"); }
    @Override protected void validate()  { System.out.println("[CSV] Validating headers"); }
    @Override protected void transform() { System.out.println("[CSV] Transforming rows"); }
    @Override protected void save()      { System.out.println("[CSV] Saving to database"); }
}

class JsonImport extends DataImport {
    @Override protected void load()      { System.out.println("[JSON] Fetching from API"); }
    @Override protected void validate()  { System.out.println("[JSON] Checking schema"); }
    @Override protected void transform() { System.out.println("[JSON] Flattening objects"); }
    @Override protected void save()      { System.out.println("[JSON] Publishing to queue"); }

    @Override
    protected void onComplete() {
        System.out.println("[AUDIT] JsonImport run completed");
        super.onComplete();
    }
}

class StrictCsvImport extends CsvImport {
    @Override
    protected boolean shouldAbortOnValidationError() { return true; }
}

public class TemplateMethodPipeline {
    public static void main(String[] args) {
        DataImport[] pipelines = { new CsvImport(), new JsonImport(), new StrictCsvImport() };
        for (DataImport p : pipelines) {
            System.out.println("=== " + p.getClass().getSimpleName() + " ===");
            p.run();
            System.out.println();
        }
    }
}`,
      explanation: `Marking \`run()\` as \`final\` is a deliberate constraint: it enforces the invariant that
every import always follows the same lifecycle. A subclass cannot accidentally reorder
\`validate\` and \`load\`, or skip \`save\`. This is the "Template" in Template Method.

The \`shouldAbortOnValidationError\` hook demonstrates an important pattern: a boolean
hook that influences **control flow** inside the template without the subclass needing to
know about the surrounding logic. The subclass says "my validation can fail"; the base
class decides what to do with that information. This is the Hollywood Principle applied
to error handling.

\`StrictCsvImport\` extends \`CsvImport\` rather than \`DataImport\` directly — one override
adds abort-on-error behaviour to every CSV import. This layered inheritance is common in
production template-method hierarchies.

Notice that \`JsonImport\` has no idea the abort hook exists — it doesn't implement it and
doesn't need to. Adding the hook to the base class required zero changes to \`CsvImport\`
or \`JsonImport\`. Open/Closed at the framework level.`,
    },
  ],
  takeaways: [
    'The **Strategy** pattern extracts a varying algorithm into a \`@FunctionalInterface\`; lambdas collapse the boilerplate. Add a \`default\` composition method (like \`Predicate.and()\`) and strategies become fluently composable without new classes.',
    'The **Observer** snapshot guard (\`new ArrayList<>(listeners)\` before iterating) is the single most-missed implementation detail — without it, a self-unsubscribing handler throws \`ConcurrentModificationException\`.',
    'In the **Template Method** pattern, marking the skeleton method \`final\` is not optional — it enforces the algorithm contract and prevents subclasses from reordering or skipping steps. Boolean hooks let subclasses influence control flow without owning it.',
    'In the **Command** pattern, state must be captured inside \`execute()\`, not the constructor — only at execution time is the receiver in the correct state to snapshot. Forgetting this is the canonical undo bug.',
    '**Command with redo**: \`execute()\` must always clear the redo stack. A new user action creates a new branch; the old "future" is gone. Skipping this produces phantom redos.',
    '**State vs Strategy** in one sentence: Strategy is assigned by the *client*; State transitions itself. States are aware of other states and change the context from the inside.',
    'All six patterns honour the **Open/Closed Principle** the same way: new behaviour = new class (or lambda). The existing classes that call the interface are never touched.',
  ],
}
