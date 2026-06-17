import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab02: Lab = {
  id: 'lab-02',
  number: 2,
  title: 'Objects in Java',
  subtitle: 'References, equality contracts, immutability traps, and value-type design',
  estimatedHours: 6,
  concepts: [
    'equals/hashCode contract',
    'reference vs value equality',
    'defensive copying',
    'immutability',
    'Comparable',
    'value types',
    'aliasing',
    'HashSet/HashMap correctness',
  ],
  overview: `You already know how to write a class with private fields and a constructor. This
lab goes one layer deeper — the parts that separate code that *works in unit tests*
from code that *works in production*:

- Why a broken \`hashCode\` silently loses objects from a \`HashSet\`.
- How to design a numeric value type (\`Rational\`) that correctly implements
  \`equals\`, \`hashCode\`, and \`Comparable\` — the trifecta needed for collections.
- Why an "immutable" class that hands out a mutable field reference is not actually
  immutable, and how defensive copying fixes it.
- The reference-vs-value minefield: aliasing, \`==\`, interning, and every trap that
  shows up in "predict the output" interview questions.

Theory is a fast refresher on the contracts and idioms. The exercises are the
real work — each one is calibrated to the kind of question you'd see in a
mid-level Java interview or code review.`,
  theory: [
    {
      id: 'references-aliasing',
      heading: 'References, aliasing, and the == trap',
      body: `Every non-primitive variable holds a **reference** — a pointer to an object on
the heap, never the object itself. Assigning or passing a reference copies the
pointer, not the data:

~~~java
int[] a = {1, 2, 3};
int[] b = a;          // b and a point at the same array
b[0] = 99;
System.out.println(a[0]);   // 99 — aliasing!
~~~

**\`==\` on reference types tests identity (same object?), not equality (same value?).**
This is the most-tested Java gotcha after integer overflow.

~~~java
String s1 = new String("java");
String s2 = new String("java");
System.out.println(s1 == s2);        // false — two heap objects
System.out.println(s1.equals(s2));   // true  — same char sequence

// String literals are interned — a JVM implementation detail you cannot rely on:
String s3 = "java";
String s4 = "java";
System.out.println(s3 == s4);        // true (usually) — same interned object
// Never write production code that depends on literal interning.
~~~

The box on \`Integer\` is even more treacherous because the cache range makes \`==\`
sometimes-true:

~~~java
Integer x = 127, y = 127;
System.out.println(x == y);   // true  — cached singleton
Integer p = 128, q = 128;
System.out.println(p == q);   // false — distinct heap objects
~~~

Rule: **use \`.equals()\` for object content, \`==\` only for null-check or
intentional identity test**.`,
    },
    {
      id: 'equals-contract',
      heading: 'The equals() contract — and why hashCode must match',
      body: `\`Object.equals\` has a formal contract (from the Javadoc):

1. **Reflexive**: \`x.equals(x)\` is always true.
2. **Symmetric**: if \`x.equals(y)\` then \`y.equals(x)\`.
3. **Transitive**: if \`x.equals(y)\` and \`y.equals(z)\` then \`x.equals(z)\`.
4. **Consistent**: repeated calls return the same result if the object doesn't change.
5. **Null-safe**: \`x.equals(null)\` is always false.

The canonical pattern (covers all five):

~~~java
@Override
public boolean equals(Object o) {
    if (o == this) return true;              // reflexive + fast path
    if (!(o instanceof MyClass)) return false; // null-safe + type check
    MyClass other = (MyClass) o;
    return this.field1 == other.field1
        && Objects.equals(this.field2, other.field2);
}
~~~

**hashCode is not optional.** The contract: *if \`a.equals(b)\` then
\`a.hashCode() == b.hashCode()\`*. The converse is not required — collisions are OK,
just slow. Violating the contract does not throw; it silently corrupts \`HashMap\` /
\`HashSet\` behaviour:

~~~java
// Class with equals but WITHOUT a matching hashCode:
Set<Point> set = new HashSet<>();
set.add(new Point(1, 2));
System.out.println(set.contains(new Point(1, 2)));  // false!
// Two equal Points hash to different buckets, so contains() never finds it.
~~~

Always override both or neither. Use \`Objects.hash(f1, f2, ...)\` unless you have
a domain-specific reason to hand-roll it:

~~~java
@Override
public int hashCode() {
    return Objects.hash(field1, field2);
}
~~~`,
    },
    {
      id: 'comparable',
      heading: 'Comparable<T> and natural ordering',
      body: `\`Comparable<T>\` gives a class a **natural order** — the default used by
\`Arrays.sort\`, \`Collections.sort\`, \`TreeSet\`, and \`TreeMap\`:

~~~java
public class Money implements Comparable<Money> {
    private final long cents;  // store in smallest unit — no floating point

    @Override
    public int compareTo(Money other) {
        return Long.compare(this.cents, other.cents);
    }
}
~~~

The contract for \`compareTo\`:
- Returns a **negative int** if \`this < other\`.
- Returns **0** if \`this == other\` (should be consistent with \`equals\`).
- Returns a **positive int** if \`this > other\`.

**Classic bug:** writing \`return this.value - other.value\` for integers. It works
most of the time but overflows when the values are far apart. Always use
\`Integer.compare(a, b)\` or \`Long.compare(a, b)\`.

Consistency with equals is recommended but not enforced by the compiler. Violating
it makes \`TreeSet\` behave differently from \`HashSet\` for the same elements —
a subtle bug that surfaces in production, not in unit tests.`,
    },
    {
      id: 'value-types',
      heading: 'Designing value types: Rational as a worked example',
      body: `A **value type** is an immutable object identified entirely by its data.
\`String\`, \`BigDecimal\`, \`LocalDate\` are all value types. Design checklist:

1. All fields \`private final\`.
2. No setters. Methods that "change" the value return a new instance.
3. Override \`equals\` and \`hashCode\` by field content.
4. Consider implementing \`Comparable\` for ordered collections.
5. Override \`toString\` for readable output and debugging.

A \`Rational\` (exact fraction) illustrates all five and adds a nuance: two
fractions are equal if they reduce to the same value, so the canonical form must
be enforced at construction time:

~~~java
public final class Rational {
    private final int num;   // numerator   (sign lives here)
    private final int den;   // denominator (always positive)

    public Rational(int num, int den) {
        if (den == 0) throw new ArithmeticException("denominator zero");
        int sign = den < 0 ? -1 : 1;   // normalise sign to numerator
        int g = gcd(Math.abs(num), Math.abs(den));
        this.num = sign * num / g;
        this.den = Math.abs(den) / g;
    }

    private static int gcd(int a, int b) {
        return b == 0 ? a : gcd(b, a % b);
    }

    public Rational add(Rational o) {
        return new Rational(num * o.den + o.num * den, den * o.den);
    }

    @Override public boolean equals(Object o) {
        if (o == this) return true;
        if (!(o instanceof Rational)) return false;
        Rational r = (Rational) o;
        return num == r.num && den == r.den;   // canonical form => simple compare
    }

    @Override public int hashCode() { return Objects.hash(num, den); }

    @Override public String toString() { return den == 1 ? num + "" : num + "/" + den; }
}
~~~

After reduction to canonical form, two \`Rational\`s are equal iff their numerators
and denominators are literally equal — making \`equals\` trivially correct.`,
    },
    {
      id: 'immutability',
      heading: 'Real immutability — the defensive copy trap',
      body: `Declaring all fields \`final\` is necessary but **not sufficient** for
immutability if any field holds a mutable object. The constructor must copy the
incoming reference; the getter must return a copy too. Missing either one breaks
the guarantee:

~~~java
// BROKEN — "immutable" class that leaks its internal state:
public final class DateRange {
    private final java.util.Date start;   // Date is mutable!

    public DateRange(java.util.Date start) {
        this.start = start;               // BUG: stores the caller's reference
    }

    public java.util.Date getStart() {
        return start;                     // BUG: exposes the internal reference
    }
}

// The caller can mutate the object through either hole:
java.util.Date d = new java.util.Date();
DateRange range = new DateRange(d);
d.setTime(0L);                           // breaks range through the constructor leak
range.getStart().setTime(0L);            // breaks range through the getter leak
~~~

Fix with defensive copies **in both constructor and getter**:

~~~java
public DateRange(java.util.Date start) {
    this.start = new java.util.Date(start.getTime());  // copy IN
}

public java.util.Date getStart() {
    return new java.util.Date(start.getTime());         // copy OUT
}
~~~

Modern Java avoids \`java.util.Date\` entirely in favour of the immutable
\`java.time\` API (\`LocalDate\`, \`Instant\`, etc.) — then there's nothing to copy.
But arrays and \`ArrayList\` still require the same treatment.`,
    },
    {
      id: 'object-methods',
      heading: 'The Object methods you always override together',
      body: `Every class implicitly extends \`java.lang.Object\`, which provides several
methods. Three are worth overriding routinely:

| Method | Default behaviour | Why override |
|--------|------------------|--------------|
| \`toString()\` | \`ClassName@hexhash\` | Readable output for logging/debug |
| \`equals(Object)\` | Reference identity (\`==\`) | Value equality for collections |
| \`hashCode()\` | Object identity hash | Must match equals; needed for HashMap/HashSet |

Two more you might override once you cover inheritance:

- \`clone()\` — avoid it; prefer copy constructors or factory methods.
- \`finalize()\` — deprecated; don't use it.

**IDE short-cut:** IntelliJ and VS Code can generate \`equals\`/\`hashCode\`/\`toString\`
from the field list. Always review the generated output — generators sometimes
make surprising choices (e.g. comparing arrays by identity instead of content).

**Records (JDK 16+):** for pure value holders, a \`record\` generates all three
automatically:

~~~java
record Point(int x, int y) {}   // equals, hashCode, toString for free

Point p = new Point(1, 2);
System.out.println(p);                       // Point[x=1, y=2]
System.out.println(p.equals(new Point(1, 2))); // true
~~~

Records are implicitly \`final\`, all fields are \`private final\`, and there are no
setters. If you're on JDK 16+ and your class is just data, reach for \`record\` first.`,
    },
    {
      id: 'collections-contract',
      heading: 'Collections and the equals/hashCode contract in practice',
      body: `\`HashSet\` and \`HashMap\` rely entirely on \`hashCode\` to choose the bucket and
\`equals\` to resolve collisions. Breaking either contract corrupts the structure
silently:

~~~java
// If hashCode always returns 0 (valid but terrible):
// — equals is correct, so contains() eventually finds the element,
//   but after scanning every element in one giant bucket (O(n) per op).

// If equals says two objects are equal but hashCode differs:
// — contains() looks in the WRONG bucket and returns false even
//   though the element is present. Objects appear to vanish.
~~~

\`TreeSet\` and \`TreeMap\` ignore \`hashCode\` entirely and use \`compareTo\` (or a
\`Comparator\`). They require **consistency between equals and compareTo**: if
\`a.compareTo(b) == 0\` then \`a.equals(b)\` should be true, otherwise the same
element can appear twice in a \`TreeSet\`.

Practical checklist before putting a class in a collection:
1. \`equals\` overridden? ✓
2. \`hashCode\` overridden to match? ✓
3. If using \`TreeSet\`/\`TreeMap\`: \`Comparable\` implemented (or \`Comparator\` provided)? ✓
4. Are the fields used in \`equals\`/\`hashCode\` immutable, or do you never mutate them
   while the object is in the collection? ✓ (mutating a key mid-flight breaks everything)`,
    },
  ],
  exercises: [
    {
      id: 'predict-references',
      title: 'Predict the output: references, == vs equals, aliasing',
      difficulty: 'warmup',
      prompt: `Before running it, **predict the exact output of every labelled line** and write
a one-sentence reason for each. Then run it and reconcile surprises.

Every line is a classic object-model trap. Getting all of them right means your
mental model of Java references and equality is solid.

~~~java
import java.util.Objects;

public class Predict {
    static int[] copy(int[] src) { return src; }   // intentionally wrong

    public static void main(String[] args) {
        // --- A: aliasing ---
        int[] a = {10, 20, 30};
        int[] b = copy(a);
        b[0] = 99;
        System.out.println(a[0]);                          // A

        // --- B/C: String identity vs equality ---
        String s1 = new String("hello");
        String s2 = new String("hello");
        System.out.println(s1 == s2);                      // B
        System.out.println(s1.equals(s2));                 // C

        // --- D/E: Integer cache boundary ---
        Integer x = 127, y = 127;
        System.out.println(x == y);                        // D
        Integer p = 128, q = 128;
        System.out.println(p == q);                        // E

        // --- F: null-safe equals via Objects.equals ---
        String n = null;
        System.out.println(Objects.equals(n, "hello"));   // F
        // System.out.println(n.equals("hello"));          // would throw NPE

        // --- G: reassigning a reference parameter ---
        int[] arr = {1, 2, 3};
        zap(arr);
        System.out.println(arr[0]);                        // G
    }

    static void zap(int[] a) {
        a = new int[]{99, 99, 99};   // reassigns local copy only
    }
}
~~~`,
      starter: `// Write your prediction for A–G as comments, then run to check.
// A:
// B:
// C:
// D:
// E:
// F:
// G:`,
      hints: [
        'A: the \`copy\` method returns the same reference, not a new array. Mutating \`b[0]\` mutates \`a[0]\`.',
        'D vs E: the JVM caches Integer objects for values -128 to 127, so \`==\` is accidentally true there. Outside the range, two distinct heap objects are created.',
        'G: \`zap\` reassigns the local parameter \`a\` to point at a new array. The caller\'s \`arr\` variable is unaffected — Java is pass-by-value, and the value is the reference.',
      ],
      solution: `// A: 99       — copy() returns the same reference; b is an alias of a; b[0]=99 mutates a
// B: false     — new String(...) explicitly allocates a new heap object; == tests identity
// C: true      — equals() compares the char sequence, not the identity
// D: true      — 127 is within the Integer cache range (-128..127); same cached object
// E: false     — 128 is outside the cache; p and q are distinct boxed objects
// F: false     — Objects.equals(null, "hello") returns false without NPE; first arg is null
// G: 1         — zap() only reassigns its local parameter; arr in main still points to {1,2,3}`,
      explanation: `**A** demonstrates why "copy by assignment" is a bug: the function hands back the same
pointer. Every pass-by-reference pitfall in Java traces to this. **B/C** show the
canonical \`==\` vs \`equals\` difference on \`String\` — never use \`==\` on object content.
**D/E** show the Integer cache: the JVM interns boxed integers from -128 to 127 as a
performance optimisation; \`==\` is accidentally true inside that range and false
outside, which is why you must always use \`.equals()\` on boxed types. **F** shows
\`Objects.equals\`, the null-safe wrapper you should reach for whenever either side could
be null. **G** nails pass-by-value: the method gets a copy of the reference; pointing
that copy at a new array has no effect on the caller's variable.`,
    },
    {
      id: 'hashcode-break',
      title: 'Break and fix a HashSet with a bad hashCode',
      difficulty: 'core',
      prompt: `You are given a \`Tag\` class that correctly overrides \`equals\` but has a **broken
\`hashCode\`** (it always returns 0). Your tasks:

**Part 1 — Demonstrate the bug.** In \`main\`, add several \`Tag\` objects to a
\`HashSet\<Tag\>\`, then call \`contains\` with a logically equal \`Tag\`. Show that
\`contains\` returns \`false\` even though \`equals\` would say \`true\`. (If you get
\`true\` here, the buggy code is not yet broken in your case — read the theory section again.)

Wait — with \`hashCode\` always returning 0, \`HashSet.contains\` will actually
return \`true\` (all objects land in the same bucket and equals is checked linearly).
So the visible symptom of a constant hashCode is **not** a missing element — it is
O(n) lookups that appear correct but kill performance. The really broken case
is \`hashCode\` that is **inconsistent with equals**: two objects that are \`.equals\`
but return different hash codes. Demonstrate THAT:
add an element, then use a separate object with the same logical value but
ensure the hash codes differ, and show \`contains\` fails.

**Part 2 — Fix it.** Override \`hashCode\` using \`Objects.hash\` over the same
fields used in \`equals\`. Rerun and confirm \`contains\` returns \`true\`.

**Part 3 — Mutable key trap.** Add a \`Tag\` to a \`HashSet\`, mutate one of its
fields (you will need to add a setter temporarily), then call \`contains\` with
the same object. Explain the result.

The starter code gives you the broken class. You need to demonstrate all three parts.`,
      starter: `import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public class TagDemo {

    // Deliberately broken: equals by name+category, but hashCode ignores category.
    // This means two Tags can be equals() but return different hashCodes.
    static class Tag {
        private String name;
        private String category;

        Tag(String name, String category) {
            this.name     = name;
            this.category = category;
        }

        // Setter to demonstrate the mutable-key trap (Part 3)
        void setCategory(String category) { this.category = category; }

        @Override
        public boolean equals(Object o) {
            if (o == this) return true;
            if (!(o instanceof Tag)) return false;
            Tag t = (Tag) o;
            return Objects.equals(name, t.name)
                && Objects.equals(category, t.category);
        }

        // BUG: only hashes name, ignores category
        @Override
        public int hashCode() {
            return Objects.hash(name);   // TODO Part 2: fix to include category
        }

        @Override
        public String toString() { return name + ":" + category; }
    }

    public static void main(String[] args) {
        // Part 1 — demonstrate the broken contract
        // Two Tags that are equals() but hash differently:
        // tag1 = Tag("java", "language"),  tag2 = Tag("java", "language")
        // With current hashCode both produce the same hash (only name is hashed),
        // so actually they DO match. To show the REAL bug, manufacture two Tags
        // where equals() would say true but hashCodes differ — uncomment and adapt
        // the TODO block below after reading the prompt carefully.

        // TODO: demonstrate inconsistency between equals and hashCode using the
        //       BROKEN Tag implementation above, then fix hashCode and rerun.

        // Part 2 — fix hashCode in the Tag class above, rerun, confirm contains is true.

        // Part 3 — mutable key trap
        Set<Tag> set = new HashSet<>();
        Tag t = new Tag("java", "language");
        set.add(t);
        System.out.println("Before mutation: " + set.contains(t)); // true
        t.setCategory("framework");   // mutate the key while in the set!
        System.out.println("After mutation:  " + set.contains(t)); // ???
    }
}`,
      hints: [
        'To manufacture a broken-contract scenario manually: subclass Tag (or create a second variant) where equals() says two objects are equal but one overrides hashCode to return a different value. That forces the inconsistency.',
        'The simpler illustration is the mutable-key trap in Part 3: after mutation the object still lives in the bucket indexed by the OLD hash, so \`contains\` looks in the NEW bucket and finds nothing — even when called with the same object reference.',
        'Fix for Part 2: change \`Objects.hash(name)\` to \`Objects.hash(name, category)\` in hashCode(). Both fields must match those used in equals.',
      ],
      solution: `import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public class TagDemo {

    static class Tag {
        private String name;
        private String category;

        Tag(String name, String category) {
            this.name     = name;
            this.category = category;
        }

        void setCategory(String category) { this.category = category; }

        @Override
        public boolean equals(Object o) {
            if (o == this) return true;
            if (!(o instanceof Tag)) return false;
            Tag t = (Tag) o;
            return Objects.equals(name, t.name)
                && Objects.equals(category, t.category);
        }

        // FIXED: hash both fields that equals() uses
        @Override
        public int hashCode() {
            return Objects.hash(name, category);
        }

        @Override
        public String toString() { return name + ":" + category; }
    }

    // A broken subclass to demonstrate the inconsistency symptom in isolation.
    // Inherits the fixed equals but deliberately returns a wrong hash.
    static class BrokenTag extends Tag {
        BrokenTag(String name, String category) { super(name, category); }

        @Override
        public int hashCode() { return 0; }   // inconsistent with parent equals
    }

    public static void main(String[] args) {
        // --- Part 1: inconsistent contract across two class variants ---
        Set<Tag> set1 = new HashSet<>();
        Tag good = new Tag("java", "language");
        set1.add(good);

        // BrokenTag inherits equals() from Tag, so good.equals(bad) == true,
        // but their hashCodes differ => contains fails.
        BrokenTag bad = new BrokenTag("java", "language");
        System.out.println("good.equals(bad) : " + good.equals(bad));   // true
        System.out.println("good.hashCode()  : " + good.hashCode());     // some hash
        System.out.println("bad.hashCode()   : " + bad.hashCode());      // 0
        System.out.println("set1.contains(bad): " + set1.contains(bad)); // false! wrong bucket

        // --- Part 2: FIXED Tag in its own set ---
        Set<Tag> set2 = new HashSet<>();
        set2.add(new Tag("java", "language"));
        System.out.println("\\nset2.contains(new Tag(java,language)): "
            + set2.contains(new Tag("java", "language")));   // true

        // --- Part 3: mutable key trap ---
        Set<Tag> set3 = new HashSet<>();
        Tag t = new Tag("java", "language");
        set3.add(t);
        System.out.println("\\nBefore mutation: set3.contains(t) = " + set3.contains(t)); // true
        t.setCategory("framework");   // mutate the field used by hashCode!
        System.out.println("After mutation:  set3.contains(t) = " + set3.contains(t));   // false
        // t is now hashed to the "java:framework" bucket; it still lives
        // in the old "java:language" bucket. The set is now corrupted.
        System.out.println("Set contents: " + set3);   // still shows t — it's stuck there
    }
}`,
      explanation: `**Part 1** creates a class where \`equals\` says two objects are equal but
\`hashCode\` returns different values. \`HashSet.contains\` computes the hash first
and looks only in that bucket — it never even calls \`equals\`. The "equal" object
lives in a different bucket and is invisible. This is the canonical symptom of
a broken \`equals\`/\`hashCode\` contract.

**Part 2** confirms the fix: once both fields appear in \`hashCode\`, two logically
equal \`Tag\` objects land in the same bucket and \`equals\` resolves the collision
correctly.

**Part 3** is the mutable-key trap. When \`t\` is added, its hash is computed and
it is placed in the corresponding bucket. After \`setCategory\`, the object's hash
changes — but \`HashSet\` doesn't know that. The object is now stranded in the old
bucket; looking it up with the new hash finds nothing. The set is permanently
corrupted: the element can never be found or removed. The lesson: **never mutate
an object while it is a key in a \`HashMap\` or element in a \`HashSet\`**.`,
    },
    {
      id: 'rational',
      title: 'Rational: a complete value type',
      difficulty: 'core',
      prompt: `Implement an immutable \`Rational\` class representing an exact fraction p/q.

**Requirements:**
- \`Rational(int num, int den)\`: throws \`ArithmeticException\` for denominator 0.
  Reduces to lowest terms via GCD. Normalises sign so the denominator is always
  positive (i.e. \`Rational(-1, -3)\` stores as 1/3; \`Rational(1, -3)\` stores as -1/3).
- \`Rational add(Rational o)\`, \`subtract(Rational o)\`, \`multiply(Rational o)\`,
  \`divide(Rational o)\` — all return new \`Rational\` objects, no mutation.
- \`int compareTo(Rational o)\` — compare a/b vs c/d as \`a*d - b*c\` (cross-multiply
  to avoid floating point). Use \`Integer.compare\` on the cross-products to avoid
  overflow.
- \`equals(Object)\` and \`hashCode()\` — consistent with \`compareTo\`.
- \`toString()\` — returns \`"p/q"\` or just \`"p"\` when denominator is 1.

**Verify in \`main\`:**
1. \`Rational(2,4).equals(Rational(1,2))\` → true (both reduce to 1/2).
2. \`Rational(1,3).add(Rational(1,6))\` → 1/2.
3. Add several rationals to a \`TreeSet\` and print them in order.
4. Confirm \`Rational(2,4)\` and \`Rational(1,2)\` are treated as the same element
   in the set (size stays 1 after adding both).`,
      starter: `import java.util.Objects;
import java.util.TreeSet;

public final class Rational implements Comparable<Rational> {
    private final int num;   // numerator (holds the sign)
    private final int den;   // denominator (always positive after normalisation)

    public Rational(int num, int den) {
        if (den == 0) throw new ArithmeticException("denominator is zero");
        // TODO: normalise sign (den must end up positive) and reduce by GCD
        this.num = 0; // placeholder
        this.den = 1; // placeholder
    }

    private static int gcd(int a, int b) {
        // TODO: Euclid's algorithm (a, b non-negative)
        return 1;
    }

    // --- arithmetic (return new Rational, do NOT mutate this) ---

    public Rational add(Rational o) {
        // a/b + c/d = (a*d + c*b) / (b*d)
        return null; // TODO
    }

    public Rational subtract(Rational o) {
        return null; // TODO
    }

    public Rational multiply(Rational o) {
        return null; // TODO
    }

    public Rational divide(Rational o) {
        return null; // TODO
    }

    // --- value-type methods ---

    @Override
    public int compareTo(Rational o) {
        // cross-multiply: (this.num * o.den) vs (o.num * this.den)
        // use long to avoid overflow before comparing
        return Long.compare((long) this.num * o.den, (long) o.num * this.den);
    }

    @Override
    public boolean equals(Object obj) {
        // TODO: standard pattern; after normalisation, equality is just num==num && den==den
        return false;
    }

    @Override
    public int hashCode() {
        return Objects.hash(num, den);
    }

    @Override
    public String toString() {
        return den == 1 ? String.valueOf(num) : num + "/" + den;
    }

    public static void main(String[] args) {
        // 1. Equality after reduction
        Rational half1 = new Rational(2, 4);
        Rational half2 = new Rational(1, 2);
        System.out.println("2/4 equals 1/2: " + half1.equals(half2));   // true

        // 2. Arithmetic
        Rational third = new Rational(1, 3);
        Rational sixth = new Rational(1, 6);
        System.out.println("1/3 + 1/6 = " + third.add(sixth));           // 1/2

        // 3. TreeSet ordering
        TreeSet<Rational> set = new TreeSet<>();
        set.add(new Rational(3, 4));
        set.add(new Rational(1, 2));
        set.add(new Rational(1, 4));
        set.add(new Rational(2, 4));  // duplicate of 1/2 — should not increase size
        System.out.println("Set size (expect 3): " + set.size());
        System.out.println("Sorted: " + set);   // [1/4, 1/2, 3/4]
    }
}`,
      hints: [
        'GCD via Euclid: \`private static int gcd(int a, int b) { return b == 0 ? a : gcd(b, a % b); }\`. Call it with \`Math.abs\` values to avoid sign issues.',
        'Sign normalisation: compute \`int sign = (den < 0) ? -1 : 1\`, then \`int g = gcd(Math.abs(num), Math.abs(den)); this.num = sign * num / g; this.den = Math.abs(den) / g;\`.',
        'For \`compareTo\`, cross-multiply using \`long\` to prevent overflow: \`Long.compare((long) this.num * o.den, (long) o.num * this.den)\`. Since both denominators are positive the sign is preserved.',
      ],
      solution: `import java.util.Objects;
import java.util.TreeSet;

public final class Rational implements Comparable<Rational> {
    private final int num;
    private final int den;

    public Rational(int num, int den) {
        if (den == 0) throw new ArithmeticException("denominator is zero");
        int sign = den < 0 ? -1 : 1;
        int g    = gcd(Math.abs(num), Math.abs(den));
        this.num = sign * num / g;
        this.den = Math.abs(den) / g;
    }

    private static int gcd(int a, int b) {
        return b == 0 ? a : gcd(b, a % b);
    }

    public Rational add(Rational o) {
        return new Rational(num * o.den + o.num * den, den * o.den);
    }

    public Rational subtract(Rational o) {
        return new Rational(num * o.den - o.num * den, den * o.den);
    }

    public Rational multiply(Rational o) {
        return new Rational(num * o.num, den * o.den);
    }

    public Rational divide(Rational o) {
        return new Rational(num * o.den, den * o.num);
    }

    @Override
    public int compareTo(Rational o) {
        return Long.compare((long) num * o.den, (long) o.num * den);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == this) return true;
        if (!(obj instanceof Rational)) return false;
        Rational r = (Rational) obj;
        return num == r.num && den == r.den;
    }

    @Override
    public int hashCode() {
        return Objects.hash(num, den);
    }

    @Override
    public String toString() {
        return den == 1 ? String.valueOf(num) : num + "/" + den;
    }

    public static void main(String[] args) {
        Rational half1 = new Rational(2, 4);
        Rational half2 = new Rational(1, 2);
        System.out.println("2/4 equals 1/2: " + half1.equals(half2));     // true

        Rational third = new Rational(1, 3);
        Rational sixth = new Rational(1, 6);
        System.out.println("1/3 + 1/6 = " + third.add(sixth));             // 1/2

        TreeSet<Rational> set = new TreeSet<>();
        set.add(new Rational(3, 4));
        set.add(new Rational(1, 2));
        set.add(new Rational(1, 4));
        set.add(new Rational(2, 4));   // same as 1/2 after reduction
        System.out.println("Set size (expect 3): " + set.size());           // 3
        System.out.println("Sorted: " + set);                               // [1/4, 1/2, 3/4]

        // Edge cases
        System.out.println(new Rational(-1, -3));   // 1/3
        System.out.println(new Rational(6, 1));     // 6
    }
}`,
      explanation: `The key insight is **canonical form**: by reducing to lowest terms and normalising
the sign into the numerator at construction time, two logically equal fractions
(2/4 and 1/2) are always represented identically in memory. That makes \`equals\` a
trivial field comparison and \`hashCode\` via \`Objects.hash(num, den)\` correct by
construction — no special fraction logic needed in either method.

The \`compareTo\` cross-multiplies to avoid floating point: instead of comparing
\`a/b\` and \`c/d\` as doubles, it compares \`a*d\` vs \`b*c\`. Both denominators are
guaranteed positive (by construction), so the sign of the cross-product is the
correct ordering. Using \`long\` prevents overflow for large int numerators.

\`TreeSet\` uses \`compareTo\`, not \`equals\`/\`hashCode\`. Because \`compareTo\` returns 0
for 2/4 and 1/2, the set treats them as the same element — size stays at 3 after
inserting the duplicate. This is the "consistent with equals" requirement in
practice: if \`compareTo\` and \`equals\` disagree, \`TreeSet\` and \`HashSet\` would
give different answers to "does this set contain X?", which is a maintenance trap.`,
    },
    {
      id: 'immutable-schedule',
      title: 'Immutable Schedule — defensive copying',
      difficulty: 'challenge',
      prompt: `Implement an **immutable** \`Schedule\` class that holds a list of meeting times.
The challenge is making it truly immutable when the backing data is a mutable array.

**Specification:**
- Constructor: \`Schedule(String owner, int[] meetingMinutes)\` — stores the owner
  name and the list of meeting durations (in minutes). **Copy the array defensively.**
- \`int[] getMeetings()\` — returns a **copy** of the internal array, not the original.
- \`Schedule withMeeting(int minutes)\` — returns a **new** \`Schedule\` with the
  additional meeting appended. Does not mutate \`this\`.
- \`int totalMinutes()\` — sum of all meeting durations.
- \`Schedule merge(Schedule other)\` — returns a new \`Schedule\` for the same owner
  containing all meetings from both, sorted ascending.
- \`equals\` and \`hashCode\` by owner + meetings content (use \`Arrays.equals\` and
  \`Arrays.hashCode\`).
- \`toString()\` — e.g. \`"Schedule{owner=Alice, meetings=[30, 45, 60], total=135min}"\`.

**In \`main\`, demonstrate:**
1. That mutating the original array after construction does NOT affect the schedule.
2. That mutating the array returned by \`getMeetings()\` does NOT affect the schedule.
3. That \`withMeeting\` returns a new object and the original is unchanged.
4. That two schedules with the same owner and same meetings are \`.equals\`.`,
      starter: `import java.util.Arrays;
import java.util.Objects;

public final class Schedule {
    private final String owner;
    private final int[]  meetings;   // always a private defensive copy

    public Schedule(String owner, int[] meetingMinutes) {
        this.owner = Objects.requireNonNull(owner, "owner must not be null");
        // TODO: defensive copy — do NOT store the caller's reference
        this.meetings = null; // placeholder
    }

    public int[] getMeetings() {
        // TODO: return a copy, not the internal array
        return null;
    }

    public Schedule withMeeting(int minutes) {
        // TODO: build a new int[] with meetings + minutes appended; return new Schedule
        return null;
    }

    public int totalMinutes() {
        int sum = 0;
        for (int m : meetings) sum += m;
        return sum;
    }

    public Schedule merge(Schedule other) {
        // TODO: combine arrays, sort, return new Schedule with same owner
        return null;
    }

    @Override
    public boolean equals(Object o) {
        // TODO: compare owner (String) and meetings (array content)
        return false;
    }

    @Override
    public int hashCode() {
        // TODO: Objects.hash(owner, Arrays.hashCode(meetings))
        return 0;
    }

    @Override
    public String toString() {
        return "Schedule{owner=" + owner
            + ", meetings=" + Arrays.toString(meetings)
            + ", total=" + totalMinutes() + "min}";
    }

    public static void main(String[] args) {
        int[] raw = {30, 45, 60};
        Schedule s1 = new Schedule("Alice", raw);

        // 1. Mutate the original array — must NOT affect s1
        raw[0] = 999;
        System.out.println("After mutating raw[0]: " + s1);   // should still show 30

        // 2. Mutate the returned array — must NOT affect s1
        int[] out = s1.getMeetings();
        out[1] = 999;
        System.out.println("After mutating getMeetings()[1]: " + s1); // still 45

        // 3. withMeeting creates new object, original unchanged
        Schedule s2 = s1.withMeeting(90);
        System.out.println("s1 after withMeeting: " + s1);  // unchanged
        System.out.println("s2: " + s2);                     // has 90 appended

        // 4. equals by content
        Schedule s3 = new Schedule("Alice", new int[]{30, 45, 60});
        System.out.println("s1.equals(s3): " + s1.equals(s3));  // true
        System.out.println("s1.equals(s2): " + s1.equals(s2));  // false
    }
}`,
      hints: [
        'Defensive copy in constructor: \`this.meetings = Arrays.copyOf(meetingMinutes, meetingMinutes.length);\` — never store the reference the caller passed in.',
        'For \`withMeeting\`: \`int[] next = Arrays.copyOf(meetings, meetings.length + 1); next[meetings.length] = minutes; return new Schedule(owner, next);\`',
        'For \`merge\`: \`int[] combined = new int[meetings.length + other.meetings.length]; System.arraycopy(meetings, 0, combined, 0, meetings.length); System.arraycopy(other.meetings, 0, combined, meetings.length, other.meetings.length); Arrays.sort(combined); return new Schedule(owner, combined);\`',
      ],
      solution: `import java.util.Arrays;
import java.util.Objects;

public final class Schedule {
    private final String owner;
    private final int[]  meetings;

    public Schedule(String owner, int[] meetingMinutes) {
        this.owner    = Objects.requireNonNull(owner, "owner must not be null");
        this.meetings = Arrays.copyOf(meetingMinutes, meetingMinutes.length);
    }

    public int[] getMeetings() {
        return Arrays.copyOf(meetings, meetings.length);
    }

    public Schedule withMeeting(int minutes) {
        int[] next = Arrays.copyOf(meetings, meetings.length + 1);
        next[meetings.length] = minutes;
        return new Schedule(owner, next);
    }

    public int totalMinutes() {
        int sum = 0;
        for (int m : meetings) sum += m;
        return sum;
    }

    public Schedule merge(Schedule other) {
        int[] combined = new int[meetings.length + other.meetings.length];
        System.arraycopy(meetings,       0, combined, 0,               meetings.length);
        System.arraycopy(other.meetings, 0, combined, meetings.length, other.meetings.length);
        Arrays.sort(combined);
        return new Schedule(owner, combined);
    }

    @Override
    public boolean equals(Object o) {
        if (o == this) return true;
        if (!(o instanceof Schedule)) return false;
        Schedule s = (Schedule) o;
        return Objects.equals(owner, s.owner)
            && Arrays.equals(meetings, s.meetings);
    }

    @Override
    public int hashCode() {
        return Objects.hash(owner, Arrays.hashCode(meetings));
    }

    @Override
    public String toString() {
        return "Schedule{owner=" + owner
            + ", meetings=" + Arrays.toString(meetings)
            + ", total=" + totalMinutes() + "min}";
    }

    public static void main(String[] args) {
        int[] raw = {30, 45, 60};
        Schedule s1 = new Schedule("Alice", raw);

        raw[0] = 999;
        System.out.println("After mutating raw[0]:             " + s1);  // meetings=[30, 45, 60]

        int[] out = s1.getMeetings();
        out[1] = 999;
        System.out.println("After mutating getMeetings()[1]:   " + s1);  // still 45

        Schedule s2 = s1.withMeeting(90);
        System.out.println("s1 after withMeeting:              " + s1);  // unchanged
        System.out.println("s2:                                " + s2);  // [30, 45, 60, 90]

        Schedule s3 = new Schedule("Alice", new int[]{30, 45, 60});
        System.out.println("s1.equals(s3): " + s1.equals(s3));   // true
        System.out.println("s1.equals(s2): " + s1.equals(s2));   // false

        // Merge demo
        Schedule s4 = new Schedule("Alice", new int[]{20, 50});
        System.out.println("merge:         " + s1.merge(s4));    // sorted: [20, 30, 45, 50, 60]
    }
}`,
      explanation: `**The two leak points.** An array field creates two potential holes: one in the
constructor (if you store the caller's reference, the caller can later mutate your
internals) and one in the getter (if you return your internal reference, the caller
can mutate it). \`Arrays.copyOf\` in both places seals both holes. The class is now
*genuinely* immutable: there is no public method or path that can change the stored
array after construction.

**\`withMeeting\` and \`merge\` as immutable updates.** Both methods allocate a new array,
build the new data, and return a fresh \`Schedule\`. \`this\` is never touched. This is
the immutable-update pattern — the same one used by \`String\`, \`LocalDate\`, and
\`BigDecimal\` in the JDK. Callers compose changes by chaining the returned values;
existing references are unaffected.

**\`equals\` with an array field.** \`==\` or \`Object.equals\` on an array compares
identity, not content. You must use \`Arrays.equals(a, b)\` for the equality check
and \`Arrays.hashCode(a)\` (inside \`Objects.hash\`) for the hash. Missing this is
a very common bug when IDE-generators are used without review — generators often
emit \`Arrays.equals\` correctly but are worth double-checking.

**\`Objects.requireNonNull\`** converts a null owner into a clear \`NullPointerException\`
with a readable message at construction time, instead of a cryptic NPE later when
\`owner\` is used. Always fail fast on invalid arguments.`,
    },
  ],
  takeaways: [
    '**\`==\` tests identity (same heap object); \`.equals()\` tests value.** Always use \`.equals()\` on object content — \`==\` on boxed integers gives surprising results outside the -128..127 cache range.',
    'Overriding \`equals\` without overriding \`hashCode\` silently corrupts \`HashSet\` / \`HashMap\`: equal objects may hash to different buckets and become invisible to \`contains\`.',
    'The standard \`equals\` pattern: same-reference shortcut → \`instanceof\` null-safe type check → field-by-field comparison. Never skip a step.',
    'A value type needs all five: \`private final\` fields, no setters, \`equals\`, \`hashCode\`, and \`Comparable\` (or a \`Comparator\`). Reducing to canonical form at construction simplifies every other method.',
    '**Defensive copying is required for true immutability**: copy mutable inputs in the constructor AND return copies from getters. \`final\` on a field that points to a mutable array is not enough.',
    'Never mutate an object while it is a key in a \`HashMap\` or element in a \`HashSet\` — the object will be stranded in the wrong bucket and the collection is permanently corrupted.',
    'Use \`Arrays.equals\` / \`Arrays.hashCode\` for array fields in \`equals\`/\`hashCode\`. Plain \`==\` and \`Object.equals\` on arrays compare identity, not content.',
  ],
}
