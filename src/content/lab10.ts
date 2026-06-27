import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab10: Lab = {
  id: 'lab-10',
  number: 10,
  title: 'Generics & Parameterized Types',
  subtitle: 'Recursive bounds, wildcards, PECS, type erasure and the typesafe heterogeneous container',
  estimatedHours: 6,
  concepts: [
    'generics',
    'recursive bound',
    'wildcard',
    'PECS',
    'type erasure',
    'Class<T> token',
    'typesafe heterogeneous container',
    'heap pollution',
  ],
  overview: `You already know how to write a \`Box<T>\` with a getter and setter. This lab starts
where that leaves off.

The interesting problems in generic API design arise from three tensions:

- **Flexibility vs. safety** — wildcards let you accept more callers, but they restrict what
  you can do inside the method. Choosing \`? extends\` vs. \`? super\` incorrectly produces
  compile errors that feel mysterious until you understand PECS.
- **Compile-time types vs. runtime reality** — type erasure strips all type parameters from
  bytecode. That single fact is responsible for a surprising number of "why won't this
  compile?" moments, and for the design of the typesafe heterogeneous container.
- **Bounds at the right level** — the difference between \`<T extends Comparable<T>>\` and
  \`<T extends Comparable<? super T>>\` is invisible for 90 % of types but silently wrong
  for the other 10 %. Interviewers love that gap.

The exercises force you to confront each of these tensions directly — there is no way
through them without genuinely understanding the underlying model.`,
  theory: [
    {
      id: 'invariance',
      heading: 'Invariance: why List<Integer> is not a List<Number>',
      body: `Arrays in Java are **covariant**: \`String[]\` is a subtype of \`Object[]\`. That is
convenient but unsafe — the JVM has to check every array write at runtime and throw
\`ArrayStoreException\` when you violate the contract. Generics fixed this at the cost
of **invariance**: \`List<String>\` is *not* a subtype of \`List<Object>\`, full stop.

~~~java
// This compiles — covariant arrays:
Object[] objs = new String[3];
objs[0] = 42;   // ArrayStoreException at runtime — the array is really String[]

// This does NOT compile — invariant generics (good!):
List<Object> list = new ArrayList<String>();   // compile error
~~~

Invariance is the right default because if \`List<String>\` were a \`List<Object>\`, you
could call \`list.add(42)\` through the \`List<Object>\` reference and corrupt the
underlying \`List<String>\`. The compiler refuses the assignment so the problem is caught
before it can exist.

The practical consequence: you cannot write a method that accepts \`List<Number>\` and
pass it a \`List<Integer>\`. You need wildcards for that.`,
    },
    {
      id: 'recursive-bound',
      heading: 'Recursive bounds: <T extends Comparable<? super T>>',
      body: `The idiomatic bound for "T must be comparable" looks like this in the standard
library:

~~~java
public static <T extends Comparable<? super T>> T max(T a, T b) { … }
~~~

The naïve version uses \`<T extends Comparable<T>>\`. That works for \`String\`,
\`Integer\`, and any class that directly implements \`Comparable<SameClass>\`.

It **fails silently** for inheritance hierarchies. Consider:

~~~java
class Shape implements Comparable<Shape> {
    @Override public int compareTo(Shape other) { … }
}
class Circle extends Shape { }   // Circle does NOT implement Comparable<Circle>
~~~

With the naïve bound, you cannot call \`max(circle1, circle2)\` because \`Circle\` does
not satisfy \`Comparable<Circle>\`. With \`Comparable<? super T>\` the compiler accepts
it — \`Circle extends Shape\`, and \`Shape\` provides the \`Comparable<Shape>\` that a
\`Circle\` needs.

The rule: **always use \`? super T\` on Comparable and Comparator bounds** in library
code, because you cannot know whether callers will use the concrete type or an
ancestor's implementation.

~~~java
// Both compile with ? super T; only String compiles with the naïve T:
public static <T extends Comparable<? super T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
~~~`,
    },
    {
      id: 'pecs',
      heading: 'PECS — Producer Extends, Consumer Super',
      body: `Every wildcard question in generics reduces to one question: does this parameter
*produce* values (you read from it) or *consume* values (you write into it)?

> **Producer → \`? extends T\`**
> **Consumer → \`? super T\`**

The classic proof is a copy method:

~~~java
// src is a PRODUCER — we only read from it  → ? extends T
// dst is a CONSUMER — we only write into it → ? super T
static <T> void copy(List<? super T> dst, List<? extends T> src) {
    for (T item : src) dst.add(item);
}
~~~

This single method handles all of these:

~~~java
List<Integer> ints    = List.of(1, 2, 3);
List<Number>  numbers = new ArrayList<>();
List<Object>  objects = new ArrayList<>();

copy(numbers, ints);   // T = Integer; dest accepts Number (? super Integer) ✓
copy(objects, ints);   // T = Integer; dest accepts Object  (? super Integer) ✓
copy(objects, numbers);// T = Number;  dest accepts Object  (? super Number)  ✓
// copy(ints, numbers); // would put Number into List<Integer> — correctly rejected ✓
~~~

The restriction you pay for flexibility: you can only **read** from a \`? extends T\`
producer (reads come out as \`T\`; you cannot write because the actual type might be a
stricter subtype). You can only **write** into a \`? super T\` consumer (writes go in as
\`T\`; you can only read out as \`Object\` because the actual type might be broader).

When you need to do both (read and write), use the exact type — no wildcard.`,
    },
    {
      id: 'erasure-consequences',
      heading: 'Type erasure and its hard limits',
      body: `Generic type information exists only at compile time. The compiler uses it to check
your code, then **erases** every type parameter before generating bytecode:

- Unbounded \`T\` → \`Object\`
- \`T extends Foo\` → \`Foo\`
- Compiler-inserted casts appear wherever the erased type is used as the declared type.

At runtime, \`List<String>\` and \`List<Integer>\` are the same class — \`java.util.List\`.
This produces four categories of hard limits:

~~~java
// 1. Cannot create an array of a type parameter — T is unknown at runtime:
//    T[] arr = new T[10];                     // compile error

// 2. Cannot use instanceof with a parameterized type:
//    if (x instanceof List<String>) {}        // compile error

// 3. Cannot overload methods that differ only in their type argument,
//    because both signatures erase to the same thing:
//    void process(List<String> xs) {}
//    void process(List<Integer> xs) {}        // compile error: duplicate method

// 4. Generic exceptions: you can declare Foo<T> extends Exception,
//    but you cannot catch it as Foo<String>:
//    catch (MyException<String> e) {}          // compile error
~~~

The compiler warns you with "unchecked cast" when you force the type system in ways
it cannot verify at runtime. Those warnings are real signals — every \`@SuppressWarnings("unchecked")\`
should be accompanied by a comment explaining why the cast is safe.

**Heap pollution** occurs when a variable of a parameterised type refers to an object
that is not of that type. The JVM catches it at the point of use — typically an
unrelated line — with a \`ClassCastException\` emitted by the invisible compiler-inserted
cast, making the stack trace confusing.`,
    },
    {
      id: 'class-token',
      heading: 'Class<T> tokens — restoring runtime type information',
      body: `Because type parameters are erased, you sometimes need to pass the type as an
explicit \`Class<T>\` value (called a **type token**) so that runtime operations are
possible.

The canonical example is the **typesafe heterogeneous container** (Effective Java,
Item 33). A normal generic container is parameterised once: a \`Map<K, V>\` can hold
one combination of key and value types. A heterogeneous container is parameterised
per *element*, enabling you to store a \`String\`, an \`Integer\`, and a \`ZoneId\` in the
same map while retaining type safety:

~~~java
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class TypesafeContainer {
    private final Map<Class<?>, Object> map = new HashMap<>();

    public <T> void put(Class<T> type, T value) {
        map.put(Objects.requireNonNull(type), value);
    }

    public <T> T get(Class<T> type) {
        // cast is safe: put() guarantees the value stored under type is a T
        return type.cast(map.get(type));
    }
}
~~~

Usage:

~~~java
TypesafeContainer c = new TypesafeContainer();
c.put(String.class,  "hello");
c.put(Integer.class, 42);

String  s = c.get(String.class);   // "hello" — no cast in caller code
Integer n = c.get(Integer.class);  // 42      — type-safe
~~~

\`Class.cast()\` is the safe alternative to a raw \`(T)\` cast — it uses reflection to
perform a runtime type check and throws \`ClassCastException\` if the object is not
compatible, instead of silently producing heap pollution.

The limitation: you cannot use parameterized types as keys. \`List<String>.class\`
does not exist — you'd need a **super type token** (Gafter, 2006) to go further.`,
    },
    {
      id: 'overload-pitfalls',
      heading: 'Generic overloading and bridge methods',
      body: `The erasure rule explains several overloading surprises.

**You cannot overload on different type arguments:**

~~~java
class Processor {
    void handle(List<String>  xs) {}   // erases to handle(List)
    void handle(List<Integer> xs) {}   // erases to handle(List) — duplicate! compile error
}
~~~

The workaround is to give the methods distinct names (\`handleStrings\` / \`handleIntegers\`)
or to accept a common supertype (\`List<?>\`) and branch internally.

**Bridge methods** are compiler-generated synthetic methods that maintain binary
compatibility when a generic class or interface is implemented. If you override a
method whose erased signature differs from the original, the compiler inserts a bridge:

~~~java
interface Comparable<T> { int compareTo(T other); }

class MyString implements Comparable<MyString> {
    public int compareTo(MyString other) { … }
    // compiler also generates:
    // public synthetic bridge int compareTo(Object other) {
    //     return compareTo((MyString) other);   // delegates to the typed version
    // }
}
~~~

Bridge methods appear in stack traces and reflection results — knowing they exist
helps you interpret those outputs correctly.

**Type inference edge cases** — the compiler infers the most specific type that
satisfies all constraints, which is sometimes not what you expect:

~~~java
var result = Util.firstNonNull("hello", 42);
// Both String and Integer — inferred type is Serializable & Comparable<…>
// If you assign to String you get a compile error.
~~~`,
    },
    {
      id: 'bounded-wildcards-api',
      heading: 'Designing generic APIs: bounds at the right level',
      body: `When deciding where to put bounds, ask: "who gains flexibility?"

**Bounded type parameter** (\`<T extends Number>\`) — the *caller* cannot choose an
arbitrary \`T\` separately; every use of \`T\` in that method must be the same concrete
type. Use when the same type must appear in multiple positions (parameter and return
type, two parameters, etc.).

**Bounded wildcard** (\`List<? extends Number>\`) — loosens what the *caller* can
pass. Use when a collection is only produced or only consumed by the method and
you don't need to name its element type elsewhere.

~~~java
// Bounded type parameter — T appears in both parameter AND return type
public static <T extends Comparable<? super T>> T max(List<T> list) { … }

// Bounded wildcard — we only read from the list; we don't return T
public static double sum(List<? extends Number> list) { … }
~~~

The rule of thumb: **if the type parameter appears only once** in the whole method
signature (single parameter, no return type usage), a wildcard is simpler. If it
appears twice or more (return type + parameter, two parameters that must match, etc.),
use a bounded type parameter.

Avoid wildcards in return types — they force wildcards on the *caller*, creating a
cascade. This is the "wildcard capture" pain that Joshua Bloch warns against in
Effective Java Item 31.`,
    },
  ],
  exercises: [
    {
      id: 'pair-and-repeat',
      title: 'Generic Pair record and repeat utility',
      difficulty: 'warmup',
      prompt: `Implement two independent generic constructs in a single file.

**Part A — \`Pair<A, B>\` record**

Define a generic record:

~~~java
public record Pair<A, B>(A first, B second) { ... }
~~~

Add:

1. An instance method \`Pair<B, A> swapped()\` that returns a new \`Pair\` with
   the components in reverse order.
2. A static factory method \`static <A, B> Pair<A, B> of(A a, B b)\` so callers
   can write \`Pair.of("hello", 42)\` without spelling out the type arguments.

**Part B — \`repeat\` utility method**

In the same file, add a static generic method (outside the record, in a wrapper
class \`PairDemo\`):

~~~java
static <T> List<T> repeat(T value, int n)
~~~

It must return a new, **mutable** \`ArrayList\` containing \`value\` repeated \`n\`
times. Throw \`IllegalArgumentException\` when \`n < 0\`.

**In \`main\`**, demonstrate:
- \`Pair.of("London", 8_799_800).swapped()\` prints \`Pair[first=8799800, second=London]\`
- A \`Pair<Boolean, List<String>>\` to show nesting works.
- \`repeat("go", 4)\` returns \`[go, go, go, go]\`.
- \`repeat(0, 0)\` returns \`[]\`.
- Calling \`repeat(null, 3)\` is allowed and returns \`[null, null, null]\`.`,
      starter: `import java.util.ArrayList;
import java.util.List;

// Part A: generic record — a record is implicitly final and provides
// a canonical constructor, equals, hashCode, and toString for free.
record Pair<A, B>(A first, B second) {

    // TODO: static factory — lets callers write Pair.of(a, b) without
    // spelling out the type arguments explicitly.
    public static <A, B> Pair<A, B> of(A a, B b) {
        // TODO
        return null;
    }

    // TODO: instance method — returns a NEW Pair with components swapped.
    public Pair<B, A> swapped() {
        // TODO
        return null;
    }
}

public class PairDemo {

    // Part B: generic utility method.
    // Returns a mutable ArrayList so callers can add to it later.
    public static <T> List<T> repeat(T value, int n) {
        // TODO: throw IllegalArgumentException when n < 0
        // TODO: build and return the list
        return null;
    }

    public static void main(String[] args) {
        // --- Part A demos ---
        // TODO: Pair.of("London", 8_799_800) and call swapped()
        // TODO: nested Pair<Boolean, List<String>>

        // --- Part B demos ---
        // TODO: repeat("go", 4)
        // TODO: repeat(0, 0)
        // TODO: repeat(null, 3)
    }
}`,
      hints: [
        'The static factory is one line: \`return new Pair<>(a, b);\`. The diamond operator works here because the compiler infers \`A\` and \`B\` from the arguments.',
        '\`swapped()\` is also one line: \`return new Pair<>(second, first);\`. Notice the type parameters flip — the return type is \`Pair<B, A>\`, not \`Pair<A, B>\`.',
        'For \`repeat\`: guard with \`if (n < 0) throw new IllegalArgumentException(...)\`, then create an \`ArrayList<T>(n)\` and fill it with a loop calling \`list.add(value)\`. Passing \`null\` as value is legal — \`ArrayList\` allows \`null\` elements.',
      ],
      solution: `import java.util.ArrayList;
import java.util.List;

record Pair<A, B>(A first, B second) {

    // Static factory: type arguments A and B are inferred from the call-site arguments,
    // so callers never have to write Pair.<String, Integer>of(...).
    public static <A, B> Pair<A, B> of(A a, B b) {
        return new Pair<>(a, b);
    }

    // swapped: the return type is Pair<B, A> — the type parameters are deliberately
    // reversed to mirror the component order.
    public Pair<B, A> swapped() {
        return new Pair<>(second, first);
    }
}

public class PairDemo {

    // repeat: generic method — T is inferred from the value argument.
    // Returns a mutable ArrayList so callers can continue adding elements.
    public static <T> List<T> repeat(T value, int n) {
        if (n < 0) {
            throw new IllegalArgumentException(
                "n must be >= 0, got: " + n);
        }
        List<T> result = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            result.add(value);
        }
        return result;
    }

    public static void main(String[] args) {
        // --- Part A: Pair ---

        Pair<String, Integer> cityPop = Pair.of("London", 8_799_800);
        System.out.println(cityPop);            // Pair[first=London, second=8799800]
        System.out.println(cityPop.swapped());  // Pair[first=8799800, second=London]

        // Nesting: Pair whose second component is itself a List<String>
        Pair<Boolean, List<String>> nested =
            Pair.of(true, List.of("alpha", "beta", "gamma"));
        System.out.println(nested.first());     // true
        System.out.println(nested.second());    // [alpha, beta, gamma]
        // swapped() works on nested types too:
        Pair<List<String>, Boolean> flipped = nested.swapped();
        System.out.println(flipped.first());    // [alpha, beta, gamma]

        // --- Part B: repeat ---

        List<String> words = repeat("go", 4);
        System.out.println(words);              // [go, go, go, go]
        words.add("stop");                      // mutable — this must work
        System.out.println(words);              // [go, go, go, go, stop]

        List<Integer> empty = repeat(0, 0);
        System.out.println(empty);              // []

        List<String> nulls = repeat(null, 3);
        System.out.println(nulls);              // [null, null, null]

        // Negative n throws:
        try {
            repeat("x", -1);
        } catch (IllegalArgumentException e) {
            System.out.println("Caught: " + e.getMessage()); // n must be >= 0, got: -1
        }
    }
}`,
      explanation: `**\`Pair<A, B>\` as a record** gives you \`equals\`, \`hashCode\`, and \`toString\` for
free. The two type parameters \`A\` and \`B\` are independent, so \`Pair<String, Integer>\`
and \`Pair<Integer, String>\` are distinct types — the compiler enforces this and
\`swapped()\`'s return type \`Pair<B, A>\` captures that flip statically.

The **static factory** \`of\` is a generic *method* (its own \`<A, B>\` type parameters)
rather than relying on the record's type parameters directly. This lets the compiler
infer both type arguments from the call-site arguments, which is why \`Pair.of("x", 1)\`
works without any explicit type witness.

**\`repeat\`** illustrates a standalone generic method — the type parameter \`T\` is
scoped to the method, not to any enclosing class. Returning a mutable \`ArrayList\`
(rather than \`List.of\`) is a deliberate API choice: callers who only need a read-only
view can assign it to \`List<T>\`, while callers who need to append can keep the
\`ArrayList<T>\` reference. The \`null\` case is intentionally allowed — restricting it
would require a separate overload or a nullable annotation, adding complexity that the
exercise does not warrant.`,
    },
    {
      id: 'generic-sort',
      title: 'Generic max and sort with the correct recursive bound',
      difficulty: 'core',
      prompt: `Implement a class \`Ordering\` with three static generic methods. Each must use
the **correct** recursive bound \`<T extends Comparable<? super T>>\` — not the naïver
\`<T extends Comparable<T>>\` — and you must include a comment explaining why the
\`? super T\` form is necessary.

1. \`T max(List<? extends T> list)\` — return the largest element.
   Throw \`NoSuchElementException\` on an empty list.

2. \`void insertionSort(List<T> list)\` — sort the list **in place** using insertion
   sort. Work directly on the list via \`get\`/\`set\`.

3. \`List<T> merge(List<? extends T> a, List<? extends T> b)\` — return a new list
   containing all elements of \`a\` and \`b\` in sorted order (merge-sort merge step).
   Neither input list is required to be sorted; sort the output.

In \`main\`:

- Demonstrate \`max\` and \`insertionSort\` on \`List<Integer>\` and \`List<String>\`.
- Demonstrate \`merge\` on two \`List<Integer>\` lists.
- Show that the bound is wide enough for a subclass hierarchy: create a
  \`List<java.time.LocalDate>\` (which implements \`ChronoLocalDate\` which provides
  \`Comparable<ChronoLocalDate>\`) and call \`max\` on it. With the naïve
  \`Comparable<T>\` bound this would fail to compile because \`LocalDate\` implements
  \`Comparable<ChronoLocalDate>\`, not \`Comparable<LocalDate>\`.`,
      starter: `import java.time.LocalDate;
import java.util.*;

public class Ordering {

    // Why <T extends Comparable<? super T>> and not <T extends Comparable<T>>:
    // TODO: add your explanation here as a comment

    public static <T extends Comparable<? super T>> T max(List<? extends T> list) {
        // TODO: throw NoSuchElementException on empty, then iterate
        return null;
    }

    public static <T extends Comparable<? super T>> void insertionSort(List<T> list) {
        // TODO: classic insertion sort using list.get / list.set
        // outer loop i from 1 to size-1; inner loop slides list[i] left while
        // it is smaller than its predecessor
    }

    public static <T extends Comparable<? super T>> List<T> merge(
            List<? extends T> a, List<? extends T> b) {
        // TODO: combine both lists into one ArrayList, sort with insertionSort, return
        return null;
    }

    public static void main(String[] args) {
        // TODO: Integer list, String list, LocalDate list demonstrations
    }
}`,
      hints: [
        'For max, seed with list.get(0) and loop from index 1; if list.get(i).compareTo(current) > 0, update current.',
        'Insertion sort inner loop: while j > 0 && list.get(j-1).compareTo(list.get(j)) > 0, swap list[j-1] and list[j], decrement j. Use a helper swap method.',
        'LocalDate implements ChronoLocalDate which implements Comparable<ChronoLocalDate>, so LocalDate\'s compareTo accepts any ChronoLocalDate. The bound ? super LocalDate includes ChronoLocalDate, which is why ? super T is required.',
      ],
      solution: `import java.time.LocalDate;
import java.util.*;

public class Ordering {

    // Why <T extends Comparable<? super T>> and not <T extends Comparable<T>>:
    //
    // Comparable<T> means "T can compare itself to another T".
    // Comparable<? super T> means "T can compare itself to a T OR any supertype of T".
    //
    // Many classes implement Comparable on an ancestor rather than themselves, for example:
    //   LocalDate implements Comparable<ChronoLocalDate>  (not Comparable<LocalDate>)
    //
    // With the naïve bound <T extends Comparable<T>>, T=LocalDate requires LocalDate to
    // implement Comparable<LocalDate> directly — it does not, so the call would not compile.
    //
    // With <T extends Comparable<? super T>>, T=LocalDate requires LocalDate to implement
    // Comparable<SomeAncestorOfLocalDate> — it implements Comparable<ChronoLocalDate>,
    // and ChronoLocalDate is a supertype of LocalDate, so the bound is satisfied.

    public static <T extends Comparable<? super T>> T max(List<? extends T> list) {
        if (list.isEmpty()) throw new NoSuchElementException("list is empty");
        T current = list.get(0);
        for (int i = 1; i < list.size(); i++) {
            if (list.get(i).compareTo(current) > 0) {
                current = list.get(i);
            }
        }
        return current;
    }

    public static <T extends Comparable<? super T>> void insertionSort(List<T> list) {
        for (int i = 1; i < list.size(); i++) {
            int j = i;
            while (j > 0 && list.get(j - 1).compareTo(list.get(j)) > 0) {
                T tmp = list.get(j - 1);
                list.set(j - 1, list.get(j));
                list.set(j, tmp);
                j--;
            }
        }
    }

    public static <T extends Comparable<? super T>> List<T> merge(
            List<? extends T> a, List<? extends T> b) {
        List<T> result = new ArrayList<>(a.size() + b.size());
        result.addAll(a);
        result.addAll(b);
        insertionSort(result);
        return result;
    }

    public static void main(String[] args) {
        List<Integer> ints = new ArrayList<>(List.of(5, 3, 8, 1, 9, 2));
        System.out.println("Before sort: " + ints);
        insertionSort(ints);
        System.out.println("After sort:  " + ints);          // [1, 2, 3, 5, 8, 9]
        System.out.println("Max int: "     + max(ints));      // 9

        List<String> words = new ArrayList<>(List.of("mango", "apple", "cherry", "banana"));
        insertionSort(words);
        System.out.println("Sorted words: " + words);         // [apple, banana, cherry, mango]
        System.out.println("Max word: "     + max(words));    // mango

        List<Integer> evens = List.of(2, 8, 4);
        List<Integer> odds  = List.of(7, 1, 5);
        System.out.println("Merged: " + merge(evens, odds));  // [1, 2, 4, 5, 7, 8]

        // LocalDate — implements Comparable<ChronoLocalDate>, NOT Comparable<LocalDate>
        // This line would NOT compile with the naïve <T extends Comparable<T>> bound.
        List<LocalDate> dates = new ArrayList<>(List.of(
            LocalDate.of(2024, 6, 15),
            LocalDate.of(2023, 1, 1),
            LocalDate.of(2025, 12, 31)
        ));
        System.out.println("Max date: " + max(dates));        // 2025-12-31
    }
}`,
      explanation: `The \`? super T\` extension to the Comparable bound is the most common gotcha in
generic API design. The JDK's own \`Collections.sort\` uses it precisely because the
alternative breaks on date/time types and any other class in an inheritance hierarchy
where the parent defines the \`Comparable\` implementation.

\`merge\` combines the two lists with \`addAll\` (which works because \`? extends T\`
satisfies \`Collection.addAll\`'s signature \`addAll(Collection<? extends E>)\`), then
reuses \`insertionSort\`. For large inputs you would obviously implement the linear merge
step; the exercise deliberately keeps it simple so the focus stays on bounds, not
algorithm complexity.

Notice that \`max\` accepts \`List<? extends T>\` rather than \`List<T>\`. This lets you
call \`max\` on a \`List<Integer>\` when \`T\` is inferred as \`Number\` — a flexibility that
costs nothing and avoids forcing callers to widen their types.`,
    },
    {
      id: 'pecs-copy-and-sum',
      title: 'PECS in practice: copy, sum, and what fails to compile',
      difficulty: 'core',
      prompt: `Implement \`PecsDemo\` with the following methods. For each method, add a comment
naming which PECS rule applies and why.

1. \`double sum(List<? extends Number> xs)\` — sum elements as doubles.

2. \`<T> void copy(List<? super T> dest, List<? extends T> src)\` — append every
   element of \`src\` into \`dest\`.

3. \`<T extends Comparable<? super T>> void clampInto(List<? super T> dest,
   List<? extends T> src, T lo, T hi)\` — append only the elements of \`src\`
   in the closed range \`[lo, hi]\` into \`dest\`.

In \`main\`, demonstrate each method, then include **commented-out lines** that show
four calls that do NOT compile, with a one-line explanation for each rejection.

Required non-compiling examples:
- Passing \`List<Integer>\` to a parameter typed as \`List<Number>\` (invariance reminder).
- Calling \`sum\` and then attempting to \`add\` into the same \`List<? extends Number>\`.
- Passing a \`List<Object>\` as \`src\` when \`T\` is inferred as \`Integer\`.
- Calling \`copy(integers, numbers)\` where integers is \`List<Integer>\` and numbers is
  \`List<Number>\`.`,
      starter: `import java.util.ArrayList;
import java.util.List;

public class PecsDemo {

    // PECS rule: ___  Reason: ___
    public static double sum(List<? extends Number> xs) {
        // TODO
        return 0;
    }

    // PECS rule: ___  Reason: ___
    public static <T> void copy(List<? super T> dest, List<? extends T> src) {
        // TODO
    }

    // PECS applied twice — explain both wildcards in a comment
    public static <T extends Comparable<? super T>> void clampInto(
            List<? super T> dest, List<? extends T> src, T lo, T hi) {
        // TODO
    }

    public static void main(String[] args) {
        // Demonstrate sum
        // Demonstrate copy
        // Demonstrate clampInto

        // --- Lines that do NOT compile — leave as comments with explanation ---
        // 1. List<Number> n = new ArrayList<Integer>();
        //    // Reason: generics are invariant — List<Integer> is not a List<Number>

        // 2. TODO: add three more non-compiling examples with explanations
    }
}`,
      hints: [
        'sum: iterate with Number n : xs; call n.doubleValue(); no writes needed — that is why ? extends is correct.',
        'clampInto inner check: lo.compareTo(e) <= 0 && e.compareTo(hi) <= 0 — both calls work because e is at least T and the bound ensures T has a compareTo compatible with T or a supertype.',
        'For the copy(integers, numbers) non-compiling example: integers is List<Integer>, numbers is List<Number>. When you write copy(integers, numbers), T would need to be both Number (so Integer extends Number satisfies src=? extends T) and Integer (so integers satisfies dest=? super T). Those constraints conflict, hence a compile error.',
      ],
      solution: `import java.util.ArrayList;
import java.util.List;

public class PecsDemo {

    // PECS rule: PRODUCER EXTENDS
    // Reason: we only READ from xs (produce values); writing is impossible because
    // the actual element type at runtime might be a stricter subtype of Number.
    public static double sum(List<? extends Number> xs) {
        double total = 0;
        for (Number n : xs) total += n.doubleValue();
        return total;
    }

    // PECS rule: dest = CONSUMER SUPER, src = PRODUCER EXTENDS
    // Reason: we write T values into dest (it consumes) and read T values from src (it produces).
    public static <T> void copy(List<? super T> dest, List<? extends T> src) {
        for (T item : src) dest.add(item);
    }

    // dest = CONSUMER SUPER (we add T values into it)
    // src  = PRODUCER EXTENDS (we read T values from it)
    // The Comparable bound also uses ? super T for the same reason as Ordering.max:
    // we need to handle classes that implement Comparable on an ancestor.
    public static <T extends Comparable<? super T>> void clampInto(
            List<? super T> dest, List<? extends T> src, T lo, T hi) {
        for (T e : src) {
            if (lo.compareTo(e) <= 0 && e.compareTo(hi) <= 0) {
                dest.add(e);
            }
        }
    }

    public static void main(String[] args) {
        // sum — accepts Integer, Double, Long lists
        List<Integer> ints    = List.of(1, 2, 3, 4, 5);
        List<Double>  doubles = List.of(0.5, 1.5, 2.0);
        System.out.println("Sum ints:    " + sum(ints));      // 15.0
        System.out.println("Sum doubles: " + sum(doubles));   // 4.0

        // copy — Integer list into Number list and Object list
        List<Number> numbers = new ArrayList<>();
        List<Object> objects = new ArrayList<>();
        copy(numbers, ints);
        copy(objects, numbers);
        System.out.println("Numbers: " + numbers);  // [1, 2, 3, 4, 5]
        System.out.println("Objects: " + objects);  // [1, 2, 3, 4, 5]

        // clampInto — keep only values in [2, 4]
        List<Number> clamped = new ArrayList<>();
        clampInto(clamped, ints, 2, 4);
        System.out.println("Clamped [2,4]: " + clamped);   // [2, 3, 4]

        // clampInto — keep strings between "b" and "e"
        List<String> words    = List.of("apple", "cherry", "date", "elderberry", "fig");
        List<Object> filtered = new ArrayList<>();
        clampInto(filtered, words, "b", "e");
        System.out.println("Filtered [b,e]: " + filtered);  // [cherry, date, elderberry]

        // ---- Lines that do NOT compile ----

        // 1. List<Number> n = new ArrayList<Integer>();
        //    REASON: invariance — List<Integer> is not a subtype of List<Number>,
        //    even though Integer extends Number.

        // 2. sum(ints); ints.add(6);
        //    ... actually ints is List.of so immutable, but:
        //    List<? extends Number> xs = ints; xs.add(6);
        //    REASON: you cannot add to a ? extends Number list — the actual type
        //    could be List<Double>; adding an Integer would violate it.

        // 3. List<Object> src = new ArrayList<Object>(List.of("a","b"));
        //    copy(ints, src);
        //    REASON: src is List<Object> but dest=List<Integer> requires T=Integer,
        //    which forces src to be List<? extends Integer>; Object does not extend Integer.

        // 4. copy(ints, numbers);
        //    REASON: ints is List<Integer>. For dest=List<? super T>, T must be Integer
        //    (or a subtype). For src=List<? extends T>=List<Number>, T must be Number
        //    (or a supertype). Integer is not Number's supertype, so no T satisfies both.
    }
}`,
      explanation: `\`sum\` is the most common PECS Producer example: \`? extends Number\` lets you pass any
\`List<Integer>\`, \`List<Double>\`, or \`List<Long>\` without writing separate overloads, and
you pay for that flexibility by surrendering write access — which is fine because you
only need to read.

\`copy\` is the canonical bidirectional PECS: the source is a producer (upper bound),
the destination is a consumer (lower bound). The two commented non-compiling examples
show the exact mirror failure: a producer cannot receive writes; a type mismatch between
\`dest\` and \`src\` means no valid \`T\` can satisfy both constraints simultaneously.

\`clampInto\` combines wildcards with a bounded type parameter. Because \`lo\` and \`hi\`
appear as exact \`T\` parameters (not wildcards), the compiler pins \`T\` to a concrete
type from those arguments, then uses the wildcards to give src and dest maximum
flexibility. The range check \`lo.compareTo(e) <= 0\` compiles because \`e\` is at least
\`T\`, and \`T\` has \`compareTo\` available from the bound.`,
    },
    {
      id: 'typesafe-container',
      title: 'Typesafe heterogeneous container',
      difficulty: 'challenge',
      prompt: `Implement \`TypesafeRegistry\`, a container that maps \`Class<T>\` tokens to values
of the corresponding type \`T\`, giving per-element type safety across heterogeneous
stored types.

**Requirements:**

1. \`<T> void put(Class<T> type, T value)\` — store \`value\` under \`type\`. Reject
   a \`null\` type with \`NullPointerException\`. Allow storing \`null\` as a value.

2. \`<T> T get(Class<T> type)\` — retrieve the value stored under \`type\`, or
   \`null\` if nothing is stored. Use \`type.cast()\` — **not a raw cast** — to
   perform the retrieval. Explain in a comment why \`type.cast()\` is preferable
   to \`(T) map.get(type)\`.

3. \`<T> T getOrDefault(Class<T> type, T defaultValue)\` — like \`get\` but returns
   \`defaultValue\` when nothing is stored for \`type\`.

4. \`boolean containsKey(Class<?> type)\` — returns \`true\` if a mapping exists.

5. \`<T> T remove(Class<T> type)\` — removes and returns the value, or \`null\`.

6. \`int size()\` and \`void clear()\`.

**Adversarial test in \`main\`**: demonstrate that the container is type-safe by
attempting (in a comment) to store a \`String\` under \`Integer.class\` — show that
this is a compile error, not a runtime error. Then demonstrate that \`get\` never
requires a cast at the call site. Finally, store five different types
(\`String\`, \`Integer\`, \`Double\`, \`Boolean\`, \`java.time.LocalDate\`) and retrieve
each without casting.

**Bonus (optional, no marks):** document why you cannot use a parameterized type
like \`List<String>.class\` as a key, and what a "super type token" is as a
concept (no implementation required — a comment suffices).`,
      starter: `import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class TypesafeRegistry {

    // The map's value type is Object — we lose the per-entry type here, but
    // we restore it in get() via Class.cast().
    private final Map<Class<?>, Object> store = new HashMap<>();

    public <T> void put(Class<T> type, T value) {
        // TODO: validate type; store in map
    }

    public <T> T get(Class<T> type) {
        // TODO: use type.cast() — explain why in a comment
        return null;
    }

    public <T> T getOrDefault(Class<T> type, T defaultValue) {
        // TODO
        return null;
    }

    public boolean containsKey(Class<?> type) {
        // TODO
        return false;
    }

    public <T> T remove(Class<T> type) {
        // TODO
        return null;
    }

    public int  size()  { return store.size(); }
    public void clear() { store.clear(); }

    public static void main(String[] args) {
        TypesafeRegistry reg = new TypesafeRegistry();

        // Store five different types
        // TODO

        // Retrieve each without a cast
        // TODO

        // Demonstrate getOrDefault
        // TODO

        // Demonstrate remove
        // TODO

        // --- Does NOT compile (leave as comment):
        // reg.put(Integer.class, "not an integer");
        // REASON: TODO
    }
}`,
      hints: [
        'put: Objects.requireNonNull(type, "type must not be null"); then store.put(type, value); — that is the whole method.',
        'get: return type.cast(store.get(type)); — Class.cast() does a runtime checked cast using reflection. It is preferable to (T) because (T) is erased at runtime (becomes (Object)) so it never actually checks; type.cast() does the check and throws ClassCastException with a useful message if something went wrong through a raw-type back-door.',
        'For getOrDefault: T found = get(type); return found != null ? found : defaultValue; — be aware this returns defaultValue when null was explicitly stored, which is a known limitation of this pattern (fixable with containsKey).',
      ],
      solution: `import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class TypesafeRegistry {

    private final Map<Class<?>, Object> store = new HashMap<>();

    public <T> void put(Class<T> type, T value) {
        Objects.requireNonNull(type, "type must not be null");
        store.put(type, value);
        // Note: value may be null — that is intentional. The key (type) is what
        // guarantees type safety; the value is allowed to be absent.
    }

    public <T> T get(Class<T> type) {
        // We use type.cast() rather than the raw cast (T):
        //
        // (T) store.get(type)  — erased at runtime to (Object) store.get(type);
        //                        the JVM never checks the cast, so a back-door
        //                        violation (e.g. using raw types to insert a String
        //                        under Integer.class) would produce heap pollution
        //                        that detonates elsewhere with a confusing message.
        //
        // type.cast(...)        — calls Class.cast() which uses reflection to do a
        //                         real runtime instanceof check. If the stored value
        //                         is not a T, ClassCastException is thrown here, at
        //                         the point of the violation, with a meaningful message.
        return type.cast(store.get(type));
    }

    public <T> T getOrDefault(Class<T> type, T defaultValue) {
        // Caveat: if null was explicitly put() for type, this returns defaultValue
        // instead of null. A fully correct implementation would use containsKey()
        // to distinguish "not present" from "stored null".
        T found = get(type);
        return found != null ? found : defaultValue;
    }

    public boolean containsKey(Class<?> type) {
        return store.containsKey(type);
    }

    public <T> T remove(Class<T> type) {
        return type.cast(store.remove(type));
    }

    public int  size()  { return store.size(); }
    public void clear() { store.clear(); }

    public static void main(String[] args) {
        TypesafeRegistry reg = new TypesafeRegistry();

        reg.put(String.class,    "hello generics");
        reg.put(Integer.class,   42);
        reg.put(Double.class,    3.14159);
        reg.put(Boolean.class,   true);
        reg.put(LocalDate.class, LocalDate.of(2025, 6, 15));

        System.out.println("size: " + reg.size());   // 5

        // No cast required at the call site — full compile-time type safety:
        String    s = reg.get(String.class);
        Integer   n = reg.get(Integer.class);
        Double    d = reg.get(Double.class);
        Boolean   b = reg.get(Boolean.class);
        LocalDate ld = reg.get(LocalDate.class);

        System.out.println(s);   // hello generics
        System.out.println(n);   // 42
        System.out.println(d);   // 3.14159
        System.out.println(b);   // true
        System.out.println(ld);  // 2025-06-15

        // getOrDefault — Long was never stored
        Long fallback = reg.getOrDefault(Long.class, -1L);
        System.out.println("Long default: " + fallback);   // -1

        // remove
        String removed = reg.remove(String.class);
        System.out.println("Removed: " + removed);         // hello generics
        System.out.println("size after remove: " + reg.size()); // 4

        // --- Does NOT compile (correct — type-safe at compile time):
        // reg.put(Integer.class, "not an integer");
        // REASON: put(Class<T> type, T value) binds T=Integer from the first argument,
        // then requires the second argument to also be Integer. "not an integer" is a
        // String, which is not Integer — compile error.

        // --- Bonus: super type tokens ---
        // List<String>.class does not exist. Class literals require a raw or array type,
        // not a parameterized one. This means TypesafeRegistry cannot have separate
        // entries for List<String> and List<Integer> — both would map to List.class.
        //
        // The "super type token" pattern (Neal Gafter, 2006) solves this by using an
        // anonymous subclass of a generic abstract class to capture the type argument
        // in a position where it survives erasure (the superclass's generic signature
        // in the class file). Libraries like Guava (TypeToken) and Jackson use this.
        // It is beyond scope here but worth knowing the concept exists.
    }
}`,
      explanation: `The typesafe heterogeneous container shows how to recover type safety when you genuinely
need to store objects of different types in the same collection.

The key insight is the **type token**: by using \`Class<T>\` as the key, you bind the
key to the value type at compile time. \`put(Integer.class, "wrong")\` is a compile
error because the compiler pins \`T = Integer\` from the first argument and then rejects
\`"wrong"\` (a \`String\`) as the second. You never need to cast at the call site of \`get\`.

\`type.cast()\` is meaningfully better than \`(T) raw cast\`. The raw cast is erased to
\`(Object)\` — the JVM does nothing. \`type.cast()\` calls \`Class.cast()\` which uses
reflection to check \`type.isInstance(obj)\` before returning. This means heap pollution
introduced through a raw-type back-door (a caller who ignores compiler warnings and
stuffs a \`String\` into \`Integer.class\`) is caught here, at the violation site, with
a \`ClassCastException\` that names the offending types — not silently propagated to an
unrelated line later.

The \`getOrDefault\` null ambiguity is a real limitation: you cannot distinguish "key not
present" from "null was explicitly stored" without a separate \`containsKey\` check. A
production implementation would use \`containsKey\` inside \`getOrDefault\` to handle both
cases correctly — the exercise deliberately exposes this so you notice it.`,
    },
  ],
  takeaways: [
    'Generics are **invariant**: \`List<Integer>\` is not a \`List<Number>\`. Wildcards exist precisely to recover flexibility without breaking type safety.',
    'Use **\`<T extends Comparable<? super T>>\`** — not \`<T extends Comparable<T>>\` — in any library-quality sort or max method; the \`? super\` form handles classes that implement \`Comparable\` on an ancestor (e.g. \`LocalDate\`).',
    '**PECS**: if a collection *produces* values for you, use \`? extends T\`; if it *consumes* values from you, use \`? super T\`. Never use a wildcard in a return type — it forces wildcards onto every caller.',
    'Type erasure strips all type parameters at runtime. The four hard limits this creates: no \`new T[]\`, no \`instanceof List<String>\`, no overloading on type-argument differences, no catching a parameterized exception.',
    'Prefer **\`type.cast()\`** over raw \`(T)\` casts in generic code — it performs a real runtime check via reflection and surfaces heap pollution at the point of violation rather than silently propagating it.',
    'The **typesafe heterogeneous container** (Effective Java Item 33) uses \`Class<T>\` tokens as keys to give each stored entry its own type parameter, enabling compile-time type safety across heterogeneous types in a single map.',
    'Wildcards in return types are a design smell: they make the method signature viral, forcing wildcards into the caller\'s code. Use bounded type parameters when the type needs to appear in more than one position.',
  ],
}
