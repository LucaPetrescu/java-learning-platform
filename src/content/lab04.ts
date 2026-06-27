import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab04: Lab = {
  id: 'lab-04',
  number: 4,
  title: 'Abstraction, Special Classes & Restrictions',
  subtitle: 'Default-method conflicts, per-constant enum behaviour, template-method hooks & access control gotchas',
  estimatedHours: 6,
  concepts: [
    'abstract classes',
    'interfaces',
    'default method conflict',
    'static interface methods',
    'access modifiers',
    'enum with behaviour',
    'constant-specific bodies',
    'template method pattern',
  ],
  overview: `You already know interfaces enforce contracts and abstract classes share state. This lab
goes one level deeper — the edges that show up in code review and interviews:

- What happens when **two interfaces define the same \`default\` method** and your class implements both?
- How do you attach **per-constant behaviour** to an enum without a sprawling \`switch\`?
- What does the compiler enforce when an **abstract base** provides a template that subclasses must fill in?
- Which **access-modifier rule** do developers most often get wrong across packages?

The exercises are designed around correctness and design substance. The warmup is a predict/spot-the-bug
puzzle; the three core/challenge exercises involve non-trivial logic that requires real design decisions.`,
  theory: [
    {
      id: 'abstract-class-depth',
      heading: 'Abstract classes — template method & invariant enforcement',
      body: `An abstract class is more than "a class you can't instantiate". Its real power is the
**Template Method pattern**: a concrete method in the base class calls abstract hooks that
subclasses are forced to fill in.

~~~java
public abstract class DataExporter {

    // Template method — defines the algorithm skeleton, calls hooks.
    public final void export(List<String> rows) {
        validateRows(rows);          // concrete helper — shared by all
        String header = buildHeader();   // abstract hook
        String body   = buildBody(rows); // abstract hook
        writeOutput(header + "\\n" + body);
    }

    protected abstract String buildHeader();
    protected abstract String buildBody(List<String> rows);

    private void validateRows(List<String> rows) {
        if (rows == null || rows.isEmpty())
            throw new IllegalArgumentException("No rows to export");
    }

    private void writeOutput(String content) {
        System.out.println(content);   // in production: write to file/stream
    }
}
~~~

Three design choices worth noting:

1. **\`export\` is \`final\`** — subclasses can't bypass the validation. This is intentional:
   the base class owns the algorithm; subclasses only customise the variable parts.
2. **\`buildHeader\` and \`buildBody\` are \`protected abstract\`** — visible to subclasses,
   invisible to callers. Callers only see \`export\`.
3. **Validation happens in the base**, not repeated in every subclass. One place to fix,
   one place to test.

~~~java
class CsvExporter extends DataExporter {
    @Override
    protected String buildHeader() { return "name,age,email"; }

    @Override
    protected String buildBody(List<String> rows) {
        return String.join("\\n", rows);
    }
}
~~~

> Interview angle: "When would you use an abstract class instead of an interface?" —
> the canonical answer is **shared state and invariant enforcement**. If the base class
> needs to own fields or validate inputs before calling subclass hooks, you need an
> abstract class. An interface can't hold mutable state or a constructor.`,
    },
    {
      id: 'interface-default-conflict',
      heading: 'Interface default-method conflict — the diamond problem',
      body: `Java interfaces can carry \`default\` methods since Java 8. This enables backward-compatible
API evolution, but creates a problem when two interfaces define the **same default method signature**.

~~~java
interface Logger {
    default String format(String msg) {
        return "[LOG] " + msg;
    }
}

interface Auditor {
    default String format(String msg) {
        return "[AUDIT] " + msg;
    }
}

// This DOES NOT compile as-is — the compiler cannot choose between the two:
// class Service implements Logger, Auditor { }
// error: class Service inherits unrelated defaults for format(String) from types Logger and Auditor
~~~

The implementing class **must** override the conflicting method and pick explicitly:

~~~java
class Service implements Logger, Auditor {

    @Override
    public String format(String msg) {
        // Delegate to one interface using InterfaceName.super.method():
        return Logger.super.format(msg);
        // or combine them:
        // return Logger.super.format(msg) + " " + Auditor.super.format(msg);
    }
}
~~~

The \`InterfaceName.super.method()\` syntax is the **only** way to call a specific interface's
default implementation from an overriding class. You cannot call it from outside the class.

**Three rules to memorise:**

| Scenario | Resolution |
|---|---|
| Class implements two interfaces with conflicting defaults | Class **must** override — compiler error otherwise |
| Class extends an abstract class AND implements an interface with the same method | Class/abstract class wins — the more specific class always beats an interface default |
| Interface B extends interface A and overrides a default | B's version wins for implementors of B |

The second rule is also the answer to "what if my superclass already provides the method?" —
a class implementation always shadows a default, even silently. This is deliberate: it lets
you retrofit an interface onto an existing class hierarchy without breaking anything.

~~~java
abstract class BaseService {
    public String format(String msg) { return "[BASE] " + msg; }
}

// No conflict: BaseService.format() automatically wins over Logger's default.
class ConcreteService extends BaseService implements Logger { }

new ConcreteService().format("hello");   // "[BASE] hello"
~~~`,
    },
    {
      id: 'static-interface-methods',
      heading: 'Static interface methods — utilities scoped to the contract',
      body: `A \`static\` method on an interface is called on the **interface name**, not on instances or
implementing classes. It is not inherited:

~~~java
interface Validator<T> {
    boolean test(T value);

    static Validator<String> nonBlank() {
        return s -> s != null && !s.isBlank();
    }

    static Validator<Integer> positive() {
        return n -> n != null && n > 0;
    }
}

// Usage:
Validator<String>  v1 = Validator.nonBlank();
Validator<Integer> v2 = Validator.positive();

System.out.println(v1.test("hi"));    // true
System.out.println(v2.test(-3));      // false

// ImplementingClass.nonBlank() — DOES NOT COMPILE.
// Static interface methods are NOT inherited by implementing classes.
~~~

**Why this matters:** Static interface methods are factory methods or utility helpers **anchored
to the contract itself**. They're the JDK's preferred alternative to a separate companion class
(\`Collections\` vs \`Collection\`, \`Arrays\` vs \`Array\`). In modern code you often see them as
named constructors for functional interfaces.

**Static vs default vs abstract — the three method kinds:**

| Kind | Body? | Inherited? | Called via |
|---|:---:|:---:|---|
| \`abstract\` | No | Yes (must override) | instance |
| \`default\` | Yes | Yes (can override) | instance |
| \`static\` | Yes | **No** | interface name only |`,
    },
    {
      id: 'enum-constant-bodies',
      heading: 'Enums with per-constant behaviour',
      body: `Every enum constant is an **instance** of the enum class. When the enum declares an
\`abstract\` method, each constant must supply its own body — making each constant a distinct
anonymous subclass of the enum.

~~~java
public enum Operation {

    ADD("+") {
        @Override public double apply(double x, double y) { return x + y; }
    },
    SUBTRACT("-") {
        @Override public double apply(double x, double y) { return x - y; }
    },
    MULTIPLY("*") {
        @Override public double apply(double x, double y) { return x * y; }
    },
    DIVIDE("/") {
        @Override public double apply(double x, double y) {
            if (y == 0) throw new ArithmeticException("Division by zero");
            return x / y;
        }
    };

    private final String symbol;

    Operation(String symbol) { this.symbol = symbol; }

    public String getSymbol() { return symbol; }

    public abstract double apply(double x, double y);
}
~~~

This is the **Strategy pattern** without the boilerplate: no interface, no four separate
classes, no map from name to strategy. The enum is the registry AND the implementation.

A related technique: an enum can **implement an interface** and either provide a uniform
implementation or leave it abstract (per-constant bodies):

~~~java
interface Transition {
    TrafficLight next();
}

public enum TrafficLight implements Transition {
    RED   { @Override public TrafficLight next() { return GREEN; } },
    GREEN { @Override public TrafficLight next() { return AMBER; } },
    AMBER { @Override public TrafficLight next() { return RED;   } };
}

TrafficLight light = TrafficLight.RED;
for (int i = 0; i < 6; i++) {
    System.out.println(light);
    light = light.next();
}
// RED, GREEN, AMBER, RED, GREEN, AMBER
~~~

Notice: the loop code only knows \`Transition\` — it doesn't care that it's implemented by an enum.`,
    },
    {
      id: 'access-modifiers-depth',
      heading: 'Access modifiers — the cross-package gotchas',
      body: `The four levels in one table:

| Modifier | Same class | Same package | Subclass (other pkg) | Anywhere |
|---|:---:|:---:|:---:|:---:|
| \`private\` | yes | no | no | no |
| *(package-private)* | yes | yes | no | no |
| \`protected\` | yes | yes | yes | no |
| \`public\` | yes | yes | yes | yes |

The two most-missed rules:

**1. \`protected\` is NOT "visible to all subclasses everywhere".**
A subclass in a different package can access a \`protected\` member **only through its own type**,
not through a reference to the parent type:

~~~java
// package com.example.base
public class Animal {
    protected void breathe() { System.out.println("inhale/exhale"); }
}

// package com.example.zoo
public class Dog extends Animal {

    void demo(Animal a, Dog d) {
        breathe();      // OK — through the implicit 'this' (Dog)
        d.breathe();    // OK — through a Dog reference
        a.breathe();    // COMPILE ERROR — through an Animal reference in a different package
    }
}
~~~

The rationale: you should only extend the guarantee of \`protected\` to your own subclass
hierarchy, not to any arbitrary object of the parent type.

**2. Interface members default to \`public\`, not package-private.**
Writing \`void method();\` in an interface is implicitly \`public abstract\`. You cannot make
interface methods package-private or \`protected\`:

~~~java
interface Foo {
    void bar();               // implicitly public abstract
    // protected void baz();  // COMPILE ERROR — not allowed
}

// Implementing class MUST make it public — narrowing visibility is never allowed:
class FooImpl implements Foo {
    // void bar() { }         // COMPILE ERROR: weaker access than public
    public void bar() { }    // correct
}
~~~

**3. \`final\` is orthogonal to access.**
\`final\` on a method means "cannot be overridden"; it says nothing about visibility.
\`private final\` is redundant (private methods are never overridden anyway — they can only
be hidden), but compiles fine. \`public final\` in the Template Method pattern is intentional:
publicly callable, but the algorithm cannot be subverted.`,
    },
    {
      id: 'enum-advanced',
      heading: 'Enums — EnumSet, EnumMap & the singleton idiom',
      body: `Enums have two specialised collection companions that are **orders of magnitude faster**
than their generic counterparts for enum keys:

~~~java
import java.util.EnumSet;
import java.util.EnumMap;

enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

// EnumSet — a bit-field internally; O(1) add/contains/remove:
EnumSet<Day> weekend  = EnumSet.of(Day.SAT, Day.SUN);
EnumSet<Day> weekdays = EnumSet.complementOf(weekend);

// EnumMap — array-backed internally, keys ordered by ordinal:
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
schedule.put(Day.MON, "Stand-up 9am");
schedule.put(Day.FRI, "Retro 3pm");
System.out.println(schedule);   // ordered MON, FRI (insertion order respects ordinal)
~~~

**Enum as a thread-safe singleton** — the only serialisation-safe singleton in Java:

~~~java
public enum Config {
    INSTANCE;

    private final Properties props = new Properties();

    public String get(String key) { return props.getProperty(key); }
}

Config.INSTANCE.get("db.url");
~~~

Unlike a class-based singleton, the JVM guarantees exactly one instance even across
serialisation/deserialisation and reflection — the JLS explicitly prohibits calling
enum constructors via reflection.

**\`ordinal()\` gotcha:** Never persist or transmit an enum's ordinal. Adding a constant
in the middle of the declaration changes all subsequent ordinals silently. Use
\`name()\` (the String) or a dedicated stable field (like a numeric code field) for
serialisation.`,
    },
    {
      id: 'interface-vs-abstract-interview',
      heading: 'Interview-level: interface vs abstract class — the full picture',
      body: `The classic question has a nuanced answer in modern Java (Java 8+).

**Before Java 8:** The rule was crisp — use an interface for a pure contract (no
implementation), use an abstract class when you need shared state or partial implementation.

**After Java 8:** Interfaces gained \`default\` and \`static\` methods, blurring the line.
The practical distinction that remains:

| Need | Use |
|---|---|
| Multiple inheritance of type | Interface (a class can implement many) |
| Shared mutable state (fields) | Abstract class |
| Constructor logic / validation | Abstract class |
| Backward-compatible API evolution | Interface default method |
| Compile-time exhaustiveness check in a switch | Enum (or sealed interface in Java 17+) |
| Completely unrelated classes sharing a capability | Interface (\`Comparable\`, \`Serializable\`) |

The short answer interviewers expect: **"Use an interface to express what a type CAN DO;
use an abstract class to express what a type IS, especially when you need shared state or
a constructor."**

One more subtlety: **default methods cannot access instance state** of the implementing
class (they don't have access to its fields). If the default implementation needs to read
or write instance fields, it must call abstract methods to do so — which is exactly how
\`Comparable.compareTo\` and \`Iterator.remove\` work.`,
    },
  ],
  exercises: [
    {
      id: 'diamond-default-conflict',
      title: 'Write and resolve a default-method conflict',
      difficulty: 'warmup',
      prompt: `Your task is to **write** two interfaces that both declare a \`default\` method with the
same signature, then write a class that implements both and **resolves the conflict** by
combining the two default implementations.

**Step 1 — declare the interfaces.**

Create two interfaces, \`Logger\` and \`Auditor\`, each with a \`default\` method:

~~~java
String tag();
~~~

- \`Logger.tag()\` returns \`"[LOG]"\`
- \`Auditor.tag()\` returns \`"[AUDIT]"\`

Each interface also has one abstract method:

- \`Logger\`: \`void log(String message)\`
- \`Auditor\`: \`void record(String event)\`

**Step 2 — implement both in \`EventService\`.**

\`EventService\` implements both \`Logger\` and \`Auditor\`. It must:

1. Override \`tag()\` and return the **combination** of both interface defaults, separated by
   a space: \`Logger.super.tag() + " " + Auditor.super.tag()\`
2. Implement \`log(String message)\` to print: \`tag() + " LOG: " + message\`
3. Implement \`record(String event)\` to print: \`tag() + " AUDIT: " + event\`

**Step 3 — drive it from \`TagDemo.main\`.**

~~~java
class TagDemo {
    public static void main(String[] args) {
        EventService svc = new EventService();
        svc.log("User signed in");
        svc.record("GDPR consent updated");

        // Upcast to Logger — tag() still dispatches to EventService.tag()
        Logger l = svc;
        System.out.println(l.tag());
    }
}
~~~

Expected output:

~~~text
[LOG] [AUDIT] LOG: User signed in
[LOG] [AUDIT] AUDIT: GDPR consent updated
[LOG] [AUDIT]
~~~

Requirements:
- \`EventService\` must NOT redeclare \`tag()\` body from scratch — it **must** delegate to
  \`Logger.super.tag()\` and \`Auditor.super.tag()\` to compose the result.
- The program must compile and produce exactly the output above.`,
      starter: `// Step 1: declare Logger
interface Logger {
    // TODO: abstract method
    // void log(String message);

    // TODO: default tag() returning "[LOG]"
}

// Step 1: declare Auditor
interface Auditor {
    // TODO: abstract method
    // void record(String event);

    // TODO: default tag() returning "[AUDIT]"
}

// Step 2: implement both interfaces
class EventService implements Logger, Auditor {

    @Override
    public String tag() {
        // TODO: return Logger.super.tag() + " " + Auditor.super.tag()
        return "";
    }

    @Override
    public void log(String message) {
        // TODO: print tag() + " LOG: " + message
    }

    @Override
    public void record(String event) {
        // TODO: print tag() + " AUDIT: " + event
    }
}

// Step 3: drive it
class TagDemo {
    public static void main(String[] args) {
        EventService svc = new EventService();
        svc.log("User signed in");
        svc.record("GDPR consent updated");

        Logger l = svc;
        System.out.println(l.tag());
    }
}`,
      hints: [
        'A class that implements two interfaces with the same \`default\` method signature **must** override that method — the compiler will reject the class otherwise. The override is your explicit resolution point.',
        'Inside the overriding class, \`Logger.super.tag()\` calls \`Logger\`\'s default implementation and \`Auditor.super.tag()\` calls \`Auditor\`\'s. This syntax is only valid inside the class that directly lists both interfaces in its \`implements\` clause.',
        'The upcast \`Logger l = svc\` does not change which \`tag()\` runs — Java dispatches on the **runtime type** (\`EventService\`), not the reference type (\`Logger\`). So \`l.tag()\` still returns \`"[LOG] [AUDIT]"\`.',
      ],
      solution: `interface Logger {
    void log(String message);

    default String tag() {
        return "[LOG]";
    }
}

interface Auditor {
    void record(String event);

    default String tag() {
        return "[AUDIT]";
    }
}

class EventService implements Logger, Auditor {

    @Override
    public String tag() {
        // Explicitly delegates to each interface's default to compose the combined tag.
        return Logger.super.tag() + " " + Auditor.super.tag();
    }

    @Override
    public void log(String message) {
        System.out.println(tag() + " LOG: " + message);
    }

    @Override
    public void record(String event) {
        System.out.println(tag() + " AUDIT: " + event);
    }
}

class TagDemo {
    public static void main(String[] args) {
        EventService svc = new EventService();
        svc.log("User signed in");
        svc.record("GDPR consent updated");

        Logger l = svc;
        System.out.println(l.tag());
    }
}`,
      explanation: `**Why the override is mandatory.**
When \`EventService\` declares \`implements Logger, Auditor\` and both interfaces supply a
\`default String tag()\`, the compiler cannot pick one — it treats this as an ambiguity error.
The class is required to provide its own \`tag()\` implementation. This is not optional: omitting
the override is a compile-time error, regardless of whether the two defaults happen to produce
the same value.

**\`InterfaceName.super.method()\` — the only way to reach a specific default.**
Inside the overriding class you can call \`Logger.super.tag()\` to invoke \`Logger\`'s default
and \`Auditor.super.tag()\` to invoke \`Auditor\`'s. This syntax is only available inside a
class that directly names the interface in its \`implements\` list (or a subinterface that
extends it). You cannot call it from outside the class.

**Runtime dispatch ignores the reference type.**
\`Logger l = svc; l.tag()\` still calls \`EventService.tag()\` — not \`Logger\`'s default.
The JVM resolves virtual calls at runtime against the actual object type (\`EventService\`),
not the declared variable type (\`Logger\`). The interface variable is invisible to the
dispatch mechanism. This is consistent with all Java polymorphism: the reference type
determines what methods are *visible* at compile time; the object type determines which
implementation *runs* at runtime.`,
    },
    {
      id: 'fsm-enum',
      title: 'Finite-state machine with a transition enum',
      difficulty: 'core',
      prompt: `Model a simplified **vending machine** as a finite-state machine using an enum that
implements a \`State\` interface.

**The interface:**

~~~java
interface State {
    State insertCoin(int cents);
    State selectItem(int priceCents);
    State cancel();
    String label();
}
~~~

**The enum \`VendingState\` has four constants:**

| Constant | label() | Allowed transitions |
|---|---|---|
| \`IDLE\` | \`"Idle"\` | \`insertCoin\` -> \`HAS_COIN\` |
| \`HAS_COIN\` | \`"Has coin"\` | \`insertCoin\` -> \`HAS_COIN\` (accumulate); \`selectItem\` -> \`DISPENSING\` if coin >= price, else stay; \`cancel\` -> \`IDLE\` |
| \`DISPENSING\` | \`"Dispensing"\` | auto-returns to \`IDLE\` on any call after printing "Dispensing item..." |
| \`OUT_OF_ORDER\` | \`"Out of order"\` | all transitions stay in \`OUT_OF_ORDER\`, print "Machine out of order" |

Rules:
- The enum carries a single \`int balance\` field (cents deposited so far).
- \`insertCoin\` on \`HAS_COIN\` must **return a new enum constant with the updated balance** — but enum constants are singletons, so you need to model this differently. Use a **wrapper class** \`VendingMachine\` that owns the current \`VendingState\` AND the current balance as separate fields. The enum transitions then just return the **next \`VendingState\`** (ignoring balance), and \`VendingMachine\` manages the balance.
- If \`insertCoin\` is called in \`IDLE\` or \`HAS_COIN\`, the machine moves to / stays in \`HAS_COIN\` and the \`VendingMachine\` adds the coins to its balance field.
- \`selectItem\` on \`HAS_COIN\`: if \`balance >= priceCents\`, transitions to \`DISPENSING\` and the machine prints \`"Dispensing item (price: Xcents, change: Ycents)"\`, resets balance. Otherwise prints \`"Insufficient funds: have Xcents, need Ycents"\` and stays.
- \`cancel\` anywhere except \`DISPENSING\` returns to \`IDLE\` and prints \`"Returned Xcents"\`.

**\`VendingMachine\` class:**

~~~java
class VendingMachine {
    private VendingState state = VendingState.IDLE;
    private int balance = 0;

    public void insertCoin(int cents) { ... }
    public void selectItem(int priceCents) { ... }
    public void cancel() { ... }
    public String status() { return state.label() + " | balance: " + balance + "c"; }
}
~~~

**Expected \`main\` output:**

~~~text
Idle | balance: 0c
Has coin | balance: 50c
Has coin | balance: 130c
Insufficient funds: have 130c, need 150c
Has coin | balance: 130c
Has coin | balance: 230c
Dispensing item (price: 150c, change: 80c)
Idle | balance: 0c
~~~

Write \`VendingMain.main\` that drives the machine to produce exactly this output.`,
      starter: `interface State {
    VendingState onInsertCoin();    // returns next state (balance managed externally)
    VendingState onSelectItem(int balance, int priceCents);
    VendingState onCancel();
    String label();
}

enum VendingState implements State {

    IDLE {
        @Override public VendingState onInsertCoin() {
            // TODO: return HAS_COIN
            return this;
        }
        @Override public VendingState onSelectItem(int balance, int priceCents) {
            // TODO: print "No coin inserted", return IDLE
            return this;
        }
        @Override public VendingState onCancel() {
            // TODO: nothing to cancel, return IDLE
            return this;
        }
        @Override public String label() { return "Idle"; }
    },

    HAS_COIN {
        @Override public VendingState onInsertCoin() {
            // TODO: return HAS_COIN (balance accumulation handled by VendingMachine)
            return this;
        }
        @Override public VendingState onSelectItem(int balance, int priceCents) {
            // TODO: if balance >= priceCents -> DISPENSING, else stay
            return this;
        }
        @Override public VendingState onCancel() {
            // TODO: return IDLE
            return this;
        }
        @Override public String label() { return "Has coin"; }
    },

    DISPENSING {
        @Override public VendingState onInsertCoin() {
            System.out.println("Please wait, dispensing...");
            return IDLE;
        }
        @Override public VendingState onSelectItem(int balance, int priceCents) {
            System.out.println("Please wait, dispensing...");
            return IDLE;
        }
        @Override public VendingState onCancel() { return IDLE; }
        @Override public String label() { return "Dispensing"; }
    },

    OUT_OF_ORDER {
        @Override public VendingState onInsertCoin()                          { oor(); return this; }
        @Override public VendingState onSelectItem(int b, int p)              { oor(); return this; }
        @Override public VendingState onCancel()                              { oor(); return this; }
        @Override public String label() { return "Out of order"; }
        private void oor() { System.out.println("Machine out of order"); }
    };
}

class VendingMachine {
    private VendingState state   = VendingState.IDLE;
    private int          balance = 0;

    public void insertCoin(int cents) {
        // TODO: update state, add to balance
    }

    public void selectItem(int priceCents) {
        // TODO: delegate to state.onSelectItem; if DISPENSING, print and reset
    }

    public void cancel() {
        // TODO: delegate, print refund, reset balance
    }

    public String status() {
        return state.label() + " | balance: " + balance + "c";
    }
}

class VendingMain {
    public static void main(String[] args) {
        VendingMachine vm = new VendingMachine();
        System.out.println(vm.status());       // Idle | balance: 0c
        vm.insertCoin(50);
        System.out.println(vm.status());       // Has coin | balance: 50c
        vm.insertCoin(80);
        System.out.println(vm.status());       // Has coin | balance: 130c
        vm.selectItem(150);                    // Insufficient funds: have 130c, need 150c
        System.out.println(vm.status());       // Has coin | balance: 130c
        vm.insertCoin(100);
        System.out.println(vm.status());       // Has coin | balance: 230c
        vm.selectItem(150);                    // Dispensing item (price: 150c, change: 80c)
        System.out.println(vm.status());       // Idle | balance: 0c
    }
}`,
      hints: [
        'The enum constants cannot mutate each other\'s fields, so all mutable state (balance) lives in VendingMachine. The enum methods only decide the NEXT state — VendingMachine reads the return value and updates its own balance accordingly.',
        'In VendingMachine.selectItem: call state.onSelectItem(balance, priceCents). If the returned state is DISPENSING, that is the signal to print the dispense message, compute change, and reset balance to 0.',
        'In VendingMachine.cancel: call state.onCancel(). Before updating state, if balance > 0 print "Returned Xcents" and reset balance to 0.',
      ],
      solution: `interface State {
    VendingState onInsertCoin();
    VendingState onSelectItem(int balance, int priceCents);
    VendingState onCancel();
    String label();
}

enum VendingState implements State {

    IDLE {
        @Override public VendingState onInsertCoin() { return HAS_COIN; }
        @Override public VendingState onSelectItem(int balance, int priceCents) {
            System.out.println("No coin inserted");
            return IDLE;
        }
        @Override public VendingState onCancel() { return IDLE; }
        @Override public String label() { return "Idle"; }
    },

    HAS_COIN {
        @Override public VendingState onInsertCoin() { return HAS_COIN; }
        @Override public VendingState onSelectItem(int balance, int priceCents) {
            if (balance >= priceCents) {
                return DISPENSING;
            } else {
                System.out.println("Insufficient funds: have " + balance + "c, need " + priceCents + "c");
                return HAS_COIN;
            }
        }
        @Override public VendingState onCancel() { return IDLE; }
        @Override public String label() { return "Has coin"; }
    },

    DISPENSING {
        @Override public VendingState onInsertCoin() {
            System.out.println("Please wait, dispensing...");
            return IDLE;
        }
        @Override public VendingState onSelectItem(int balance, int priceCents) {
            System.out.println("Please wait, dispensing...");
            return IDLE;
        }
        @Override public VendingState onCancel() { return IDLE; }
        @Override public String label() { return "Dispensing"; }
    },

    OUT_OF_ORDER {
        @Override public VendingState onInsertCoin()             { oor(); return this; }
        @Override public VendingState onSelectItem(int b, int p) { oor(); return this; }
        @Override public VendingState onCancel()                 { oor(); return this; }
        @Override public String label() { return "Out of order"; }
        private void oor() { System.out.println("Machine out of order"); }
    };
}

class VendingMachine {
    private VendingState state   = VendingState.IDLE;
    private int          balance = 0;

    public void insertCoin(int cents) {
        state    = state.onInsertCoin();
        balance += cents;
    }

    public void selectItem(int priceCents) {
        VendingState next = state.onSelectItem(balance, priceCents);
        if (next == VendingState.DISPENSING) {
            int change = balance - priceCents;
            System.out.println("Dispensing item (price: " + priceCents + "c, change: " + change + "c)");
            balance = 0;
            state   = VendingState.IDLE;   // DISPENSING is transient; skip to IDLE
        } else {
            state = next;
        }
    }

    public void cancel() {
        VendingState next = state.onCancel();
        if (balance > 0) {
            System.out.println("Returned " + balance + "c");
            balance = 0;
        }
        state = next;
    }

    public String status() {
        return state.label() + " | balance: " + balance + "c";
    }
}

class VendingMain {
    public static void main(String[] args) {
        VendingMachine vm = new VendingMachine();
        System.out.println(vm.status());
        vm.insertCoin(50);
        System.out.println(vm.status());
        vm.insertCoin(80);
        System.out.println(vm.status());
        vm.selectItem(150);
        System.out.println(vm.status());
        vm.insertCoin(100);
        System.out.println(vm.status());
        vm.selectItem(150);
        System.out.println(vm.status());
    }
}`,
      explanation: `The key design insight: **enum constants are singletons**, so they cannot carry per-instance
mutable state. Trying to put \`balance\` on the enum would force all machines to share one balance —
clearly wrong. The solution is to separate concerns: the enum owns **state-transition logic**
(what the next state should be), and \`VendingMachine\` owns **mutable data** (balance).

This is the **State pattern** in the GoF sense. Each state constant encapsulates the rules for
its own context: \`IDLE\` refuses to dispense without a coin; \`HAS_COIN\` checks sufficiency;
\`DISPENSING\` is transient. Adding a new state (e.g. \`MAINTENANCE\`) is a single enum constant —
you don't touch existing code.

The enum-implements-interface approach also means you can type a variable as \`State\` and swap
implementations without the caller knowing it's an enum. That's exactly what the \`VendingMachine\`
does internally — it only ever calls interface methods on \`state\`.`,
    },
    {
      id: 'abstract-template-validator',
      title: 'Abstract template validator with invariant enforcement',
      difficulty: 'core',
      prompt: `Implement a **form-field validation framework** using the **Template Method pattern**.

**Abstract base class \`FieldValidator\`:**

~~~java
public abstract class FieldValidator {

    private final String fieldName;

    protected FieldValidator(String fieldName) {
        if (fieldName == null || fieldName.isBlank())
            throw new IllegalArgumentException("fieldName must not be blank");
        this.fieldName = fieldName;
    }

    // Template method — final so subclasses cannot bypass normalisation or logging.
    public final ValidationResult validate(String raw) {
        String normalised = normalise(raw);
        if (normalised == null || normalised.isEmpty())
            return ValidationResult.failure(fieldName, "Field is required");
        return check(normalised);
    }

    // Hook 1: subclasses decide how to clean the input (trim, lower-case, etc.)
    protected abstract String normalise(String raw);

    // Hook 2: subclasses implement the actual rule after normalisation.
    protected abstract ValidationResult check(String value);

    protected final String getFieldName() { return fieldName; }
}
~~~

**\`ValidationResult\` record** (you define it):
- \`boolean valid\`
- \`String fieldName\`
- \`String message\` (empty string when valid)
- Static factories: \`ValidationResult.ok(String fieldName)\` and \`ValidationResult.failure(String fieldName, String message)\`

**Three concrete validators:**

1. **\`EmailValidator\`** — normalises by trimming and lower-casing; \`check\` passes if value matches
   a simple pattern: \`[^@]+@[^@]+\\.[^@]+\` (use \`String.matches\`).
2. **\`AgeValidator\`** — normalises by trimming; \`check\` parses to int (reject non-numeric with
   failure), then rejects values outside \`[0, 150]\`.
3. **\`UsernameValidator\`** — normalises by trimming; \`check\` requires 3–20 characters, letters and
   digits only (regex: \`[a-zA-Z0-9]{3,20}\`).

**In \`ValidatorDemo.main\`**, run these inputs through the matching validator and print each result:

~~~text
email    "  Alice@Example.COM  " -> OK
email    "not-an-email"          -> FAIL: Invalid email format
age      " 25 "                  -> OK
age      "200"                   -> FAIL: Age must be between 0 and 150
age      "abc"                   -> FAIL: Age must be a number
username "jo"                    -> FAIL: Username must be 3-20 alphanumeric characters
username "valid_user!"           -> FAIL: Username must be 3-20 alphanumeric characters
username "JavaDev42"             -> OK
~~~

Requirements: the output format is \`"%-10s %-26s -> %s"\` where the third column is \`"OK"\` or
\`"FAIL: " + message\`.`,
      starter: `// ValidationResult — define as a class with static factories
class ValidationResult {
    private final boolean valid;
    private final String  fieldName;
    private final String  message;

    private ValidationResult(boolean valid, String fieldName, String message) {
        this.valid     = valid;
        this.fieldName = fieldName;
        this.message   = message;
    }

    public static ValidationResult ok(String fieldName) {
        // TODO
        return null;
    }

    public static ValidationResult failure(String fieldName, String message) {
        // TODO
        return null;
    }

    public boolean isValid()     { return valid; }
    public String  getField()    { return fieldName; }
    public String  getMessage()  { return message; }

    @Override
    public String toString() {
        return valid ? "OK" : "FAIL: " + message;
    }
}

abstract class FieldValidator {

    private final String fieldName;

    protected FieldValidator(String fieldName) {
        if (fieldName == null || fieldName.isBlank())
            throw new IllegalArgumentException("fieldName must not be blank");
        this.fieldName = fieldName;
    }

    public final ValidationResult validate(String raw) {
        String normalised = normalise(raw);
        if (normalised == null || normalised.isEmpty())
            return ValidationResult.failure(fieldName, "Field is required");
        return check(normalised);
    }

    protected abstract String normalise(String raw);
    protected abstract ValidationResult check(String value);

    protected final String getFieldName() { return fieldName; }
}

class EmailValidator extends FieldValidator {
    public EmailValidator() { super("email"); }

    @Override
    protected String normalise(String raw) {
        // TODO: trim + lowercase
        return raw;
    }

    @Override
    protected ValidationResult check(String value) {
        // TODO: regex [^@]+@[^@]+\\.[^@]+
        return ValidationResult.ok(getFieldName());
    }
}

class AgeValidator extends FieldValidator {
    public AgeValidator() { super("age"); }

    @Override
    protected String normalise(String raw) {
        // TODO: trim
        return raw;
    }

    @Override
    protected ValidationResult check(String value) {
        // TODO: parse int, check 0..150
        return ValidationResult.ok(getFieldName());
    }
}

class UsernameValidator extends FieldValidator {
    public UsernameValidator() { super("username"); }

    @Override
    protected String normalise(String raw) {
        // TODO: trim
        return raw;
    }

    @Override
    protected ValidationResult check(String value) {
        // TODO: matches [a-zA-Z0-9]{3,20}
        return ValidationResult.ok(getFieldName());
    }
}

class ValidatorDemo {
    public static void main(String[] args) {
        Object[][] cases = {
            { new EmailValidator(),    "  Alice@Example.COM  " },
            { new EmailValidator(),    "not-an-email"           },
            { new AgeValidator(),      " 25 "                   },
            { new AgeValidator(),      "200"                    },
            { new AgeValidator(),      "abc"                    },
            { new UsernameValidator(), "jo"                     },
            { new UsernameValidator(), "valid_user!"            },
            { new UsernameValidator(), "JavaDev42"              },
        };

        for (Object[] c : cases) {
            FieldValidator validator = (FieldValidator) c[0];
            String         input     = (String) c[1];
            ValidationResult result  = validator.validate(input);
            System.out.printf("%-10s %-26s -> %s%n",
                              result.getField(), "\"" + input.strip() + "\"", result);
        }
    }
}`,
      hints: [
        'In AgeValidator.check: wrap Integer.parseInt(value) in a try/catch NumberFormatException and return failure(..., "Age must be a number") from the catch block.',
        'The template method is already final — you cannot override validate() in a subclass. This is intentional: the base enforces null/blank handling for every validator without each subclass repeating the guard.',
        'For the output formatting the strip() in the printf is purely cosmetic (removes the leading/trailing spaces from the raw input string for cleaner display). Your validate() already calls normalise() internally.',
      ],
      solution: `class ValidationResult {
    private final boolean valid;
    private final String  fieldName;
    private final String  message;

    private ValidationResult(boolean valid, String fieldName, String message) {
        this.valid     = valid;
        this.fieldName = fieldName;
        this.message   = message;
    }

    public static ValidationResult ok(String fieldName) {
        return new ValidationResult(true, fieldName, "");
    }

    public static ValidationResult failure(String fieldName, String message) {
        return new ValidationResult(false, fieldName, message);
    }

    public boolean isValid()    { return valid; }
    public String  getField()   { return fieldName; }
    public String  getMessage() { return message; }

    @Override
    public String toString() {
        return valid ? "OK" : "FAIL: " + message;
    }
}

abstract class FieldValidator {

    private final String fieldName;

    protected FieldValidator(String fieldName) {
        if (fieldName == null || fieldName.isBlank())
            throw new IllegalArgumentException("fieldName must not be blank");
        this.fieldName = fieldName;
    }

    public final ValidationResult validate(String raw) {
        String normalised = normalise(raw);
        if (normalised == null || normalised.isEmpty())
            return ValidationResult.failure(fieldName, "Field is required");
        return check(normalised);
    }

    protected abstract String normalise(String raw);
    protected abstract ValidationResult check(String value);

    protected final String getFieldName() { return fieldName; }
}

class EmailValidator extends FieldValidator {
    public EmailValidator() { super("email"); }

    @Override
    protected String normalise(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase();
    }

    @Override
    protected ValidationResult check(String value) {
        if (!value.matches("[^@]+@[^@]+\\.[^@]+"))
            return ValidationResult.failure(getFieldName(), "Invalid email format");
        return ValidationResult.ok(getFieldName());
    }
}

class AgeValidator extends FieldValidator {
    public AgeValidator() { super("age"); }

    @Override
    protected String normalise(String raw) {
        return raw == null ? "" : raw.trim();
    }

    @Override
    protected ValidationResult check(String value) {
        int age;
        try {
            age = Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return ValidationResult.failure(getFieldName(), "Age must be a number");
        }
        if (age < 0 || age > 150)
            return ValidationResult.failure(getFieldName(), "Age must be between 0 and 150");
        return ValidationResult.ok(getFieldName());
    }
}

class UsernameValidator extends FieldValidator {
    public UsernameValidator() { super("username"); }

    @Override
    protected String normalise(String raw) {
        return raw == null ? "" : raw.trim();
    }

    @Override
    protected ValidationResult check(String value) {
        if (!value.matches("[a-zA-Z0-9]{3,20}"))
            return ValidationResult.failure(getFieldName(),
                "Username must be 3-20 alphanumeric characters");
        return ValidationResult.ok(getFieldName());
    }
}

class ValidatorDemo {
    public static void main(String[] args) {
        Object[][] cases = {
            { new EmailValidator(),    "  Alice@Example.COM  " },
            { new EmailValidator(),    "not-an-email"           },
            { new AgeValidator(),      " 25 "                   },
            { new AgeValidator(),      "200"                    },
            { new AgeValidator(),      "abc"                    },
            { new UsernameValidator(), "jo"                     },
            { new UsernameValidator(), "valid_user!"            },
            { new UsernameValidator(), "JavaDev42"              },
        };

        for (Object[] c : cases) {
            FieldValidator   validator = (FieldValidator) c[0];
            String           input     = (String) c[1];
            ValidationResult result    = validator.validate(input);
            System.out.printf("%-10s %-26s -> %s%n",
                              result.getField(), "\"" + input.strip() + "\"", result);
        }
    }
}`,
      explanation: `Three design decisions that matter here:

**1. The template method is \`final\`.**
Subclasses cannot call \`check\` directly, bypass \`normalise\`, or skip the null guard.
The base class owns the algorithm contract. This is the essential difference between a
template method and a plain override — the base \`final\`-stamps the skeleton.

**2. \`fieldName\` is \`private\`, not \`protected\`.**
Subclasses cannot reassign it. They access it read-only via the \`protected\` accessor
\`getFieldName()\`. This is fine-grained access control: expose what subclasses need,
hide what they shouldn't touch.

**3. \`ValidationResult\` is constructed only via static factories.**
The constructor is \`private\`. Callers always go through \`ok()\` or \`failure()\`, which
self-document the intent at the call site and prevent invalid states (e.g. a "valid"
result with a non-empty error message). Named constructors are a Java idiom you'll see
throughout the JDK (\`Optional.of\`, \`List.of\`, \`Duration.ofSeconds\`).`,
    },
    {
      id: 'access-modifier-design',
      title: 'Access control: restrict a mutable cache correctly',
      difficulty: 'challenge',
      prompt: `The class \`InMemoryCache\` below has **three access-control bugs** that allow callers
to corrupt its internal state. Find and fix them, then extend the design with one \`protected\`
hook for a subclass.

**Buggy version:**

~~~java
import java.util.HashMap;
import java.util.Map;

public class InMemoryCache {

    // Bug 1
    public Map<String, Object> store = new HashMap<>();

    // Bug 2
    public int maxSize;

    public InMemoryCache(int maxSize) {
        if (maxSize <= 0) throw new IllegalArgumentException("maxSize must be positive");
        this.maxSize = maxSize;
    }

    public void put(String key, Object value) {
        if (store.size() >= maxSize)
            evict();
        store.put(key, value);
    }

    public Object get(String key) {
        return store.get(key);
    }

    public int size() { return store.size(); }

    // Bug 3: this method is meant to be overridable by subclasses only
    public void evict() {
        if (!store.isEmpty())
            store.remove(store.keySet().iterator().next());
    }
}
~~~

**Your tasks:**

1. List the three bugs and explain how a caller could exploit each one.
2. Fix them (change access modifiers, add a defensive copy where needed).
3. Add a concrete subclass \`LruCache\` that overrides \`evict()\` to remove the
   **least-recently-used** key. Track access order by maintaining a \`LinkedList<String>\` of
   keys in recency order (most recent at tail). On \`put\`, add the key at the tail. On \`get\`,
   move the key to the tail. On \`evict\`, remove from the head.
4. \`LruCache\` must call \`super.put\` and \`super.get\` (use a \`protected\` getter to access
   the map from the subclass), not duplicate the null-check and size logic.

**Required output:**

~~~text
size=1
null
evicted: first key removed by LRU
~~~

Write a \`CacheDemo.main\` that:
- Creates an \`InMemoryCache\` of maxSize 2, puts "a" and "b", accesses "a", puts "c" (triggers evict), then gets "b" (should be null — it was LRU).
- Wait — that is for the \`LruCache\`. For the plain \`InMemoryCache\` just verify maxSize eviction works.
- Creates an \`LruCache\` of maxSize 2, puts "first", puts "second", gets "first" (making "second" LRU), puts "third" (evicts "second"), then prints \`cache.get("second")\` — should be null.`,
      starter: `import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;

public class InMemoryCache {

    // TODO: fix Bug 1 — visibility of the map
    public Map<String, Object> store = new HashMap<>();

    // TODO: fix Bug 2 — visibility of maxSize
    public int maxSize;

    public InMemoryCache(int maxSize) {
        if (maxSize <= 0) throw new IllegalArgumentException("maxSize must be positive");
        this.maxSize = maxSize;
    }

    public void put(String key, Object value) {
        if (store.size() >= maxSize)
            evict();
        store.put(key, value);
    }

    public Object get(String key) {
        return store.get(key);
    }

    public int size() { return store.size(); }

    // TODO: fix Bug 3 — visibility of evict()
    public void evict() {
        if (!store.isEmpty())
            store.remove(store.keySet().iterator().next());
    }

    // TODO: add a protected accessor so LruCache can read the map without exposing it publicly
}

class LruCache extends InMemoryCache {

    private final LinkedList<String> accessOrder = new LinkedList<>();

    public LruCache(int maxSize) {
        super(maxSize);
    }

    @Override
    public void put(String key, Object value) {
        // TODO: track key in accessOrder, then call super.put
    }

    @Override
    public Object get(String key) {
        // TODO: move key to tail of accessOrder, then call super.get
        return null;
    }

    @Override
    protected void evict() {
        // TODO: remove the head of accessOrder (LRU) from the map via the protected accessor
    }
}

class CacheDemo {
    public static void main(String[] args) {
        // Plain cache: just check it doesn't exceed maxSize
        InMemoryCache plain = new InMemoryCache(2);
        plain.put("x", 1);
        plain.put("y", 2);
        plain.put("z", 3);   // triggers evict; size stays <= 2
        System.out.println("size=" + plain.size());   // size=2

        // LRU cache
        LruCache lru = new LruCache(2);
        lru.put("first",  "A");
        lru.put("second", "B");
        lru.get("first");           // "first" is now MRU; "second" is LRU
        lru.put("third",  "C");     // evicts "second"
        System.out.println(lru.get("second"));   // null
        System.out.println("evicted: first key removed by LRU");
    }
}`,
      hints: [
        'Bug 1: the public map lets any caller do cache.store.clear() or cache.store.put("injected", malicious) — make it private. Add a protected Map<String, Object> getStore() accessor so LruCache can read it without re-exposing it.',
        'Bug 2: maxSize is public, so any caller can write cache.maxSize = Integer.MAX_VALUE, bypassing the constructor guard. Make it private final.',
        'Bug 3: evict() is public, so callers can manually trigger eviction at any time, violating the cache\'s own size invariant. Make it protected — visible to subclasses (LruCache) but not to arbitrary callers.',
      ],
      solution: `import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;

public class InMemoryCache {

    // Fix 1: private — only accessible through methods
    private final Map<String, Object> store = new HashMap<>();

    // Fix 2: private final — set once in the constructor, never changed
    private final int maxSize;

    public InMemoryCache(int maxSize) {
        if (maxSize <= 0) throw new IllegalArgumentException("maxSize must be positive");
        this.maxSize = maxSize;
    }

    public void put(String key, Object value) {
        if (store.size() >= maxSize)
            evict();
        store.put(key, value);
    }

    public Object get(String key) {
        return store.get(key);
    }

    public int size() { return store.size(); }

    // Fix 3: protected — overridable by subclasses, not callable by arbitrary code
    protected void evict() {
        if (!store.isEmpty())
            store.remove(store.keySet().iterator().next());
    }

    // Protected accessor — gives subclasses read access without re-exposing the field
    protected Map<String, Object> getStore() {
        return store;   // intentionally the live map; subclasses are trusted
    }
}

class LruCache extends InMemoryCache {

    private final LinkedList<String> accessOrder = new LinkedList<>();

    public LruCache(int maxSize) {
        super(maxSize);
    }

    @Override
    public void put(String key, Object value) {
        accessOrder.remove(key);   // remove if already tracked (update scenario)
        accessOrder.addLast(key);  // most recently used = tail
        super.put(key, value);     // size/evict logic stays in the base
    }

    @Override
    public Object get(String key) {
        Object val = super.get(key);
        if (val != null) {
            accessOrder.remove(key);
            accessOrder.addLast(key);  // promote to MRU
        }
        return val;
    }

    @Override
    protected void evict() {
        if (!accessOrder.isEmpty()) {
            String lruKey = accessOrder.removeFirst();   // LRU = head
            getStore().remove(lruKey);
        }
    }
}

class CacheDemo {
    public static void main(String[] args) {
        InMemoryCache plain = new InMemoryCache(2);
        plain.put("x", 1);
        plain.put("y", 2);
        plain.put("z", 3);
        System.out.println("size=" + plain.size());   // size=2

        LruCache lru = new LruCache(2);
        lru.put("first",  "A");
        lru.put("second", "B");
        lru.get("first");
        lru.put("third", "C");
        System.out.println(lru.get("second"));   // null
        System.out.println("evicted: first key removed by LRU");
    }
}`,
      explanation: `This exercise is about **defence through access control**, not just syntax.

**Bug 1 (public map):** A public mutable field breaks encapsulation completely. Anyone can iterate,
replace, or clear the map without going through the class's logic. Making it \`private\` forces
all interactions through \`put\`/\`get\`/\`evict\`, which contain the invariant logic. The
\`protected getStore()\` accessor gives \`LruCache\` just enough trust to remove entries in
\`evict()\` without re-exposing the whole map to the world.

**Bug 2 (public maxSize):** An immutable invariant should be \`private final\`. Once the
constructor validates and sets it, no code should be able to change it — not even subclasses.
\`private final\` enforces this at compile time.

**Bug 3 (public evict):** Eviction should be triggered by the cache's own put logic, not by
callers on demand. Making it \`protected\` allows the subclass \`LruCache\` to override the
eviction strategy (the whole point), while blocking arbitrary callers from manually evicting
entries.

The LRU logic itself: a \`LinkedList\` used as an access-order queue. The head is always the
least-recently-used key; the tail is the most-recently-used. On every access (put or get),
the key moves to the tail. On eviction, the head is removed. This is O(n) per access due to
\`LinkedList.remove(key)\`; a production LRU cache uses a \`LinkedHashMap\` with access order
enabled, which is O(1) — a worthwhile follow-up to explore.`,
    },
  ],
  takeaways: [
    'When two interfaces declare the **same \`default\` method**, any implementing class **must** override it — the compiler never guesses. Use \`InterfaceName.super.method()\` to delegate to a specific one.',
    'A class implementation always shadows a \`default\` method silently — retrofitting an interface onto an existing hierarchy never breaks it.',
    '**Enum constants are singletons** and cannot hold per-instance mutable state. Separate mutable data (e.g. balance) into a wrapper class; let the enum own transition logic only.',
    'The **Template Method pattern** uses a \`final\` concrete method in an abstract base to enforce a shared algorithm skeleton, with \`protected abstract\` hooks that subclasses fill in — one place for invariants, one place for variation.',
    '\`protected\` does **not** mean "visible to all subclasses everywhere." In a different package, a subclass can only access a \`protected\` member through its own type, not through a parent-type reference.',
    'Interface members are implicitly \`public\` — you cannot declare a \`protected\` or package-private interface method, and implementing classes must not narrow visibility.',
    'Fields should be \`private final\` by default; expose them through \`protected\` accessors only when a subclass genuinely needs them, and as \`public\` only when they form part of the stable API.',
  ],
}
