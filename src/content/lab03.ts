import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know OOP basics. Theory is a sharp
// refresher on nuance, gotchas, idioms and interview depth. Exercises
// target correctness traps and algorithmic substance at mid-interview level.

export const lab03: Lab = {
  id: 'lab-03',
  number: 3,
  title: 'Advanced Class Design',
  subtitle: 'Inheritance traps, polymorphism depth, equals/hashCode contracts, composition',
  estimatedHours: 6,
  concepts: [
    'inheritance',
    'dynamic dispatch',
    'field hiding',
    'equals contract',
    'hashCode contract',
    'Liskov substitution',
    'constructor pitfalls',
    'super',
    'composition',
    'final',
  ],
  overview: `You know the mechanics of \`extends\` and \`@Override\`. This lab goes to the sharp
edges: the **surprising interactions** that appear the moment you combine inheritance with
equality, constructor logic, or field declarations. Every section targets a class of bug
that passes code review until it blows up in production or in a pairing interview.

Theory is a crisp treatment of the nuances — skip what you already own and focus on the
gotchas. Exercises are where the investment pays off: each one is a correctness trap you
will actually encounter on the job.`,
  theory: [
    {
      id: 'field-hiding',
      heading: 'Field hiding vs method overriding — the dispatch asymmetry',
      body: `**Methods are dispatched on runtime type; fields are resolved on declared (static) type.**
This asymmetry is one of the most-missed Java subtleties.

~~~java
class Base {
    String label = "Base";
    String describe() { return "Base.describe"; }
}

class Child extends Base {
    String label = "Child";          // hides Base.label — NOT overriding
    @Override
    String describe() { return "Child.describe"; }
}

Base b = new Child();
System.out.println(b.describe());   // "Child.describe" — runtime type wins
System.out.println(b.label);        // "Base" — declared type wins for fields!

Child c = (Child) b;
System.out.println(c.label);        // "Child" — now declared type is Child
~~~

Field hiding is rarely intentional. When you declare a field in a subclass with the
same name as a superclass field, you get **two separate fields** on the same object.
Which one you see depends entirely on the compile-time type of the reference.

**Practical rule:** never shadow a field in a subclass. If you need to override
behaviour, always use a method. The JVM virtual method table gives you dynamic dispatch
for free; there is no equivalent mechanism for fields.

> **Interview question pattern:** "What does this print?" followed by a class hierarchy
> where a field and an overriding method share a name. The gotcha is always field hiding.`,
    },
    {
      id: 'constructor-pitfall',
      heading: 'Calling overridable methods from constructors',
      body: `**Never call an overridable (non-final) method from a constructor.** This is item 19
in *Effective Java* and one of the most counterintuitive Java bugs.

The problem: when you construct a subclass object, the **superclass constructor runs
first** — but at that point the subclass's fields have not been initialised yet
(they hold their default values: \`0\`, \`null\`, \`false\`). If the superclass constructor
calls a method that the subclass overrides, that override runs on a **partially
constructed object**.

~~~java
class Base {
    Base() {
        init();          // calls overridable method in constructor — DANGER
    }
    void init() {
        System.out.println("Base.init");
    }
}

class Child extends Base {
    private final String value = "hello";   // initialised AFTER super() completes

    @Override
    void init() {
        // value is still null here — the field assignment hasn't run yet
        System.out.println("Child.init: " + value);   // prints "Child.init: null"
    }
}

new Child();
// Output:
//   Child.init: null     <- surprising: value looks initialised but isn't yet
~~~

Execution order for \`new Child()\`:
1. Allocate memory; all fields set to defaults (\`null\`, \`0\`, \`false\`).
2. Run \`Base()\` — calls \`init()\`, which dispatches to \`Child.init()\`.
3. \`value\` is still \`null\` at step 2 — the assignment \`= "hello"\` runs at step 4.
4. Run field initialisers for \`Child\` (value = "hello").
5. Run \`Child\`'s constructor body.

**Fixes:**
- Make the called method \`private\` or \`final\` (not overridable).
- Use a factory method pattern that calls an \`init()\`-equivalent *after* the
  constructor chain completes.
- Redesign so subclasses pass data up through \`super()\` instead of overriding init hooks.`,
    },
    {
      id: 'equals-contract',
      heading: 'The equals/hashCode contract and the Liskov symmetry trap',
      body: `\`equals\` must satisfy four mathematical properties (the **Object contract**):
**reflexive**, **symmetric**, **transitive**, and **consistent**. The most dangerous to
violate is **symmetry**.

**The Liskov symmetry trap** arises when you use \`instanceof\` naively across a
superclass/subclass pair:

~~~java
class Point {
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Point p)) return false;   // accepts subclasses too
        return x == p.x && y == p.y;
    }
}

class ColorPoint extends Point {
    final String color;
    ColorPoint(int x, int y, String color) { super(x, y); this.color = color; }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof ColorPoint cp)) return false;  // stricter than parent
        return super.equals(o) && color.equals(cp.color);
    }
}

Point p   = new Point(1, 2);
ColorPoint cp = new ColorPoint(1, 2, "red");

System.out.println(p.equals(cp));    // true  — Point.equals accepts any Point subtype
System.out.println(cp.equals(p));    // false — ColorPoint.equals rejects non-ColorPoint
// SYMMETRY BROKEN: a.equals(b) != b.equals(a)
~~~

This violates the contract. Two canonical fixes:

**Fix A — \`getClass()\` check (strict equality):**
~~~java
@Override
public boolean equals(Object o) {
    if (o == null || getClass() != o.getClass()) return false;
    Point p = (Point) o;
    return x == p.x && y == p.y;
}
~~~
Now \`Point.equals(ColorPoint)\` returns \`false\`, restoring symmetry.
Trade-off: a \`Point\` and a \`ColorPoint\` at the same coordinates are never equal,
even when you only care about the coordinates. This is often correct.

**Fix B — composition instead of inheritance:**
Make \`ColorPoint\` hold a \`Point\` field (\`has-a\`) rather than extend it.
Then each class's \`equals\` only ever compares instances of its own type, and the
problem disappears entirely. This is the approach recommended by *Effective Java*.

**The hashCode rule:** if \`a.equals(b)\` then \`a.hashCode() == b.hashCode()\`.
With the broken equals above, a \`HashSet<Point>\` containing \`p\` will not recognise
\`cp\` as a duplicate because the broken symmetry means lookup uses the wrong bucket.`,
    },
    {
      id: 'polymorphism-depth',
      heading: 'Polymorphism depth: super calls and template method',
      body: `When a subclass overrides a method it can still **compose** the parent's
behaviour using \`super.method()\`. This is the basis of the **template method** pattern:
the superclass defines the algorithm skeleton; subclasses override steps.

~~~java
abstract class Report {
    // Template method — final so the skeleton can't be reordered
    public final String generate() {
        return header() + "\\n" + body() + "\\n" + footer();
    }
    protected String header() { return "=== Report ==="; }
    protected abstract String body();
    protected String footer() { return "=== End ==="; }
}

class SalesReport extends Report {
    private final int units;
    SalesReport(int units) { this.units = units; }

    @Override
    protected String body() {
        return "Units sold: " + units;
    }

    @Override
    protected String footer() {
        return super.footer() + " [Sales dept]";   // extend, don't replace
    }
}
~~~

Key points:
- \`final\` on the template method prevents subclasses from accidentally reordering steps.
- \`super.footer()\` composes rather than replaces the parent's footer — a much safer
  pattern than duplicating the parent string.
- \`abstract\` forces subclasses to supply the body; leaving it concrete with a default
  is valid if a sensible default exists.

**Dynamic dispatch applies to all virtual methods, including those called from within
the class.** If \`generate()\` were not \`final\` and a subclass overrode \`generate()\`,
any call to \`generate()\` on a subclass reference would skip the template.`,
    },
    {
      id: 'object-methods',
      heading: 'Object methods in depth: toString, clone, finalize',
      body: `Beyond \`equals\`/\`hashCode\`, three other inherited methods deserve mention:

**\`toString()\`** — called implicitly by \`println\`, \`+\` concatenation, and most loggers.
The default \`ClassName@hexHash\` is useless in logs. Always override it for any
non-trivial class. Use \`String.format\` or a \`StringBuilder\` for multi-field classes.

**\`clone()\`** — protected and throws \`CloneNotSupportedException\` unless you implement
\`Cloneable\`. Even then, the default clone is a **shallow copy**: nested mutable objects
are shared, not duplicated. This is almost always wrong for objects with mutable fields.
Prefer a copy constructor or a static factory method:

~~~java
// Copy constructor — explicit, understandable, no Cloneable ceremony
class Range {
    final int lo, hi;
    Range(int lo, int hi) { this.lo = lo; this.hi = hi; }
    Range(Range other)    { this(other.lo, other.hi); }   // copy constructor
}
~~~

**\`finalize()\`** — deprecated since Java 9, removed in Java 18. Do not use it.
If you need deterministic cleanup, implement \`AutoCloseable\` and use try-with-resources.

**\`getClass()\`** — returns the \`Class\` object for the runtime type. Useful for
logging (\`getClass().getSimpleName()\`) and for strict equality checks as shown in the
previous section.`,
    },
    {
      id: 'composition',
      heading: 'Composition vs inheritance — when each is right',
      body: `The *Gang of Four* rule: **"Favour object composition over class inheritance."**
The reasoning is pragmatic, not dogmatic.

**Inheritance couples tightly at compile time.** Every internal method and field
of the superclass becomes an implicit contract that all subclasses depend on.
Refactoring the superclass can silently break subclasses you didn't touch.

**Composition couples loosely at runtime.** You depend only on the public API of
the held object, which you can swap behind an interface.

Rule of thumb for the decision:
- True **"is-a"** with a stable hierarchy? Inheritance is fine.
  \`IOException extends Exception\` — will never not be an exception.
- **"has-a"** or **"uses-a"**? Composition.
  A \`UserService\` that uses a \`UserRepository\` should hold a field, not extend it.
- Want to reuse *behaviour* but the "is-a" test fails? Composition + delegation.

~~~java
// Stack built by inheriting Vector — famous bad design in java.util
// (exposes add/remove at arbitrary positions, breaking the stack contract)
class BadStack<T> extends Vector<T> { ... }

// Stack built by composing a Deque — only stack operations are exposed
class GoodStack<T> {
    private final Deque<T> deque = new ArrayDeque<>();
    public void push(T item) { deque.push(item); }
    public T    pop()        { return deque.pop(); }
    public T    peek()       { return deque.peek(); }
    public int  size()       { return deque.size(); }
}
~~~

The \`final\` keyword enforces your design intent: a \`final\` class cannot be extended
(e.g. \`String\`, all boxed types). A \`final\` method cannot be overridden. Use both
liberally — relaxing them later is always possible; the damage from accidental
extension is hard to undo.`,
    },
    {
      id: 'instanceof-patterns',
      heading: 'instanceof: pattern matching, sealed classes, and design smells',
      body: `**Pattern-matching instanceof (Java 16+)** eliminates the explicit downcast:

~~~java
// Old — two steps, easy to forget the cast
if (shape instanceof Circle) {
    Circle c = (Circle) shape;
    return Math.PI * c.radius * c.radius;
}

// New — single step, c is scoped to the if block
if (shape instanceof Circle c) {
    return Math.PI * c.radius * c.radius;
}
~~~

**Switch pattern matching (Java 21)** is cleaner still for exhaustive dispatch:

~~~java
double area = switch (shape) {
    case Circle c    -> Math.PI * c.radius * c.radius;
    case Rectangle r -> r.width * r.height;
    default          -> throw new IllegalStateException("unknown: " + shape);
};
~~~

**Sealed classes (Java 17+)** restrict which classes can extend a type, making
switch exhaustive without a \`default\`:

~~~java
sealed interface Shape permits Circle, Rectangle {}
record Circle(double radius)            implements Shape {}
record Rectangle(double w, double h)    implements Shape {}

// Compiler guarantees exhaustiveness — no default needed
double area = switch (shape) {
    case Circle c    -> Math.PI * c.radius * c.radius;
    case Rectangle r -> r.w * r.h;
};
~~~

**Design smell:** a chain of \`instanceof\` checks (\`if … else if … else if\`) that would
grow whenever a new subtype is added is a strong signal to introduce a polymorphic
method instead. The sealed + pattern-switch idiom is the modern exception: it keeps
the dispatch explicit and the compiler enforces completeness.`,
    },
  ],
  exercises: [
    {
      id: 'field-hiding-predict',
      title: 'Predict the output — field hiding vs method overriding',
      difficulty: 'warmup',
      prompt: `**Before running this, predict the exact output of every labelled line.**
Write your prediction as a comment, then run and reconcile any surprise.

~~~java
public class Predict {

    static class Vehicle {
        String type = "Vehicle";
        String kind() { return "Vehicle"; }
    }

    static class Car extends Vehicle {
        String type = "Car";          // shadows, does NOT override
        @Override
        String kind() { return "Car"; }
    }

    static class ElectricCar extends Car {
        String type = "ElectricCar";
        @Override
        String kind() { return "ElectricCar"; }
    }

    public static void main(String[] args) {
        Vehicle v = new Car();
        System.out.println(v.type);      // A
        System.out.println(v.kind());    // B

        Car c = new ElectricCar();
        System.out.println(c.type);      // C
        System.out.println(c.kind());    // D

        Vehicle v2 = new ElectricCar();
        System.out.println(v2.type);     // E
        System.out.println(v2.kind());   // F

        Vehicle v3 = new Car();
        Car c2 = (Car) v3;
        System.out.println(c2.type);     // G
    }
}
~~~

For each line, give: (1) the predicted value, (2) one sentence explaining the rule
that determines it.`,
      starter: `// Predict each labelled line BEFORE running.
// A:
// B:
// C:
// D:
// E:
// F:
// G:`,
      hints: [
        'Fields are resolved by the DECLARED (compile-time) type of the reference. Methods are resolved by the RUNTIME type of the object.',
        'After the downcast on the last line, the declared type of c2 is Car — so c2.type gives the Car field.',
        'ElectricCar overrides kind() all the way down the chain. No matter how the reference is typed, kind() always returns the most-derived override.',
      ],
      solution: `// A: "Vehicle"   — v is declared as Vehicle; field lookup uses declared type
// B: "Car"        — kind() is virtual; runtime object is Car, so Car.kind() runs
// C: "Car"        — c is declared as Car; field lookup uses declared type, giving Car.type
// D: "ElectricCar"— kind() dispatches to runtime type ElectricCar
// E: "Vehicle"    — v2 is declared as Vehicle; field lookup uses declared type
// F: "ElectricCar"— kind() dispatches to runtime type ElectricCar
// G: "Car"        — after downcast, declared type is Car; Car.type is "Car"`,
      explanation: `This is the **field hiding vs method overriding asymmetry** in concentrated form.

**Methods** use the JVM's virtual method table. Every call is resolved at runtime
to the most-derived override regardless of the reference's compile-time type.
That is dynamic dispatch.

**Fields** have no equivalent mechanism. The compiler resolves a field access at
compile time based solely on the declared type of the reference. When a subclass
declares a field with the same name, it creates a *new*, independent field.
The parent's field still exists on the object — you just can't reach it through
a child-typed reference without an explicit cast.

Lines A/C/E/G all show the declared-type rule for fields; B/D/F show runtime
dispatch for methods. If A and B surprised you, this pattern is the thing to
internalise before any Java systems interview.`,
    },
    {
      id: 'constructor-overridable',
      title: 'The overridable-method-in-constructor trap',
      difficulty: 'core',
      prompt: `The program below produces surprising output because a constructor calls an
overridable method. Your tasks:

**Part 1 — Predict.** What does \`new Child()\` print? Write your prediction before
running.

~~~java
public class CtorTrap {

    static class Base {
        private final int multiplier;

        Base(int multiplier) {
            this.multiplier = multiplier;
            System.out.println("Base ctor, multiplier=" + multiplier);
            setup();   // calls overridable method — DANGER
        }

        void setup() {
            System.out.println("Base.setup: " + (10 * multiplier));
        }
    }

    static class Child extends Base {
        private final int offset;   // assigned AFTER super() completes

        Child() {
            super(3);
            this.offset = 7;
            System.out.println("Child ctor, offset=" + offset);
        }

        @Override
        void setup() {
            // offset is not yet initialised when this runs via super()!
            System.out.println("Child.setup: " + (10 + offset));
        }
    }

    public static void main(String[] args) {
        new Child();
    }
}
~~~

**Part 2 — Fix.** Rewrite \`Base\` so that \`setup()\` is called safely — the behaviour
(printing \`"Base.setup: 30"\` when \`multiplier=3\`) must be preserved for the base case,
but the subclass override must no longer see uninitialised state. Use any of the
approaches described in the theory: make \`setup()\` \`final\`, or remove the call from
the constructor entirely (factory method).

Write your fix as a compilable class and add a \`main\` that verifies it.`,
      starter: `public class CtorTrap {

    // Part 1: write your predicted output here as comments
    // Line 1:
    // Line 2:
    // Line 3:
    // Line 4:

    // Part 2: rewrite Base (and Child if needed) so the trap is eliminated.
    // Keep setup() callable and producing the same result for the base case.

    static class Base {
        private final int multiplier;

        Base(int multiplier) {
            this.multiplier = multiplier;
            System.out.println("Base ctor, multiplier=" + multiplier);
            setup();
        }

        void setup() {
            System.out.println("Base.setup: " + (10 * multiplier));
        }
    }

    static class Child extends Base {
        private final int offset;

        Child() {
            super(3);
            this.offset = 7;
            System.out.println("Child ctor, offset=" + offset);
        }

        @Override
        void setup() {
            System.out.println("Child.setup: " + (10 + offset));
        }
    }

    public static void main(String[] args) {
        new Child();
    }
}`,
      hints: [
        'Part 1: remember the construction order — (1) all fields default to 0/null, (2) super() runs, (3) field initialisers, (4) constructor body. At step 2, offset is still 0.',
        'Part 2 — simplest fix: mark setup() as final in Base. Then Child cannot override it and the super-constructor always calls Base.setup() regardless of the runtime type.',
        'Part 2 — factory method approach: make the Base constructor private, expose a static factory that calls new Base(n) then calls setup() on the freshly constructed object. Subclasses do the same.',
      ],
      solution: `public class CtorTrap {

    // Part 1 predictions:
    // "Base ctor, multiplier=3"
    // "Child.setup: 10"          <- offset is 0 (default), not 7 yet
    // "Child ctor, offset=7"

    // Part 2 fix: make setup() final so the constructor always calls Base.setup()
    static class Base {
        private final int multiplier;

        Base(int multiplier) {
            this.multiplier = multiplier;
            System.out.println("Base ctor, multiplier=" + multiplier);
            setup();
        }

        // final — cannot be overridden; constructor call is now safe
        final void setup() {
            System.out.println("Base.setup: " + (10 * multiplier));
        }
    }

    static class Child extends Base {
        private final int offset;

        Child() {
            super(3);
            this.offset = 7;
            System.out.println("Child ctor, offset=" + offset);
            // If Child needs its own setup logic, call it here — after full init
            childSetup();
        }

        // Renamed to avoid confusion with the now-final setup()
        void childSetup() {
            System.out.println("Child.childSetup: " + (10 + offset));  // offset=7, correct
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Original (broken) ===");
        // Uncomment to see the broken output:
        // new OriginalChild();

        System.out.println("=== Fixed ===");
        new Child();
        // Output:
        // Base ctor, multiplier=3
        // Base.setup: 30
        // Child ctor, offset=7
        // Child.childSetup: 17
    }
}`,
      explanation: `**Part 1.** Construction order for \`new Child()\`:
1. Memory allocated; all fields default (\`multiplier=0\`, \`offset=0\`).
2. \`Child()\` calls \`super(3)\` — \`Base\` constructor runs.
3. Inside \`Base()\`: \`multiplier\` is set to 3, then \`setup()\` is called.
4. \`setup()\` dispatches to \`Child.setup()\` (dynamic dispatch, as always) — but
   \`offset\` is still \`0\` because the field initialiser (\`= 7\`) runs at step 5.
5. \`this.offset = 7\` — field initialiser runs.
6. \`Child()\` body continues: prints \`"Child ctor, offset=7"\`.

Result: \`"Child.setup: 10"\` (10 + 0) instead of the expected \`"Child.setup: 17"\`.

**Part 2.** Marking \`setup()\` \`final\` breaks the virtual dispatch — the constructor
now always calls \`Base.setup()\` and \`offset\`'s unitialised state is never observed.
If the child needs to perform its own post-construction work, it does so in its own
constructor body *after* all fields are initialised.

The factory-method alternative keeps more flexibility but adds more boilerplate.
Both approaches are valid; \`final\` is simpler and communicates intent clearly.`,
    },
    {
      id: 'equals-symmetry-fix',
      title: 'Fix the broken equals() symmetry across a class hierarchy',
      difficulty: 'core',
      prompt: `The \`Money\` class below and its subclass \`TaggedMoney\` have a broken \`equals\`
implementation: **symmetry is violated**.

~~~java
import java.util.Objects;

class Money {
    protected final long cents;
    protected final String currency;

    Money(long cents, String currency) {
        this.cents = cents;
        this.currency = Objects.requireNonNull(currency);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Money m)) return false;
        return cents == m.cents && currency.equals(m.currency);
    }

    @Override public int hashCode() { return Objects.hash(cents, currency); }
}

class TaggedMoney extends Money {
    private final String tag;

    TaggedMoney(long cents, String currency, String tag) {
        super(cents, currency);
        this.tag = Objects.requireNonNull(tag);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof TaggedMoney t)) return false;
        return super.equals(o) && tag.equals(t.tag);
    }

    @Override public int hashCode() { return Objects.hash(super.hashCode(), tag); }
}
~~~

**Your tasks:**

1. Write a short \`main\` that **demonstrates the broken symmetry** — two assertions
   where \`a.equals(b)\` and \`b.equals(a)\` return different values.

2. **Fix the hierarchy.** Use the \`getClass()\` approach in \`Money.equals\` so that
   equality is strict: two objects are equal only when they are the same concrete class.
   Update \`TaggedMoney.equals\` consistently. Both classes must satisfy the full contract
   (reflexive, symmetric, transitive, consistent, null-safe) after your fix.

3. In \`main\`, add assertions that verify symmetry holds for both:
   - Two \`Money\` instances with the same values.
   - A \`Money\` and a \`TaggedMoney\` at the same cents/currency (must now be \`false\`).
   - Two \`TaggedMoney\` instances with matching values.`,
      starter: `import java.util.Objects;

public class EqualsSymmetry {

    static class Money {
        protected final long cents;
        protected final String currency;

        Money(long cents, String currency) {
            this.cents = cents;
            this.currency = Objects.requireNonNull(currency);
        }

        @Override
        public boolean equals(Object o) {
            // TODO: fix using getClass() instead of instanceof
            if (!(o instanceof Money m)) return false;
            return cents == m.cents && currency.equals(m.currency);
        }

        @Override
        public int hashCode() { return Objects.hash(cents, currency); }

        @Override
        public String toString() {
            return String.format("%s %.2f", currency, cents / 100.0);
        }
    }

    static class TaggedMoney extends Money {
        private final String tag;

        TaggedMoney(long cents, String currency, String tag) {
            super(cents, currency);
            this.tag = Objects.requireNonNull(tag);
        }

        @Override
        public boolean equals(Object o) {
            // TODO: fix consistently with Money
            if (!(o instanceof TaggedMoney t)) return false;
            return super.equals(o) && tag.equals(t.tag);
        }

        @Override
        public int hashCode() { return Objects.hash(super.hashCode(), tag); }

        @Override
        public String toString() {
            return super.toString() + " [" + tag + "]";
        }
    }

    public static void main(String[] args) {
        // TODO Part 1: show broken symmetry with the ORIGINAL code
        // (comment out before submitting, or keep as a before/after demo)

        // TODO Part 2/3: after fix, assert symmetry holds
    }
}`,
      hints: [
        'For Part 1 — broken case: Money m = new Money(1000, "EUR"); TaggedMoney t = new TaggedMoney(1000, "EUR", "promo"); — then print m.equals(t) and t.equals(m) and notice they differ.',
        'For the getClass() fix: replace if (!(o instanceof Money m)) with if (o == null || getClass() != o.getClass()) return false; Money m = (Money) o; — now a Money and a TaggedMoney at the same coordinates are never equal.',
        'TaggedMoney.equals must call super.equals(o) for the getClass() check to propagate correctly — do not re-implement the cents/currency comparison.',
      ],
      solution: `import java.util.Objects;

public class EqualsSymmetry {

    static class Money {
        protected final long cents;
        protected final String currency;

        Money(long cents, String currency) {
            this.cents = cents;
            this.currency = Objects.requireNonNull(currency);
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;  // strict class check
            Money m = (Money) o;
            return cents == m.cents && currency.equals(m.currency);
        }

        @Override
        public int hashCode() { return Objects.hash(cents, currency); }

        @Override
        public String toString() {
            return String.format("%s %.2f", currency, cents / 100.0);
        }
    }

    static class TaggedMoney extends Money {
        private final String tag;

        TaggedMoney(long cents, String currency, String tag) {
            super(cents, currency);
            this.tag = Objects.requireNonNull(tag);
        }

        @Override
        public boolean equals(Object o) {
            if (!super.equals(o)) return false;   // handles null, class check, cents/currency
            TaggedMoney t = (TaggedMoney) o;      // safe: super.equals verified getClass()
            return tag.equals(t.tag);
        }

        @Override
        public int hashCode() { return Objects.hash(super.hashCode(), tag); }

        @Override
        public String toString() {
            return super.toString() + " [" + tag + "]";
        }
    }

    public static void main(String[] args) {
        Money m1 = new Money(1000, "EUR");
        Money m2 = new Money(1000, "EUR");
        TaggedMoney t1 = new TaggedMoney(1000, "EUR", "promo");
        TaggedMoney t2 = new TaggedMoney(1000, "EUR", "promo");
        TaggedMoney t3 = new TaggedMoney(1000, "EUR", "sale");

        // Symmetry: Money vs Money
        System.out.println("m1.equals(m2): " + m1.equals(m2));   // true
        System.out.println("m2.equals(m1): " + m2.equals(m1));   // true

        // Cross-type: must be false both ways
        System.out.println("m1.equals(t1): " + m1.equals(t1));   // false
        System.out.println("t1.equals(m1): " + t1.equals(m1));   // false — symmetric!

        // TaggedMoney vs TaggedMoney
        System.out.println("t1.equals(t2): " + t1.equals(t2));   // true
        System.out.println("t1.equals(t3): " + t1.equals(t3));   // false

        // hashCode consistency with equals
        System.out.println("m1 hash == m2 hash: " + (m1.hashCode() == m2.hashCode())); // true
        System.out.println("t1 hash == t2 hash: " + (t1.hashCode() == t2.hashCode())); // true
    }
}`,
      explanation: `**Root cause of the original bug.** \`Money.equals\` uses \`instanceof Money\`, which
returns \`true\` for any \`TaggedMoney\` (it is a subtype). So \`m.equals(t)\` returns
\`true\` (cent/currency match, no tag check). But \`TaggedMoney.equals\` uses
\`instanceof TaggedMoney\`, which returns \`false\` for a plain \`Money\`. Result:
\`m.equals(t) == true\` but \`t.equals(m) == false\` — symmetry broken.

**The \`getClass()\` fix.** \`getClass() != o.getClass()\` returns \`true\` whenever
the two objects are of different concrete classes. Now \`Money.equals(TaggedMoney)\`
returns \`false\` immediately, and \`TaggedMoney.equals(Money)\` also returns \`false\`
(via \`super.equals\`). Symmetry is restored.

**Why \`super.equals(o)\` is correct in \`TaggedMoney\`.** Because \`Money.equals\`
now performs the \`getClass()\` check, calling \`super.equals(o)\` from \`TaggedMoney\`
is safe: it verifies both objects are \`TaggedMoney\` instances (not just that \`o\`
is a \`TaggedMoney\`) before doing the cents/currency comparison. The downcast
\`(TaggedMoney) o\` is therefore guaranteed safe.

**Trade-off.** \`getClass()\` is stricter than \`instanceof\`: a \`Point\` and a
\`ColorPoint\` at the same coordinates are never equal. For value types this is
usually correct — a tagged amount is not the same thing as an untagged one.
The composition alternative (\`ColorPoint\` holds a \`Point\` field) avoids the
problem entirely by eliminating the subtype relationship.`,
    },
    {
      id: 'expression-tree',
      title: 'Polymorphic expression tree with super-composed eval()',
      difficulty: 'challenge',
      prompt: `Build a small **expression tree** where nodes evaluate themselves
polymorphically. Then extend it with a discounting node that composes its parent's
result using \`super\`.

**Requirements:**

1. Base class \`Expr\` with a single method \`public double eval()\` that returns \`0.0\`
   and a \`public String label()\` that returns \`"Expr"\`.

2. \`Literal extends Expr\` — wraps a \`double value\`. \`eval()\` returns \`value\`.
   \`label()\` returns the value formatted to 2 decimal places.

3. \`Sum extends Expr\` — holds an \`Expr[] terms\` (variable-length via varargs constructor).
   \`eval()\` returns the sum of \`term.eval()\` for all terms.
   \`label()\` returns \`"Sum("\` + the comma-joined labels of its terms + \`")"\`.

4. \`Product extends Expr\` — same idea, multiplies all terms. Identity is \`1.0\`.
   \`label()\` returns \`"Product("\` ... \`")"\`.

5. \`Discounted extends Expr\` — wraps another \`Expr inner\` and a \`double rate\` (e.g.
   \`0.1\` = 10% off). \`eval()\` returns \`inner.eval() * (1.0 - rate)\`.
   \`label()\` returns \`"Discount(" + rate*100 + "% off " + inner.label() + ")"\`.

**In main, build and evaluate:**

~~~text
Expr price = new Sum(
    new Literal(100.00),
    new Product(new Literal(3.0), new Literal(15.00))
);
Expr discounted = new Discounted(price, 0.10);
~~~

Expected output:

~~~text
Sum(100.00, Product(3.00, 15.00)) = 145.00
Discount(10.0% off Sum(100.00, Product(3.00, 15.00))) = 130.50
~~~

**Bonus challenge:** add a \`ScaledExpr extends Discounted\` that applies an additional
fixed surcharge after the discount. Override \`eval()\` using \`super.eval()\` to compose —
do not re-implement the discount logic.`,
      starter: `public class ExprTree {

    static class Expr {
        public double eval()  { return 0.0; }
        public String label() { return "Expr"; }
    }

    static class Literal extends Expr {
        private final double value;
        Literal(double value) { this.value = value; }

        @Override public double eval()  { /* TODO */ return 0; }
        @Override public String label() { /* TODO: format to 2 decimals */ return ""; }
    }

    static class Sum extends Expr {
        private final Expr[] terms;
        Sum(Expr... terms) { this.terms = terms; }

        @Override
        public double eval() {
            // TODO: sum of term.eval() for all terms
            return 0;
        }

        @Override
        public String label() {
            // TODO: "Sum(" + comma-joined term labels + ")"
            return "";
        }
    }

    static class Product extends Expr {
        private final Expr[] terms;
        Product(Expr... terms) { this.terms = terms; }

        @Override public double eval()  { /* TODO: product, identity 1.0 */ return 0; }
        @Override public String label() { /* TODO */ return ""; }
    }

    static class Discounted extends Expr {
        protected final Expr inner;
        protected final double rate;
        Discounted(Expr inner, double rate) { this.inner = inner; this.rate = rate; }

        @Override public double eval()  { /* TODO */ return 0; }
        @Override public String label() { /* TODO */ return ""; }
    }

    // Bonus: ScaledExpr extends Discounted — add it here

    public static void main(String[] args) {
        Expr price = new Sum(
            new Literal(100.00),
            new Product(new Literal(3.0), new Literal(15.00))
        );
        Expr discounted = new Discounted(price, 0.10);

        System.out.printf("%s = %.2f%n", price.label(), price.eval());
        System.out.printf("%s = %.2f%n", discounted.label(), discounted.eval());

        // Bonus: ScaledExpr — 10% discount then +5 surcharge
        // Expr scaled = new ScaledExpr(price, 0.10, 5.00);
        // System.out.printf("%s = %.2f%n", scaled.label(), scaled.eval());
    }
}`,
      hints: [
        'For Sum.label() use a StringBuilder and a loop: append term.label(), add ", " between elements (not after the last one), then wrap in "Sum(" + sb + ")".',
        'For Product.eval(), initialise double result = 1.0 and multiply — identity element for multiplication, not 0.',
        'For ScaledExpr: extend Discounted, add a double surcharge field. eval() returns super.eval() + surcharge. label() can call super.label() and append the surcharge info.',
      ],
      solution: `public class ExprTree {

    static class Expr {
        public double eval()  { return 0.0; }
        public String label() { return "Expr"; }
    }

    static class Literal extends Expr {
        private final double value;
        Literal(double value) { this.value = value; }

        @Override public double eval()  { return value; }
        @Override public String label() { return String.format("%.2f", value); }
    }

    static class Sum extends Expr {
        private final Expr[] terms;
        Sum(Expr... terms) { this.terms = terms; }

        @Override
        public double eval() {
            double sum = 0;
            for (Expr t : terms) sum += t.eval();
            return sum;
        }

        @Override
        public String label() {
            StringBuilder sb = new StringBuilder("Sum(");
            for (int i = 0; i < terms.length; i++) {
                if (i > 0) sb.append(", ");
                sb.append(terms[i].label());
            }
            return sb.append(")").toString();
        }
    }

    static class Product extends Expr {
        private final Expr[] terms;
        Product(Expr... terms) { this.terms = terms; }

        @Override
        public double eval() {
            double product = 1.0;
            for (Expr t : terms) product *= t.eval();
            return product;
        }

        @Override
        public String label() {
            StringBuilder sb = new StringBuilder("Product(");
            for (int i = 0; i < terms.length; i++) {
                if (i > 0) sb.append(", ");
                sb.append(terms[i].label());
            }
            return sb.append(")").toString();
        }
    }

    static class Discounted extends Expr {
        protected final Expr inner;
        protected final double rate;

        Discounted(Expr inner, double rate) {
            this.inner = inner;
            this.rate = rate;
        }

        @Override
        public double eval() { return inner.eval() * (1.0 - rate); }

        @Override
        public String label() {
            return "Discount(" + (rate * 100) + "% off " + inner.label() + ")";
        }
    }

    // Bonus: applies discount then adds a fixed surcharge
    static class ScaledExpr extends Discounted {
        private final double surcharge;

        ScaledExpr(Expr inner, double rate, double surcharge) {
            super(inner, rate);
            this.surcharge = surcharge;
        }

        @Override
        public double eval() {
            return super.eval() + surcharge;  // compose — don't duplicate discount logic
        }

        @Override
        public String label() {
            return super.label() + " + surcharge " + String.format("%.2f", surcharge);
        }
    }

    public static void main(String[] args) {
        Expr price = new Sum(
            new Literal(100.00),
            new Product(new Literal(3.0), new Literal(15.00))
        );
        Expr discounted = new Discounted(price, 0.10);
        Expr scaled = new ScaledExpr(price, 0.10, 5.00);

        System.out.printf("%s = %.2f%n", price.label(), price.eval());
        System.out.printf("%s = %.2f%n", discounted.label(), discounted.eval());
        System.out.printf("%s = %.2f%n", scaled.label(), scaled.eval());
        // Sum(100.00, Product(3.00, 15.00)) = 145.00
        // Discount(10.0% off Sum(100.00, Product(3.00, 15.00))) = 130.50
        // Discount(10.0% off Sum(100.00, Product(3.00, 15.00))) + surcharge 5.00 = 135.50
    }
}`,
      explanation: `This exercise exercises three core design patterns simultaneously.

**Composite pattern.** \`Sum\` and \`Product\` hold arrays of \`Expr\`, and an \`Expr\`
can itself be a \`Sum\` or \`Product\`. The tree can be arbitrarily deep; \`eval()\` recurses
naturally through dynamic dispatch without any type-checking.

**Decorator pattern.** \`Discounted\` wraps another \`Expr\` and forwards the \`eval()\`
call after applying the discount. This is pure composition: no inheritance from the
wrapped class.

**Template composition with \`super\`.** \`ScaledExpr\` extends \`Discounted\` and calls
\`super.eval()\` to get the discounted amount, then adds the surcharge. The discount
logic is written exactly once; \`ScaledExpr\` only contributes the surcharge delta.
This is the right use of inheritance: the subclass is genuinely a specialisation of
the parent, the "is-a" test passes, and \`super\` lets it compose rather than duplicate.

**Why \`Product\`'s identity is 1.0.** The multiplicative identity is 1 — multiplying
by it leaves the result unchanged, the same role that 0 plays for addition. Starting
with 0 would always produce 0.

For production use, a sealed hierarchy (\`sealed interface Expr permits Literal, Sum,
Product, Discounted\`) combined with pattern-switch evaluation would eliminate the
virtual dispatch overhead and make exhaustiveness compiler-checked.`,
    },
  ],
  takeaways: [
    '**Fields are resolved by declared type; methods are resolved by runtime type.** Field hiding is almost always a design mistake — use methods for extensible behaviour.',
    'Never call an overridable method from a constructor. At the time the superclass constructor runs, the subclass fields are still at their zero/null defaults, and a polymorphic call will observe that uninitialised state.',
    'The \`equals\` contract requires symmetry: if \`instanceof\` is used naively across a class hierarchy, \`a.equals(b)\` can differ from \`b.equals(a)\`. Fix with \`getClass()\` or by replacing inheritance with composition.',
    '\`getClass()\` in \`equals\` enforces strict type equality — a superclass and subclass instance are never equal even when their common fields match. This is usually the right choice for value types.',
    'Use \`super.method()\` to compose, not replace, the parent\'s behaviour. This is the basis of the template-method pattern and avoids logic duplication across an inheritance chain.',
    'Favour composition when a class merely *uses* another rather than *being* a specialisation of it. Composition gives you looser coupling, easier testing, and freedom to change internals without breaking subclasses.',
    'Mark things \`final\` by default — classes, methods, fields. Relaxing is always possible; the damage from accidental extension or mutation is hard to undo.',
  ],
}
