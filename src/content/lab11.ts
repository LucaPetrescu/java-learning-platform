import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab11: Lab = {
  id: 'lab-11',
  number: 11,
  title: 'Functional Programming, Lambdas & Streams',
  subtitle: 'Laziness, statelessness, pitfalls & production-grade pipelines',
  estimatedHours: 6,
  concepts: [
    'functional interface',
    'lambda',
    'method reference',
    'Stream API',
    'lazy evaluation',
    'stateless vs stateful ops',
    'flatMap',
    'groupingBy',
    'downstream collectors',
    'Collectors.teeing',
    'custom Collector',
    'Optional',
    'IntStream',
    'stream pitfalls',
  ],
  overview: `You have already seen lambdas and basic \`filter/map/collect\` pipelines. This lab
goes where most tutorials stop: **why streams behave the way they do**, where they fail
silently, and how to compose the collectors and pipeline shapes that appear in real
code reviews and senior-level interviews.

Theory covers the laziness model in depth, the stateless/stateful distinction, the
boxing cost of \`Stream<Integer>\` vs \`IntStream\`, and the three most common gotchas
(consumed streams, side-effectful \`peek\`, naked \`Optional.get\`). Exercises replace
trivial filter-and-map warmups with grouping with downstream collectors, \`flatMap\`
over nested structures, a top-N word-frequency pipeline, and a custom \`Collector\`
challenge.

Everything compiles on JDK 17+ (records, \`Collectors.teeing\` is JDK 12+).`,
  theory: [
    {
      id: 'laziness-and-fusion',
      heading: 'Laziness, fusion and why the pipeline model matters',
      body: `A \`Stream\` is a **description of a computation**, not a data structure. No element
is moved until a terminal operation is invoked. The JVM is then free to fuse consecutive
intermediate ops into a single pass — a \`filter\` followed by a \`map\` does not allocate
an intermediate list; both lambdas are applied to each element in the same iteration.

~~~java
// Nothing executes here — only a pipeline description is built.
Stream<String> pipeline = List.of("a", "bb", "ccc")
    .stream()
    .filter(s -> s.length() > 1)   // lazy
    .map(String::toUpperCase);     // lazy

// Terminal op triggers the full pipeline in one pass.
List<String> result = pipeline.collect(Collectors.toList()); // ["BB", "CCC"]
~~~

**Short-circuit terminals** (\`findFirst\`, \`anyMatch\`, \`limit\`) benefit the most: a
lazy pipeline over a million elements can terminate after examining just a few.

~~~java
// Only processes elements until one matching element is found.
Optional<Integer> first = IntStream.range(0, 1_000_000)
    .filter(n -> n % 777 == 0)
    .boxed()
    .findFirst();   // stops at 777 — does NOT scan the rest
~~~

The flip side: **once a terminal is called, the stream is consumed**. Calling a second
terminal on the same \`Stream\` throws \`IllegalStateException\`. Always create a fresh
stream from the source.`,
    },
    {
      id: 'stateless-vs-stateful',
      heading: 'Stateless vs stateful intermediate ops — why it matters for correctness',
      body: `Intermediate operations divide into two categories:

| Stateless | Stateful |
|-----------|----------|
| \`filter\`, \`map\`, \`flatMap\`, \`peek\` | \`sorted\`, \`distinct\`, \`limit\`, \`skip\` |
| Can process each element independently | Must see all (or many) elements before emitting |

Stateful ops force the pipeline to **buffer elements**, which negates laziness for
everything upstream of them. A \`sorted\` in the middle of a pipeline means the stream
must drain and sort that stage before the downstream can begin.

**Practical rule for parallel streams:** only stateless operations are safe to
parallelise without careful thought. Side-effectful lambdas in \`map\` or \`peek\` that
mutate shared state are a data race:

~~~java
List<Integer> sideEffect = new ArrayList<>();

// BUG: parallel stream writes to a non-thread-safe list
IntStream.range(0, 100)
    .parallel()
    .filter(n -> n % 2 == 0)
    .forEach(sideEffect::add);   // data race — list is not thread-safe

// FIX: collect is thread-safe via Collector's combiner
List<Integer> safe = IntStream.range(0, 100)
    .parallel()
    .filter(n -> n % 2 == 0)
    .boxed()
    .collect(Collectors.toList());
~~~

Even on sequential streams, using \`peek\` to accumulate results (rather than to
*observe* them for debugging) is incorrect because \`peek\` is defined as a no-op for
terminals that do not consume every element (\`findFirst\`, \`anyMatch\`).`,
    },
    {
      id: 'boxed-vs-intstream',
      heading: 'Boxed Stream<Integer> vs IntStream — the hidden allocation cost',
      body: `\`Stream<Integer>\` boxes every \`int\` into a heap-allocated \`Integer\` object.
For large numeric pipelines this is a measurable cost. The primitive specialisations
\`IntStream\`, \`LongStream\`, and \`DoubleStream\` avoid it entirely:

~~~java
// Stream<Integer> — boxes every element, then unboxes for arithmetic
int sum1 = List.of(1, 2, 3, 4, 5)
    .stream()
    .reduce(0, Integer::sum);   // Integer.sum unboxes both args on every call

// IntStream — no boxing at all
int sum2 = IntStream.of(1, 2, 3, 4, 5).sum();

// mapToInt converts a Stream<T> to IntStream
int totalLength = List.of("hello", "world", "java")
    .stream()
    .mapToInt(String::length)   // Stream<String> -> IntStream
    .sum();                     // 14

// asLongStream / boxed() bridge back when needed
LongStream big = IntStream.range(0, 1_000_000).asLongStream();
Stream<Integer> boxedAgain = IntStream.range(1, 5).boxed();
~~~

Primitive streams add terminal operations absent from \`Stream<T>\`:
\`sum()\`, \`average()\`, \`min()\`, \`max()\`, \`summaryStatistics()\`.

As an interview heuristic: if you see \`stream().mapToInt().sum()\` in a code review,
that is the correct idiom — \`stream().reduce(0, Integer::sum)\` works but boxes
unnecessarily.`,
    },
    {
      id: 'stream-pitfalls',
      heading: 'Three pitfalls: consumed streams, peek side effects & naked Optional.get',
      body: `**1. Reusing a consumed stream throws \`IllegalStateException\`**

~~~java
Stream<String> s = List.of("a", "b").stream();
long count = s.count();        // terminal — stream is now closed
s.forEach(System.out::println); // IllegalStateException: stream has already been operated upon
~~~

Fix: store the \`List\` (the source), not the \`Stream\`, and call \`.stream()\` again.

**2. \`peek\` is for debugging, not logic**

\`peek\` is defined as a *no-op* with respect to the stream's result. A short-circuit
terminal may skip it entirely:

~~~java
List<String> seen = new ArrayList<>();
Optional<String> first = Stream.of("x", "y", "z")
    .peek(seen::add)         // only the first element is peeked; y/z are skipped
    .filter(s -> !s.isEmpty())
    .findFirst();            // stops after the first match

// seen may contain only ["x"] — do NOT rely on peek for accumulation
~~~

**3. \`Optional.get()\` without a guard throws \`NoSuchElementException\`**

~~~java
Optional<Integer> opt = Stream.<Integer>empty().findFirst();
int value = opt.get();   // NoSuchElementException — empty Optional

// Always prefer the safe accessors:
int safe1 = opt.orElse(0);
int safe2 = opt.orElseGet(() -> computeDefault());
int safe3 = opt.orElseThrow(() -> new IllegalStateException("no value"));
opt.ifPresent(v -> System.out.println("got: " + v));

// Optional.map chains inside the Optional without unwrapping prematurely:
Optional<String> label = opt.map(v -> "Value=" + v);
~~~

These three come up disproportionately often in code reviews — pattern-match for them
automatically.`,
    },
    {
      id: 'groupingby-downstream',
      heading: 'groupingBy with downstream collectors — the workhorse of data aggregation',
      body: `\`Collectors.groupingBy(classifier)\` produces a \`Map<K, List<V>>\`. The two-argument
overload adds a **downstream collector** that reduces each group's \`List\` into
something more useful:

~~~java
record Employee(String name, String dept, int salary) {}

List<Employee> staff = List.of(
    new Employee("Ana",   "Eng",  95_000),
    new Employee("Bob",   "Eng",  88_000),
    new Employee("Cara",  "HR",   72_000),
    new Employee("Dirk",  "HR",   75_000),
    new Employee("Eva",   "Eng", 102_000)
);

// count per department
Map<String, Long> headcount = staff.stream()
    .collect(Collectors.groupingBy(Employee::dept, Collectors.counting()));
// {Eng=3, HR=2}

// average salary per department
Map<String, Double> avgSalary = staff.stream()
    .collect(Collectors.groupingBy(
        Employee::dept,
        Collectors.averagingInt(Employee::salary)));
// {Eng=95000.0, HR=73500.0}

// names per department (mapping + toList downstream)
Map<String, List<String>> namesByDept = staff.stream()
    .collect(Collectors.groupingBy(
        Employee::dept,
        Collectors.mapping(Employee::name, Collectors.toList())));
// {Eng=[Ana, Bob, Eva], HR=[Cara, Dirk]}

// summarising (count + sum + min + max + avg in one pass)
Map<String, IntSummaryStatistics> stats = staff.stream()
    .collect(Collectors.groupingBy(
        Employee::dept,
        Collectors.summarizingInt(Employee::salary)));
~~~

Downstream collectors **compose**: you can nest \`groupingBy\` inside \`groupingBy\` for
multi-level partitioning, or wrap a \`mapping\` inside a \`toSet\` to deduplicate.`,
    },
    {
      id: 'flatmap-and-reduce',
      heading: 'flatMap for nested structures and reduce vs collect',
      body: `\`flatMap\` converts each element to a \`Stream\` and **concatenates** all those streams
into one. Use it when your source contains collections of collections:

~~~java
record Order(String id, List<String> items) {}

List<Order> orders = List.of(
    new Order("O1", List.of("apple", "banana")),
    new Order("O2", List.of("cherry", "apple")),
    new Order("O3", List.of("banana", "date"))
);

// All unique items across all orders, sorted
List<String> uniqueItems = orders.stream()
    .flatMap(o -> o.items().stream())   // Stream<Order> -> Stream<String>
    .distinct()
    .sorted()
    .collect(Collectors.toList());
// [apple, banana, cherry, date]
~~~

**\`reduce\` vs \`collect\`** — both are terminals, but they serve different purposes:

- \`reduce\` is for **immutable combination**: producing a single scalar (sum, product,
  max) from elements. It is inherently safe for parallel streams because it requires an
  associative identity.
- \`collect\` is for **mutable accumulation**: building a collection or map. It uses a
  supplier (create container), accumulator (add one element), and combiner (merge two
  containers for parallel splits).

~~~java
// reduce — produces a new Integer each iteration (immutable)
int product = IntStream.rangeClosed(1, 5).reduce(1, (a, b) -> a * b);  // 120

// collect — mutably builds a List (efficient)
List<Integer> evens = IntStream.rangeClosed(1, 10)
    .filter(n -> n % 2 == 0)
    .boxed()
    .collect(Collectors.toList());
~~~

Using \`reduce\` to build a list is technically possible but quadratic due to repeated
\`List\` copying — always use \`collect\` for container accumulation.`,
    },
    {
      id: 'teeing-and-custom-collector',
      heading: 'Collectors.teeing and writing a custom Collector',
      body: `\`Collectors.teeing\` (JDK 12+) fans a single stream into **two collectors**
simultaneously and merges their results — a single pass instead of two:

~~~java
import java.util.stream.Collectors;

record Stats(long count, double average) {}

// Compute count AND average in one pass over the stream
Stats result = IntStream.of(10, 20, 30, 40, 50)
    .boxed()
    .collect(Collectors.teeing(
        Collectors.counting(),
        Collectors.averagingInt(Integer::intValue),
        (count, avg) -> new Stats(count, avg)
    ));
// Stats[count=5, average=30.0]
~~~

For custom aggregation that no built-in collector covers, implement
\`java.util.stream.Collector<T, A, R>\`:

~~~java
// A Collector that joins strings but truncates at maxLen characters.
static Collector<String, StringBuilder, String> truncatingJoin(int maxLen, String sep) {
    return Collector.of(
        StringBuilder::new,                     // supplier
        (sb, s) -> {                            // accumulator
            if (sb.length() + s.length() + sep.length() <= maxLen) {
                if (!sb.isEmpty()) sb.append(sep);
                sb.append(s);
            }
        },
        (a, b) -> a.append(sep).append(b),     // combiner (for parallel)
        StringBuilder::toString                 // finisher
    );
}

String out = Stream.of("alpha", "beta", "gamma", "delta")
    .collect(truncatingJoin(14, ", "));
// "alpha, beta"  (stops before "gamma" would overflow 14 chars)
~~~

The four-function signature of \`Collector.of\` maps directly to the lifecycle:
supplier allocates the mutable container, accumulator folds one element in,
combiner merges two containers for parallel splits, finisher converts the container
to the result type.`,
    },
  ],
  exercises: [
    {
      id: 'stream-pitfalls-predict',
      title: 'Predict the output — stream gotchas',
      difficulty: 'warmup',
      prompt: `For each snippet, predict what happens (output, exception, or silent misbehavior)
**before running it**. Write your answer as a comment, then verify.

~~~java
// Snippet A
Stream<String> s = Stream.of("one", "two", "three");
long n = s.count();
s.forEach(System.out::println);

// Snippet B
List<String> collected = new ArrayList<>();
long found = Stream.of("a", "b", "c", "d")
    .peek(collected::add)
    .filter(x -> x.compareTo("b") >= 0)
    .findFirst()
    .map(x -> 1L).orElse(0L);
System.out.println(collected.size());

// Snippet C
Optional<Integer> empty = Optional.empty();
int value = empty.get();
System.out.println(value);

// Snippet D
int sum = Stream.of(1, 2, 3, 4, 5)
    .mapToInt(Integer::intValue)
    .sum();
System.out.println(sum);

// Snippet E  — boxed stream sum trap
long total = 0L;
Stream.of(1, 2, 3)
    .reduce(0, (a, b) -> a + b);   // assigned to nothing
System.out.println(total);
~~~`,
      starter: `import java.util.*;
import java.util.stream.*;

public class StreamPitfalls {
    public static void main(String[] args) {

        // Snippet A — predict: ________________
        try {
            Stream<String> s = Stream.of("one", "two", "three");
            long n = s.count();
            s.forEach(System.out::println);
        } catch (Exception e) {
            System.out.println("A threw: " + e.getClass().getSimpleName());
        }

        // Snippet B — predict: collected.size() == ________________
        List<String> collected = new ArrayList<>();
        long found = Stream.of("a", "b", "c", "d")
            .peek(collected::add)
            .filter(x -> x.compareTo("b") >= 0)
            .findFirst()
            .map(x -> 1L).orElse(0L);
        System.out.println("B collected.size() = " + collected.size());

        // Snippet C — predict: ________________
        try {
            Optional<Integer> empty = Optional.empty();
            int value = empty.get();
            System.out.println("C value = " + value);
        } catch (Exception e) {
            System.out.println("C threw: " + e.getClass().getSimpleName());
        }

        // Snippet D — predict: ________________
        int sum = Stream.of(1, 2, 3, 4, 5)
            .mapToInt(Integer::intValue)
            .sum();
        System.out.println("D sum = " + sum);

        // Snippet E — predict: ________________
        long total = 0L;
        Stream.of(1, 2, 3).reduce(0, (a, b) -> a + b); // result discarded
        System.out.println("E total = " + total);
    }
}`,
      hints: [
        'A: a stream\'s terminal operation closes it — calling a second terminal on the same stream object throws IllegalStateException.',
        'B: findFirst is a short-circuit terminal. Peek only runs for elements that reach it before the pipeline stops. Consider which elements get pulled through before findFirst returns.',
        'E: reduce returns a value — it does not mutate the variable named total. The result is silently discarded and total remains 0.',
      ],
      solution: `import java.util.*;
import java.util.stream.*;

public class StreamPitfalls {
    public static void main(String[] args) {

        // A: IllegalStateException — stream already consumed by count()
        try {
            Stream<String> s = Stream.of("one", "two", "three");
            long n = s.count();
            s.forEach(System.out::println);
        } catch (Exception e) {
            System.out.println("A threw: " + e.getClass().getSimpleName());
            // prints: A threw: IllegalStateException
        }

        // B: collected.size() == 2 (elements "a" and "b" are peeked before findFirst returns)
        List<String> collected = new ArrayList<>();
        long found = Stream.of("a", "b", "c", "d")
            .peek(collected::add)
            .filter(x -> x.compareTo("b") >= 0)
            .findFirst()
            .map(x -> 1L).orElse(0L);
        System.out.println("B collected.size() = " + collected.size());
        // prints: B collected.size() = 2  ("a" fails filter, "b" passes -> findFirst returns)

        // C: NoSuchElementException — get() on an empty Optional
        try {
            Optional<Integer> empty = Optional.empty();
            int value = empty.get();
            System.out.println("C value = " + value);
        } catch (Exception e) {
            System.out.println("C threw: " + e.getClass().getSimpleName());
            // prints: C threw: NoSuchElementException
        }

        // D: 15 — mapToInt avoids boxing, sum() is clean
        int sum = Stream.of(1, 2, 3, 4, 5)
            .mapToInt(Integer::intValue)
            .sum();
        System.out.println("D sum = " + sum);   // D sum = 15

        // E: 0 — reduce returns a new value; the variable total is never updated
        long total = 0L;
        Stream.of(1, 2, 3).reduce(0, (a, b) -> a + b);
        System.out.println("E total = " + total);   // E total = 0
    }
}`,
      explanation: `**A** exposes the once-only contract: after \`count()\` the stream is closed; a second
terminal throws \`IllegalStateException\`. Store the source (\`List\`), never the \`Stream\`.

**B** is the canonical \`peek\` gotcha. The pipeline pulls elements one at a time through
filter until \`findFirst\` gets a match. \`"a"\` is peeked and fails the filter;
\`"b"\` is peeked and passes, so \`findFirst\` returns immediately — \`"c"\` and \`"d"\` are
never touched. \`collected.size()\` is 2, not 4.

**C** is the most common \`Optional\` error: \`get()\` on an empty \`Optional\` throws
\`NoSuchElementException\` (not \`NullPointerException\`). Use \`orElse\`, \`orElseGet\`,
\`ifPresent\`, or \`orElseThrow\`.

**D** is the correct idiom: \`Stream.of(Integer...)\` followed by \`mapToInt\` and \`sum()\`
avoids boxing intermediate results.

**E** is a pure assignment bug: \`reduce\` is pure and returns its result. Not assigning
the return value silently discards it. \`total\` stays 0 forever.`,
    },
    {
      id: 'department-analytics',
      title: 'Department analytics with groupingBy and downstream collectors',
      difficulty: 'core',
      prompt: `You are given a list of \`Employee\` records. Complete **three independent analytics
queries**, each in a single \`collect\` call:

**Query 1 — headcount per department:**
Produce a \`Map<String, Long>\` of department -> employee count.
Print it sorted alphabetically by department name.

**Query 2 — top earner per department:**
Produce a \`Map<String, Optional<Employee>>\` of department -> highest-paid employee.
Use a downstream \`Collectors.maxBy\` with a \`Comparator\` on salary.
Print each department's top earner name and salary.

**Query 3 — salary band summary:**
Use \`Collectors.teeing\` to compute, in **one pass**, the total payroll (sum of all
salaries) and the average salary across the whole company.
Print both values.

~~~java
record Employee(String name, String dept, int salary) {}

List<Employee> staff = List.of(
    new Employee("Ana",   "Engineering",  95_000),
    new Employee("Bob",   "Engineering",  88_000),
    new Employee("Cara",  "HR",           72_000),
    new Employee("Dirk",  "HR",           75_000),
    new Employee("Eva",   "Engineering", 102_000),
    new Employee("Frank", "Finance",      91_000),
    new Employee("Gina",  "Finance",      84_000)
);
~~~

Expected output (exact salary figures):

~~~text
Engineering: 3
Finance: 2
HR: 2
Engineering top earner: Eva (102000)
Finance top earner: Frank (91000)
HR top earner: Dirk (75000)
Total payroll: 607000
Average salary: 86714.29
~~~`,
      starter: `import java.util.*;
import java.util.stream.*;

public class DepartmentAnalytics {

    record Employee(String name, String dept, int salary) {}

    record PayrollSummary(long total, double average) {}

    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Employee("Ana",   "Engineering",  95_000),
            new Employee("Bob",   "Engineering",  88_000),
            new Employee("Cara",  "HR",           72_000),
            new Employee("Dirk",  "HR",           75_000),
            new Employee("Eva",   "Engineering", 102_000),
            new Employee("Frank", "Finance",      91_000),
            new Employee("Gina",  "Finance",      84_000)
        );

        // Query 1: headcount per department, sorted by dept name
        Map<String, Long> headcount = staff.stream()
            .collect(/* TODO: groupingBy dept, counting downstream */
                Collectors.counting()); // placeholder — fix this

        headcount.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(e -> System.out.println(e.getKey() + ": " + e.getValue()));

        // Query 2: top earner per department
        Map<String, Optional<Employee>> topEarner = staff.stream()
            .collect(/* TODO: groupingBy dept, maxBy salary downstream */
                Collectors.counting()); // placeholder — fix this

        topEarner.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(e -> e.getValue().ifPresent(emp ->
                System.out.println(e.getKey() + " top earner: "
                    + emp.name() + " (" + emp.salary() + ")")));

        // Query 3: total payroll and average in one pass via teeing
        PayrollSummary summary = staff.stream()
            .collect(Collectors.teeing(
                /* TODO: downstream 1 — sum of salaries (hint: summingLong) */,
                /* TODO: downstream 2 — averagingInt on salary */,
                /* TODO: merge function -> new PayrollSummary(...) */
                (a, b) -> new PayrollSummary(0, 0.0)  // placeholder
            ));

        System.out.println("Total payroll: " + summary.total());
        System.out.printf("Average salary: %.2f%n", summary.average());
    }
}`,
      hints: [
        'Query 1: Collectors.groupingBy(Employee::dept, Collectors.counting()). Then stream the entry set, sorted with Map.Entry.comparingByKey(), forEach to print.',
        'Query 2: Collectors.groupingBy(Employee::dept, Collectors.maxBy(Comparator.comparingInt(Employee::salary))). The value type is Optional<Employee> because a group could theoretically be empty.',
        'Query 3: the first downstream is Collectors.summingLong(Employee::salary), the second is Collectors.averagingInt(Employee::salary), and the merge function is (total, avg) -> new PayrollSummary(total, avg).',
      ],
      solution: `import java.util.*;
import java.util.stream.*;

public class DepartmentAnalytics {

    record Employee(String name, String dept, int salary) {}

    record PayrollSummary(long total, double average) {}

    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Employee("Ana",   "Engineering",  95_000),
            new Employee("Bob",   "Engineering",  88_000),
            new Employee("Cara",  "HR",           72_000),
            new Employee("Dirk",  "HR",           75_000),
            new Employee("Eva",   "Engineering", 102_000),
            new Employee("Frank", "Finance",      91_000),
            new Employee("Gina",  "Finance",      84_000)
        );

        // Query 1: headcount per department
        Map<String, Long> headcount = staff.stream()
            .collect(Collectors.groupingBy(Employee::dept, Collectors.counting()));

        headcount.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(e -> System.out.println(e.getKey() + ": " + e.getValue()));

        // Query 2: top earner per department
        Map<String, Optional<Employee>> topEarner = staff.stream()
            .collect(Collectors.groupingBy(
                Employee::dept,
                Collectors.maxBy(Comparator.comparingInt(Employee::salary))));

        topEarner.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(e -> e.getValue().ifPresent(emp ->
                System.out.println(e.getKey() + " top earner: "
                    + emp.name() + " (" + emp.salary() + ")")));

        // Query 3: total payroll and average in one teeing pass
        PayrollSummary summary = staff.stream()
            .collect(Collectors.teeing(
                Collectors.summingLong(Employee::salary),
                Collectors.averagingInt(Employee::salary),
                PayrollSummary::new
            ));

        System.out.println("Total payroll: " + summary.total());
        System.out.printf("Average salary: %.2f%n", summary.average());
    }
}`,
      explanation: `**Query 1** is the baseline \`groupingBy + counting\` idiom. The outer collector
partitions by department; the downstream \`counting()\` collapses each group's list to a
\`Long\`. Sorting the \`entrySet\` stream with \`Map.Entry.comparingByKey()\` is the idiomatic
way to print a \`Map\` in key order.

**Query 2** uses \`Collectors.maxBy\` as the downstream, wrapping a
\`Comparator.comparingInt\` on salary. The result type is \`Optional<Employee>\` because the
\`Collector\` contract allows for empty groups — \`ifPresent\` is the safe unwrap.

**Query 3** shows \`Collectors.teeing\`: the stream is fanned into two independent
collectors simultaneously. Both collectors see every element, and the merge function
combines their results into a single object. This is strictly more efficient than two
separate stream passes because the source is read only once. The constructor reference
\`PayrollSummary::new\` works as the merge function because the record constructor matches
the \`BiFunction<Long, Double, PayrollSummary>\` signature.`,
    },
    {
      id: 'order-flatmap-pipeline',
      title: 'Order line-item pipeline with flatMap and groupingBy',
      difficulty: 'core',
      prompt: `You are modelling a simplified e-commerce order system. Complete the three tasks below.

~~~java
record LineItem(String sku, String category, int quantity, double unitPrice) {
    double total() { return quantity * unitPrice; }
}
record Order(String orderId, String customerId, List<LineItem> items) {}
~~~

**Task A — revenue by category:**
Flatten all orders into line items, then group by \`category\` and sum the
\`total()\` for each group. Produce a \`Map<String, Double>\` and print it sorted by
revenue descending.

**Task B — top SKU by revenue:**
From the same orders, find the single SKU with the highest combined revenue across all
orders (a SKU can appear in multiple orders). Return the SKU as a \`String\` or
\`"(none)"\` if the list is empty.

**Task C — customers with mixed categories:**
Find all customer IDs who have ordered items in **more than one distinct category**.
Return them as a sorted \`List<String>\`.

Use the data provided in the starter. Print all results.`,
      starter: `import java.util.*;
import java.util.stream.*;

public class OrderPipeline {

    record LineItem(String sku, String category, int quantity, double unitPrice) {
        double total() { return quantity * unitPrice; }
    }

    record Order(String orderId, String customerId, List<LineItem> items) {}

    public static void main(String[] args) {
        List<Order> orders = List.of(
            new Order("O1", "C1", List.of(
                new LineItem("SKU-A", "Electronics", 2, 299.99),
                new LineItem("SKU-B", "Books",        3,  14.99)
            )),
            new Order("O2", "C2", List.of(
                new LineItem("SKU-A", "Electronics", 1, 299.99),
                new LineItem("SKU-C", "Electronics", 4,  49.99)
            )),
            new Order("O3", "C1", List.of(
                new LineItem("SKU-D", "Books",        2,  24.99),
                new LineItem("SKU-E", "Clothing",     1,  89.99)
            )),
            new Order("O4", "C3", List.of(
                new LineItem("SKU-B", "Books",        5,  14.99),
                new LineItem("SKU-C", "Electronics",  2,  49.99)
            ))
        );

        // Task A: revenue by category, sorted by revenue descending
        Map<String, Double> revenueByCategory = orders.stream()
            // TODO: flatMap orders to line items, groupingBy category, summingDouble total()
            .collect(Collectors.counting()); // placeholder

        revenueByCategory.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .forEach(e -> System.out.printf("%s: %.2f%n", e.getKey(), e.getValue()));

        // Task B: SKU with highest combined revenue
        String topSku = orders.stream()
            // TODO: flatMap, groupingBy sku, summingDouble, entrySet stream, max by value, map to key, orElse "(none)"
            .findAny().orElse("(none)"); // placeholder

        System.out.println("Top SKU: " + topSku);

        // Task C: customers with items in more than one distinct category
        List<String> mixedCustomers = orders.stream()
            // TODO: group orders by customerId, collect categories per customer, filter > 1 distinct, sorted
            .collect(Collectors.toList()); // placeholder

        System.out.println("Mixed-category customers: " + mixedCustomers);
    }
}`,
      hints: [
        'Task A: orders.stream().flatMap(o -> o.items().stream()) gives you Stream<LineItem>. Then .collect(Collectors.groupingBy(LineItem::category, Collectors.summingDouble(LineItem::total))).',
        'Task B: after grouping SKUs by revenue, stream the entry set, find the max entry with max(Map.Entry.comparingByValue()), then .map(Map.Entry::getKey).orElse("(none)").',
        'Task C: group orders by customerId using Collectors.groupingBy(Order::customerId). The downstream should collect all distinct categories: Collectors.mapping then Collectors.toSet on flatMapped items. Then stream the resulting map, filter where the set size > 1, map to the key, sort, collect.',
      ],
      solution: `import java.util.*;
import java.util.stream.*;

public class OrderPipeline {

    record LineItem(String sku, String category, int quantity, double unitPrice) {
        double total() { return quantity * unitPrice; }
    }

    record Order(String orderId, String customerId, List<LineItem> items) {}

    public static void main(String[] args) {
        List<Order> orders = List.of(
            new Order("O1", "C1", List.of(
                new LineItem("SKU-A", "Electronics", 2, 299.99),
                new LineItem("SKU-B", "Books",        3,  14.99)
            )),
            new Order("O2", "C2", List.of(
                new LineItem("SKU-A", "Electronics", 1, 299.99),
                new LineItem("SKU-C", "Electronics", 4,  49.99)
            )),
            new Order("O3", "C1", List.of(
                new LineItem("SKU-D", "Books",        2,  24.99),
                new LineItem("SKU-E", "Clothing",     1,  89.99)
            )),
            new Order("O4", "C3", List.of(
                new LineItem("SKU-B", "Books",        5,  14.99),
                new LineItem("SKU-C", "Electronics",  2,  49.99)
            ))
        );

        // Task A: revenue by category
        Map<String, Double> revenueByCategory = orders.stream()
            .flatMap(o -> o.items().stream())
            .collect(Collectors.groupingBy(
                LineItem::category,
                Collectors.summingDouble(LineItem::total)));

        revenueByCategory.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .forEach(e -> System.out.printf("%s: %.2f%n", e.getKey(), e.getValue()));
        // Electronics: 1099.93
        // Books: 169.88
        // Clothing: 89.99

        // Task B: top SKU by combined revenue
        Map<String, Double> revenueBySku = orders.stream()
            .flatMap(o -> o.items().stream())
            .collect(Collectors.groupingBy(
                LineItem::sku,
                Collectors.summingDouble(LineItem::total)));

        String topSku = revenueBySku.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("(none)");

        System.out.println("Top SKU: " + topSku);   // Top SKU: SKU-A

        // Task C: customers with items in more than one distinct category
        Map<String, Set<String>> categoryPerCustomer = orders.stream()
            .collect(Collectors.groupingBy(
                Order::customerId,
                Collectors.flatMapping(
                    o -> o.items().stream().map(LineItem::category),
                    Collectors.toSet())));

        List<String> mixedCustomers = categoryPerCustomer.entrySet().stream()
            .filter(e -> e.getValue().size() > 1)
            .map(Map.Entry::getKey)
            .sorted()
            .collect(Collectors.toList());

        System.out.println("Mixed-category customers: " + mixedCustomers);
        // Mixed-category customers: [C1, C3]
    }
}`,
      explanation: `**Task A** is the core \`flatMap + groupingBy + summingDouble\` pattern. \`flatMap\`
converts \`Stream<Order>\` to \`Stream<LineItem>\` by expanding each order's list; the
collector then groups and sums in one terminal call. Sorting the entry set descending
requires the generic witness \`Map.Entry.<String, Double>comparingByValue()\` so the
compiler knows the value type for \`reversed()\`.

**Task B** reuses the same flattening but finishes with \`max(Map.Entry.comparingByValue())\`
on the entry set. This returns \`Optional<Entry>\`, which is then mapped to the key with
\`map(Map.Entry::getKey)\`. The \`orElse\` handles the empty-list case without any null check.

**Task C** uses \`Collectors.flatMapping\` (JDK 9+) as a downstream collector: for each
customer's group of orders, it flatMaps each order's items to their categories and collects
to a \`Set\` (automatic deduplication). Filtering where \`set.size() > 1\` then identifies
customers who crossed category boundaries. This avoids two separate passes and requires no
explicit intermediate variable.`,
    },
    {
      id: 'custom-collector',
      title: 'Word-frequency index with a custom Collector',
      difficulty: 'challenge',
      prompt: `Implement two things:

**Part 1 — \`topWords\` pipeline:**
Write \`static List<String> topWords(String text, int n)\` that:
1. Splits \`text\` on \`[^a-zA-Z]+\` and lowercases each token.
2. Counts word frequencies with \`groupingBy + counting\`.
3. Returns the top \`n\` words sorted by frequency **descending**, ties broken
   **alphabetically ascending**, formatted as \`"word:count"\`.
4. Returns an empty list if \`text\` is blank or \`n <= 0\`.

**Part 2 — custom \`Collector\`:**
Implement \`static Collector<String, ?, Map<Character, String>> indexCollector()\`
using \`Collector.of\`. It must collect a stream of words into a
\`Map<Character, String>\` where each key is the first letter and the value is the
alphabetically first word starting with that letter (the "lexicographic
representative").

Example: given \`["banana", "apple", "avocado", "cherry", "apricot"]\` the collector
should produce \`{a=apple, b=banana, c=cherry}\`.

Test both with:

~~~java
String sample = "to be or not to be that is the question " +
                "whether tis nobler in the mind to suffer " +
                "the slings and arrows of outrageous fortune";

System.out.println(topWords(sample, 5));
// [the:3, to:3, be:2, and:1, arrows:1]

List<String> vocab = List.of("banana", "apple", "avocado", "cherry", "apricot");
Map<Character, String> index = vocab.stream().collect(indexCollector());
System.out.println(new TreeMap<>(index));
// {a=apple, b=banana, c=cherry}
~~~`,
      starter: `import java.util.*;
import java.util.stream.*;
import java.util.function.*;

public class WordIndex {

    static List<String> topWords(String text, int n) {
        // Guard
        if (text == null || text.isBlank() || n <= 0) return Collections.emptyList();

        // 1. Split on non-letters, lowercase
        // 2. Collect into Map<String, Long> via groupingBy + counting
        // 3. Stream entry set, sort by value desc then key asc, limit n, format "word:count"
        return List.of(); // replace
    }

    static Collector<String, ?, Map<Character, String>> indexCollector() {
        // Collector.of(supplier, accumulator, combiner, finisher)
        //
        // The mutable accumulation type A can be Map<Character, List<String>>
        // or Map<Character, String> (if you apply min() during accumulation).
        //
        // Supplier:     () -> new HashMap<Character, List<String>>()
        // Accumulator:  (map, word) -> map.computeIfAbsent(word.charAt(0), k -> new ArrayList<>()).add(word)
        // Combiner:     (m1, m2) -> { m2.forEach((k, v) -> m1.merge(k, v, ...)); return m1; }
        // Finisher:     map -> map.entrySet().stream()...collect(toMap(key, min-value))
        return null; // replace
    }

    public static void main(String[] args) {
        String sample = "to be or not to be that is the question " +
                        "whether tis nobler in the mind to suffer " +
                        "the slings and arrows of outrageous fortune";

        System.out.println(topWords(sample, 5));

        List<String> vocab = List.of("banana", "apple", "avocado", "cherry", "apricot");
        Map<Character, String> index = vocab.stream().collect(indexCollector());
        System.out.println(new TreeMap<>(index));
    }
}`,
      hints: [
        'topWords: Arrays.stream(text.split("[^a-zA-Z]+")).map(String::toLowerCase).filter(w -> !w.isBlank()). Collect into Map<String, Long> with groupingBy(w -> w, counting()). Sort entry set with Map.Entry.<String,Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()). Then limit(n) and map(e -> e.getKey() + ":" + e.getValue()).',
        'indexCollector accumulator stage: use computeIfAbsent to group words by first char into a List, just like groupingBy does internally. The finisher then reduces each list to its minimum string via Collections.min or a stream min.',
        'Combiner for parallel safety: merge the two maps by concatenating their lists for matching keys. Use m1.merge(k, v, (l1, l2) -> { l1.addAll(l2); return l1; }) inside a forEach, then return m1.',
      ],
      solution: `import java.util.*;
import java.util.stream.*;
import java.util.function.*;

public class WordIndex {

    static List<String> topWords(String text, int n) {
        if (text == null || text.isBlank() || n <= 0) return Collections.emptyList();

        Map<String, Long> freq = Arrays.stream(text.split("[^a-zA-Z]+"))
            .map(String::toLowerCase)
            .filter(w -> !w.isBlank())
            .collect(Collectors.groupingBy(w -> w, Collectors.counting()));

        return freq.entrySet().stream()
            .sorted(
                Map.Entry.<String, Long>comparingByValue().reversed()
                    .thenComparing(Map.Entry.comparingByKey()))
            .limit(n)
            .map(e -> e.getKey() + ":" + e.getValue())
            .collect(Collectors.toList());
    }

    static Collector<String, ?, Map<Character, String>> indexCollector() {
        return Collector.of(
            // Supplier: mutable accumulation container
            () -> new HashMap<Character, List<String>>(),

            // Accumulator: add word to its initial-letter bucket
            (map, word) -> {
                if (word == null || word.isEmpty()) return;
                map.computeIfAbsent(word.charAt(0), k -> new ArrayList<>()).add(word);
            },

            // Combiner: merge two partial maps (required for parallel correctness)
            (m1, m2) -> {
                m2.forEach((k, v) ->
                    m1.merge(k, v, (l1, l2) -> { l1.addAll(l2); return l1; }));
                return m1;
            },

            // Finisher: reduce each bucket to the lex-minimum word
            map -> map.entrySet().stream()
                .collect(Collectors.toMap(
                    Map.Entry::getKey,
                    e -> Collections.min(e.getValue())
                ))
        );
    }

    public static void main(String[] args) {
        String sample = "to be or not to be that is the question " +
                        "whether tis nobler in the mind to suffer " +
                        "the slings and arrows of outrageous fortune";

        System.out.println(topWords(sample, 5));
        // [the:3, to:3, be:2, and:1, arrows:1]

        List<String> vocab = List.of("banana", "apple", "avocado", "cherry", "apricot");
        Map<Character, String> index = vocab.stream().collect(indexCollector());
        System.out.println(new TreeMap<>(index));
        // {a=apple, b=banana, c=cherry}
    }
}`,
      explanation: `**\`topWords\`** chains every standard stream idiom: regex split, \`map\` to normalise,
\`filter\` to remove empties, \`groupingBy + counting\` for the frequency map, and a compound
\`Comparator\` on the entry set for the sort. The generic witness
\`Map.Entry.<String,Long>comparingByValue()\` is necessary because \`reversed()\` erases the
type without it. \`limit(n)\` is placed after the sort — sorting before limiting is correct
here because we need a global rank, not just a local one.

**\`indexCollector\`** demonstrates the four-function \`Collector.of\` lifecycle in full:

1. **Supplier** allocates the mutable container (\`HashMap<Character, List<String>>\`).
2. **Accumulator** uses \`computeIfAbsent\` to lazily create each bucket and append the word
   — identical to what \`groupingBy(w -> w.charAt(0))\` does internally.
3. **Combiner** is required for correctness under parallel execution: it merges the two
   partial maps by concatenating their lists with \`Map.merge\`.
4. **Finisher** converts the intermediate \`Map<Character, List<String>>\` into the final
   \`Map<Character, String>\` by reducing each list to its lexicographic minimum with
   \`Collections.min\`.

The key insight is that the accumulation type \`A\` (\`Map<Character, List<String>>\`) is
deliberately different from the result type \`R\` (\`Map<Character, String>\`) — that is
exactly why the finisher exists as a separate step.`,
    },
  ],
  takeaways: [
    'Streams are **lazy descriptions of computation**, not data containers — intermediate ops are fused into a single pass by the JVM and execute only when a terminal is called.',
    'A stream is **consumed after its first terminal** — always store the source collection, not the \`Stream\` object itself.',
    '\`Stream<Integer>\` boxes every element; prefer \`IntStream\`/\`LongStream\`/\`DoubleStream\` for numeric work and use \`mapToInt(...).sum()\` over \`reduce(0, Integer::sum)\`.',
    'Use \`peek\` only for **debugging observation**, never to accumulate results — short-circuit terminals may skip it for elements they never pull through.',
    'Always unwrap \`Optional\` with \`orElse\`, \`orElseGet\`, \`ifPresent\`, or \`map\` — naked \`get()\` is a latent \`NoSuchElementException\` waiting to happen.',
    '\`Collectors.groupingBy\` with a **downstream collector** (\`counting\`, \`summingInt\`, \`maxBy\`, \`mapping\`, \`toSet\`) replaces nested loops and temporary maps in a single readable expression.',
    'A custom \`Collector\` has four stages: supplier (create container), accumulator (fold one element in), combiner (merge two containers for parallel safety), finisher (convert to result) — master these to cover any aggregation \`Collectors\` does not provide off the shelf.',
  ],
}
