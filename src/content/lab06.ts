import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers who already know Java basics. Theory is a sharp
// refresher focused on nuance, gotchas, idioms and interview depth. Exercises
// are non-trivial.

export const lab06: Lab = {
  id: 'lab-06',
  number: 6,
  title: 'Collections, Special Data Types & Utilities',
  subtitle: 'Internals, iteration hazards, ordering, Big-O, and classic interview patterns',
  estimatedHours: 6,
  concepts: [
    'List',
    'Set',
    'Map',
    'HashMap internals',
    'LinkedHashMap',
    'TreeMap',
    'PriorityQueue',
    'Comparable',
    'Comparator',
    'ConcurrentModificationException',
    'Big-O',
    'LRU cache',
  ],
  overview: `You already know \`ArrayList\`, \`HashMap\`, and \`for-each\`. This lab goes deeper: **why**
HashMap is O(1), what happens when you mutate a collection while iterating it, how
\`LinkedHashMap\` powers an LRU cache in twelve lines, and how to squeeze a top-K query
down from O(n log n) to O(n log k).

The exercises are deliberately interview-shaped. Every one maps to a pattern that appears
on coding screens for mid-level positions: spotting a silent invariant violation,
building a bounded cache, finding the K most frequent elements efficiently, and composing
multi-key sorts that handle \`null\` values without crashing.`,
  theory: [
    {
      id: 'hashmap-internals',
      heading: 'HashMap internals: hash, bucket, load factor & rehash',
      body: `A \`HashMap<K,V>\` is backed by an array of **buckets**. On \`put(k,v)\`:

1. \`k.hashCode()\` is computed and **spread** (XOR-shifted) to give a bucket index.
2. If the bucket is empty, the entry goes straight in.
3. If the bucket already holds entries (a **hash collision**), they are stored as a
   linked list (and promoted to a balanced tree once the chain exceeds 8 entries — JDK 8+).

**Load factor** (default 0.75) controls when the array is rehashed (doubled). At 75 %
fullness the map allocates a new array twice the size and re-inserts every entry. This
is O(n) work but amortised O(1) per insertion.

~~~java
// Sizing hint avoids rehash when you know the final size
Map<String, Integer> freq = new HashMap<>(expectedSize * 2);
// Why *2? The load-factor threshold is 0.75, so capacity = n / 0.75 ≈ n * 1.34.
// Rounding up to the next power-of-two is safer; *2 is the practical approximation.
~~~

**The contract: if you override \`equals\`, you MUST override \`hashCode\`**, and vice
versa. The rule:

> Objects that are \`equals\` must have the same \`hashCode\`.
> Objects with the same \`hashCode\` need not be \`equals\` (collision is allowed).

Violating this means \`get\` will silently return \`null\` even though the key was inserted.

~~~java
// Classic bug: two logically-equal keys hash differently -> lookup fails
class Point {
    int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        if (!(o instanceof Point p)) return false;
        return x == p.x && y == p.y;
    }
    // MISSING hashCode override — JDK uses identity hash, so equal Points
    // end up in different buckets and get() always returns null!
}
~~~

**Using a mutable object as a key** is a related trap: if the key's fields change after
insertion its hash changes, and the entry is now in the wrong bucket — the map has
"swallowed" it.`,
    },
    {
      id: 'iteration-hazards',
      heading: 'Iteration hazards: ConcurrentModificationException & safe removal',
      body: `Every \`ArrayList\` and \`HashMap\` carries a \`modCount\` field incremented on every
structural change. The iterator snapshots this count and checks it on every \`next()\` call;
if it has changed, it throws \`ConcurrentModificationException\`. This is a **fail-fast**
mechanism, not thread safety.

~~~java
List<String> items = new ArrayList<>(List.of("a", "b", "c", "b"));

// WRONG — throws ConcurrentModificationException
for (String s : items) {
    if (s.equals("b")) items.remove(s);
}
~~~

Three safe patterns:

~~~java
// 1. Iterator.remove() — the only remove that bypasses the modCount check
Iterator<String> it = items.iterator();
while (it.hasNext()) {
    if (it.next().equals("b")) it.remove();   // safe: iterator owns the remove
}

// 2. removeIf (Java 8+) — clearest when the predicate is simple
items.removeIf("b"::equals);

// 3. Collect-then-remove — useful when removals are complex / multi-step
List<String> toRemove = new ArrayList<>();
for (String s : items) if (s.equals("b")) toRemove.add(s);
items.removeAll(toRemove);
~~~

**For maps**, the same rules apply. Prefer \`entrySet().removeIf\` or iterate a copy of
\`keySet()\`:

~~~java
Map<String, Integer> scores = new HashMap<>();
// ... populate ...
scores.entrySet().removeIf(e -> e.getValue() < 50);  // safe
~~~

The important nuance: \`ConcurrentModificationException\` is **not guaranteed** to fire
on every such bug — it's best-effort. Code that relies on "it didn't throw in testing"
has a latent race condition.`,
    },
    {
      id: 'linkedhashmap',
      heading: 'LinkedHashMap: insertion order, access order & LRU cache',
      body: `\`LinkedHashMap\` is a \`HashMap\` extended with a **doubly linked list** threading all
entries in either insertion order (default) or **access order** (\`accessOrder = true\`).

Access order means every \`get\` or \`put\` moves the accessed entry to the **tail** of the
list. The head is always the least-recently used entry.

The protected method \`removeEldestEntry\` is called after every insertion. Overriding it
to return \`true\` when size exceeds a limit turns the map into an **LRU cache**:

~~~java
int capacity = 3;
Map<Integer, String> lru = new LinkedHashMap<>(capacity, 0.75f, true) {
    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, String> eldest) {
        return size() > capacity;
    }
};

lru.put(1, "one");
lru.put(2, "two");
lru.put(3, "three");
lru.get(1);           // accesses key 1 → moves it to tail (most recent)
lru.put(4, "four");   // triggers removeEldestEntry: size becomes 4 > 3, so eldest (key 2) is evicted

System.out.println(lru.keySet());  // [3, 1, 4]  — key 2 was evicted
~~~

This is the **canonical LRU implementation** in Java interviews. O(1) get and put,
O(1) eviction.`,
    },
    {
      id: 'priority-queue',
      heading: 'PriorityQueue: min-heap and max-heap idioms',
      body: `\`PriorityQueue<E>\` is a **binary min-heap** backed by an array. \`poll()\` removes
and returns the smallest element in O(log n); \`peek()\` returns it in O(1).

~~~java
PriorityQueue<Integer> minHeap = new PriorityQueue<>();          // natural order
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());

minHeap.offer(5); minHeap.offer(1); minHeap.offer(3);
System.out.println(minHeap.poll());  // 1 — smallest
~~~

**The top-K pattern.** To find the K largest elements in a stream of n values without
sorting:

- Maintain a **min-heap of size K**.
- For each new element: if the heap has fewer than K elements, add it; otherwise if the
  new element is **larger** than the heap's minimum, replace the minimum.
- Result: the heap holds the K largest elements; iterate to collect.

~~~java
// Top-3 from a stream, O(n log k) time, O(k) space
int k = 3;
PriorityQueue<Integer> top = new PriorityQueue<>(k); // min-heap of k elements
for (int x : stream) {
    if (top.size() < k) {
        top.offer(x);
    } else if (x > top.peek()) {
        top.poll();
        top.offer(x);
    }
}
// top now holds the 3 largest; drain in ascending order via repeated poll()
~~~

**Sort-vs-heap trade-off.** Sorting n elements to find the K largest costs O(n log n)
and O(n) space. The heap approach costs O(n log k) and O(k) space. When K << n
(e.g. top-10 from a million records), the heap is substantially faster.`,
    },
    {
      id: 'comparator-advanced',
      heading: 'Comparator composition: thenComparing, reversed, nullsLast',
      body: `\`Comparator.comparing\` returns a comparator over a key extractor. The fluent API
lets you compose arbitrarily complex orderings without nested \`if\` chains.

~~~java
import java.util.Comparator;

record Employee(String dept, String name, Integer salary) {}

Comparator<Employee> order =
    Comparator.comparing(Employee::dept)                          // primary: dept A-Z
              .thenComparing(                                      // secondary: salary desc
                  Comparator.comparingInt(Employee::salary).reversed())
              .thenComparing(Employee::name);                     // tertiary: name A-Z
~~~

**\`nullsFirst\` / \`nullsLast\`** handle nullable fields without NPE:

~~~java
// Employees with null salary sort last, rest ascending
Comparator<Employee> bySalaryNullsLast =
    Comparator.comparing(Employee::salary,
                         Comparator.nullsLast(Comparator.naturalOrder()));
~~~

**Watch out when chaining \`reversed()\`:** it flips the *entire* comparator built so
far, not just the last key. To reverse only one key while keeping others forward:

~~~java
// WRONG: reverses both dept and salary
Comparator<Employee> wrong =
    Comparator.comparing(Employee::dept)
              .thenComparingInt(Employee::salary)
              .reversed();

// CORRECT: reverse salary independently, keep dept forward
Comparator<Employee> right =
    Comparator.comparing(Employee::dept)
              .thenComparing(
                  Comparator.comparingInt(Employee::salary).reversed());
~~~

The rule: call \`reversed()\` on the innermost comparator you want to flip before passing
it to \`thenComparing\`, not on the outer chain.`,
    },
    {
      id: 'set-variants',
      heading: 'Set internals and choosing the right variant',
      body: `All three standard \`Set\` implementations delegate to a corresponding \`Map\`
internally — they store the element as the key and a dummy singleton as the value.
Choosing the right one is a Big-O decision:

| Variant | Iteration order | \`contains\` / \`add\` / \`remove\` | Best for |
|---------|-----------------|--------------------------------------|----------|
| \`HashSet\` | undefined | O(1) avg | membership test, deduplication |
| \`LinkedHashSet\` | insertion | O(1) avg | dedup with order preserved |
| \`TreeSet\` | sorted (natural or Comparator) | O(log n) | sorted unique values, range queries |

\`TreeSet\` gives you extra navigation methods unavailable on the others:

~~~java
TreeSet<Integer> ts = new TreeSet<>(Set.of(1, 3, 5, 7, 9));
System.out.println(ts.floor(6));    // 5  — largest element <= 6
System.out.println(ts.ceiling(6));  // 7  — smallest element >= 6
System.out.println(ts.headSet(5));  // [1, 3]  — elements strictly < 5
System.out.println(ts.tailSet(5));  // [5, 7, 9]  — elements >= 5
System.out.println(ts.subSet(3, 8)); // [3, 5, 7]
~~~

These are O(log n) and invaluable for interval/range problems. \`TreeMap\` offers an
identical set of methods on keys (\`floorKey\`, \`ceilingKey\`, \`headMap\`, \`tailMap\`).

**A subtlety with \`TreeSet\` and \`Comparator\`:** TreeSet uses the comparator (or
\`compareTo\`) to determine both order and equality. If the comparator returns 0 for two
objects, the TreeSet treats them as duplicates and keeps only one — even if \`equals\`
would return \`false\`. Ensure your comparator is consistent with \`equals\` to avoid
silently losing elements.`,
    },
    {
      id: 'big-o-cheatsheet',
      heading: 'Big-O cheat sheet & collection decision guide',
      body: `| Operation | ArrayList | HashMap | LinkedHashMap | TreeMap | PriorityQueue |
|-----------|-----------|---------|---------------|---------|---------------|
| Random access (\`get(i)\`) | O(1) | — | — | — | — |
| Lookup by key/value | O(n) | O(1) avg | O(1) avg | O(log n) | O(n) |
| Insert at end | O(1) amort | O(1) avg | O(1) avg | O(log n) | O(log n) |
| Insert at index i | O(n) | — | — | — | — |
| Min/max | O(n) | — | — | O(log n) \`first/lastKey\` | O(1) \`peek\` |
| Evict smallest | O(n) | — | — | O(log n) | O(log n) \`poll\` |
| Sorted iteration | O(n log n) sort first | — | insertion order | O(n) in-order | — |

**Decision flowchart:**

~~~text
Key-value pairs?
  YES -> HashMap (fast) | TreeMap (sorted keys) | LinkedHashMap (insertion/access order)
  NO  -> Need to find K-th smallest/largest frequently? -> PriorityQueue (heap)
         Need uniqueness?
           YES -> HashSet (fast) | TreeSet (sorted / range queries)
           NO  -> ArrayList (default) | ArrayDeque (stack/queue)
~~~

**Practical rules for interviews:**

1. Default to \`ArrayList\` / \`HashMap\` / \`HashSet\` — justify any deviation.
2. Reach for \`PriorityQueue\` when the problem says "top K", "K closest", or "median".
3. Use \`TreeMap\` / \`TreeSet\` when you need sorted keys or range/floor/ceiling queries.
4. Use \`LinkedHashMap(accessOrder=true)\` + \`removeEldestEntry\` for LRU cache.
5. Never rely on \`HashMap\`/\`HashSet\` iteration order — it is not guaranteed.`,
    },
  ],
  exercises: [
    {
      id: 'group-by-first-letter',
      title: 'Group words by first letter',
      difficulty: 'warmup',
      prompt: `Implement the static method below that groups a list of words by their **lowercase
first letter**, preserving the original input order within each group.

~~~java
static Map<Character, List<String>> groupByFirstLetter(List<String> words)
~~~

**Examples:**

~~~text
Input:  ["banana", "apple", "avocado", "cherry", "blueberry", "apricot"]
Output: {b=[banana, blueberry], a=[apple, avocado, apricot], c=[cherry]}

Input:  ["Zoo", "zebra", "ant", "Ape"]
Output: {z=[Zoo, zebra], a=[ant, Ape]}   // first letter lowercased as the key
~~~

**Requirements:**
1. The key is the **lowercase** first character of the word (\`Character.toLowerCase(word.charAt(0))\`).
2. Use \`Map.computeIfAbsent\` to initialise missing lists — no \`containsKey\` or \`getOrDefault\` check.
3. Return a \`HashMap\` (iteration order of keys does not matter; list order within each key must match input order).
4. You may assume the input list is non-null and every word has at least one character.`,
      starter: `import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class GroupByFirstLetter {

    static Map<Character, List<String>> groupByFirstLetter(List<String> words) {
        Map<Character, List<String>> result = new HashMap<>();

        for (String word : words) {
            // TODO: derive the lowercase first-letter key
            // TODO: use computeIfAbsent to get-or-create the list, then add the word
        }

        return result;
    }

    public static void main(String[] args) {
        System.out.println(groupByFirstLetter(
            List.of("banana", "apple", "avocado", "cherry", "blueberry", "apricot")));
        // e.g. {a=[apple, avocado, apricot], b=[banana, blueberry], c=[cherry]}

        System.out.println(groupByFirstLetter(
            List.of("Zoo", "zebra", "ant", "Ape")));
        // {z=[Zoo, zebra], a=[ant, Ape]}
    }
}`,
      hints: [
        'Key derivation: \`char key = Character.toLowerCase(word.charAt(0));\` — \`charAt(0)\` gives the first character, \`toLowerCase\` normalises case.',
        '\`computeIfAbsent\` signature: \`result.computeIfAbsent(key, k -> new ArrayList<>())\`. It returns the existing list if the key is already present, or inserts a new empty \`ArrayList\` and returns it if not. Chain \`.add(word)\` directly on the returned list.',
        'The full loop body is just two lines: compute the key, then \`result.computeIfAbsent(key, k -> new ArrayList<>()).add(word);\`. No \`if\`/\`else\` needed.',
      ],
      solution: `import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class GroupByFirstLetter {

    static Map<Character, List<String>> groupByFirstLetter(List<String> words) {
        Map<Character, List<String>> result = new HashMap<>();

        for (String word : words) {
            char key = Character.toLowerCase(word.charAt(0));
            result.computeIfAbsent(key, k -> new ArrayList<>()).add(word);
        }

        return result;
    }

    public static void main(String[] args) {
        System.out.println(groupByFirstLetter(
            List.of("banana", "apple", "avocado", "cherry", "blueberry", "apricot")));
        // {a=[apple, avocado, apricot], b=[banana, blueberry], c=[cherry]}

        System.out.println(groupByFirstLetter(
            List.of("Zoo", "zebra", "ant", "Ape")));
        // {z=[Zoo, zebra], a=[ant, Ape]}
    }
}`,
      explanation: `**\`computeIfAbsent\`** is the idiomatic way to build a \`Map<K, List<V>>\` (a
"multimap"). Its contract is:

> If the key is absent, call the mapping function, store the result, and return it.
> If the key is present, return the existing value without calling the function.

This collapses the classic three-liner pattern —

~~~java
if (!map.containsKey(key)) map.put(key, new ArrayList<>());
map.get(key).add(value);
~~~

— into a single expression: \`map.computeIfAbsent(key, k -> new ArrayList<>()).add(value)\`.

**Why not \`getOrDefault\`?** \`getOrDefault\` returns the default but does **not** insert it
into the map, so you would still need a separate \`put\`. \`computeIfAbsent\` inserts atomically.

**Insertion order within each list** is preserved automatically because we iterate the
input in order and always \`add\` to the tail of the \`ArrayList\`.

**Key normalisation** (\`Character.toLowerCase\`) ensures \`'Z'\` and \`'z'\` map to the same
bucket. Without it, "Zoo" and "zebra" would land under different keys.`,
    },
    {
      id: 'lru-cache',
      title: 'LRU cache using LinkedHashMap',
      difficulty: 'core',
      prompt: `Implement a **Least-Recently Used (LRU) cache** with a fixed capacity. The cache
supports two operations:

- \`get(key)\` — return the value for \`key\`, or \`-1\` if not present. Counts as a use.
- \`put(key, value)\` — insert or update the entry. If inserting would exceed capacity,
  **evict the least-recently used entry first**.

"Recently used" means either accessed via \`get\` or inserted/updated via \`put\`.

~~~text
LRU(capacity=3)
  put(1, "a")   -> cache: {1=a}
  put(2, "b")   -> cache: {1=a, 2=b}
  put(3, "c")   -> cache: {1=a, 2=b, 3=c}
  get(1)        -> "a";  cache order (LRU→MRU): 2, 3, 1
  put(4, "d")   -> evict 2 (LRU);  cache: {3=c, 1=a, 4=d}
  get(2)        -> -1 (evicted)
  get(3)        -> "c";  cache order: 1, 4, 3
  put(5, "e")   -> evict 1;  cache: {4=d, 3=c, 5=e}
~~~

**Requirements:**
- Back the cache with a \`LinkedHashMap\` in **access-order mode**.
- Override \`removeEldestEntry\` to enforce the capacity limit.
- Both \`get\` and \`put\` must be **O(1)**.
- Do not use any other data structures.`,
      starter: `import java.util.LinkedHashMap;
import java.util.Map;

public class LRUCache {

    private final int capacity;
    private final Map<Integer, String> cache;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        // TODO: initialise cache as an access-order LinkedHashMap
        //       and override removeEldestEntry to evict when size > capacity
        this.cache = null;
    }

    /** Returns the cached value, or "-1" if absent. */
    public String get(int key) {
        // TODO
        return "-1";
    }

    /** Inserts or updates key; evicts LRU entry if over capacity. */
    public void put(int key, String value) {
        // TODO
    }

    @Override
    public String toString() {
        return cache.toString();
    }

    public static void main(String[] args) {
        LRUCache lru = new LRUCache(3);
        lru.put(1, "a");
        lru.put(2, "b");
        lru.put(3, "c");
        System.out.println(lru.get(1));    // a
        lru.put(4, "d");
        System.out.println(lru.get(2));    // -1 (evicted)
        System.out.println(lru.get(3));    // c
        lru.put(5, "e");
        System.out.println(lru);           // {4=d, 3=c, 5=e}  (key 1 evicted)
    }
}`,
      hints: [
        'LinkedHashMap constructor: new LinkedHashMap<>(initialCapacity, loadFactor, accessOrder). Pass true for accessOrder to enable LRU behaviour.',
        'Override removeEldestEntry(Map.Entry eldest) and return size() > capacity. The JDK calls this hook automatically after every put.',
        'get() should call cache.getOrDefault(key, "-1") — because LinkedHashMap.get already moves the entry to the tail in access-order mode, no extra work is needed.',
      ],
      solution: `import java.util.LinkedHashMap;
import java.util.Map;

public class LRUCache {

    private final int capacity;
    private final Map<Integer, String> cache;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new LinkedHashMap<>(capacity, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Integer, String> eldest) {
                return size() > capacity;  // evict head (LRU) when over capacity
            }
        };
    }

    public String get(int key) {
        // getOrDefault triggers the access-order move-to-tail in LinkedHashMap
        return cache.getOrDefault(key, "-1");
    }

    public void put(int key, String value) {
        cache.put(key, value);  // insert or update; removeEldestEntry fires after this
    }

    @Override
    public String toString() {
        return cache.toString();
    }

    public static void main(String[] args) {
        LRUCache lru = new LRUCache(3);
        lru.put(1, "a");
        lru.put(2, "b");
        lru.put(3, "c");
        System.out.println(lru.get(1));    // a
        lru.put(4, "d");
        System.out.println(lru.get(2));    // -1
        System.out.println(lru.get(3));    // c
        lru.put(5, "e");
        System.out.println(lru);           // {4=d, 3=c, 5=e}
    }
}`,
      explanation: `The key insight is the \`accessOrder = true\` flag on the \`LinkedHashMap\` constructor.
In this mode, every \`get\` and \`put\` call moves the accessed entry to the **tail** of the
internal doubly-linked list, making the **head** always the least-recently used entry.

\`removeEldestEntry\` is a protected callback that the JDK calls after every \`put\`. By
default it always returns \`false\` (never evict). Overriding it to return \`size() > capacity\`
triggers automatic head-eviction the moment the map grows beyond its limit.

Both \`get\` and \`put\` are O(1) because they delegate to the underlying hash table
(O(1) average for lookup/insert) and the linked list pointer manipulation (O(1)).
This is why this pattern is the standard LRU implementation in Java — no separate
queue or doubly-linked-list node class needed.`,
    },
    {
      id: 'top-k-frequent',
      title: 'Top-K frequent elements',
      difficulty: 'core',
      prompt: `Given an array of integers and an integer \`k\`, return the \`k\` most frequent
elements. The result may be in any order.

~~~java
int[] nums = {1, 1, 1, 2, 2, 3, 4, 4, 4, 4, 5};
int k = 3;
// one valid answer: [4, 1, 2]  (4 appears 4x, 1 appears 3x, 2 appears 2x)
~~~

**Requirements:**
1. Build a frequency map with \`HashMap\`.
2. Use a **min-heap (\`PriorityQueue\`) of size k** to track the top-K entries — do
   **not** sort the entire frequency map.
3. Print the result as a list.

After your implementation is working, answer (as comments) the two complexity questions:

- What is the time complexity of your approach? Compare it to the sort-all alternative.
- What is the space complexity?`,
      starter: `import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public class TopKFrequent {

    static List<Integer> topK(int[] nums, int k) {
        // Step 1: count frequencies
        Map<Integer, Integer> freq = new HashMap<>();
        // TODO

        // Step 2: maintain a min-heap of size k, ordered by frequency.
        // The heap holds Map.Entry<Integer,Integer> (element -> count).
        // Comparator: compare by entry value (frequency) ascending.
        PriorityQueue<Map.Entry<Integer, Integer>> heap =
            new PriorityQueue<>(k, /* TODO: comparator */null);

        for (Map.Entry<Integer, Integer> entry : freq.entrySet()) {
            // TODO: offer entry; if heap grows beyond k, poll the min
        }

        // Step 3: collect heap contents into a result list
        List<Integer> result = new ArrayList<>();
        // TODO
        return result;
    }

    public static void main(String[] args) {
        int[] nums = {1, 1, 1, 2, 2, 3, 4, 4, 4, 4, 5};
        System.out.println(topK(nums, 3));  // e.g. [2, 1, 4] — order may vary
    }
}`,
      hints: [
        'Comparator for the heap: Comparator.comparingInt(Map.Entry::getValue). This is a min-heap by frequency — the head is always the least-frequent of the top-K candidates.',
        'Heap maintenance: after heap.offer(entry), if heap.size() > k call heap.poll() to drop the current minimum. After processing all entries, the heap contains exactly the k most frequent elements.',
        'Time complexity: O(n log k) — n insertions into a heap capped at size k. Sort-all alternative is O(n log n). When k << n this is a significant saving. Space: O(n) for the frequency map plus O(k) for the heap.',
      ],
      solution: `import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public class TopKFrequent {

    static List<Integer> topK(int[] nums, int k) {
        // Step 1: frequency map  O(n)
        Map<Integer, Integer> freq = new HashMap<>();
        for (int n : nums) freq.merge(n, 1, Integer::sum);

        // Step 2: min-heap bounded to size k, ordered by frequency ascending
        // The head is always the *least* frequent of the current top-K candidates.
        PriorityQueue<Map.Entry<Integer, Integer>> heap =
            new PriorityQueue<>(k, Comparator.comparingInt(Map.Entry::getValue));

        for (Map.Entry<Integer, Integer> entry : freq.entrySet()) {
            heap.offer(entry);
            if (heap.size() > k) heap.poll();  // evict least-frequent
        }

        // Step 3: drain heap into result  O(k log k)
        List<Integer> result = new ArrayList<>(k);
        while (!heap.isEmpty()) result.add(heap.poll().getKey());
        return result;
    }

    public static void main(String[] args) {
        int[] nums = {1, 1, 1, 2, 2, 3, 4, 4, 4, 4, 5};
        System.out.println(topK(nums, 3));  // [2, 1, 4] or any permutation of the 3 most frequent
    }
}

// Time complexity:  O(n) build freq map  +  O(n log k) heap insertions  =  O(n log k)
// Sort-all:         O(n log n)  — worse when k << n
//
// Space complexity: O(n) for freq map  +  O(k) for heap  =  O(n)`,
      explanation: `**Why a min-heap of size k?** Intuitively: we want to keep a running "top K" window.
The heap's head is always the *weakest candidate* in that window. When a new element has
higher frequency than the current weakest, we swap it in by polling the minimum and
offering the new entry. After processing all n elements the heap holds exactly the K
most frequent entries.

**O(n log k) vs O(n log n).** Every insertion into a heap of size k costs O(log k).
With n total entries, that's O(n log k). Compare to building a full sorted list of all
distinct elements — O(n log n). When k is small (say 10 out of 10 million), log k ≈ 3.3
while log n ≈ 23. The heap is ~7x fewer comparisons.

**\`freq.merge(n, 1, Integer::sum)\`** is a concise one-liner: if key \`n\` is absent, put
value 1; if present, combine existing value with 1 using \`Integer::sum\`. It replaces
the familiar \`getOrDefault\` + \`put\` two-liner.`,
    },
    {
      id: 'multi-key-sort',
      title: 'Multi-key sort with nullsLast and reversed',
      difficulty: 'challenge',
      prompt: `You are given a list of \`Employee\` records. Sort it by **three keys in
priority order**:

1. **Department** — ascending alphabetically (\`null\` department sorts last).
2. **Salary** — descending within the same department (\`null\` salary sorts last within
   the salary ordering, i.e. highest-paid first, then nulls).
3. **Name** — ascending as the tiebreaker.

~~~java
record Employee(String name, String dept, Integer salary) {}

List<Employee> employees = List.of(
    new Employee("Alice",   "Engineering", 90000),
    new Employee("Bob",     "Engineering", 75000),
    new Employee("Carol",   "Design",      80000),
    new Employee("Dave",    null,          70000),
    new Employee("Eve",     "Engineering", null),
    new Employee("Frank",   "Design",      80000),
    new Employee("Grace",   "Engineering", 90000)
);
~~~

Expected output (print each employee on one line):

~~~text
Carol   | Design       |  80000
Frank   | Design       |  80000
Alice   | Engineering  |  90000
Grace   | Engineering  |  90000
Bob     | Engineering  |  75000
Eve     | Engineering  |    null
Dave    | null         |  70000
~~~

**Requirements:**
- Build the comparator using only the \`Comparator\` fluent API — no overriding \`compareTo\`.
- Use \`Comparator.nullsLast\` (or \`nullsFirst\`) for the nullable fields.
- Do not write any \`if (x == null)\` logic inside the comparator.`,
      starter: `import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class MultiKeySort {

    record Employee(String name, String dept, Integer salary) {}

    public static void main(String[] args) {
        List<Employee> employees = new ArrayList<>(List.of(
            new Employee("Alice",   "Engineering", 90000),
            new Employee("Bob",     "Engineering", 75000),
            new Employee("Carol",   "Design",      80000),
            new Employee("Dave",    null,          70000),
            new Employee("Eve",     "Engineering", null),
            new Employee("Frank",   "Design",      80000),
            new Employee("Grace",   "Engineering", 90000)
        ));

        Comparator<Employee> order =
            // TODO:
            // 1. compare by dept ascending, nulls last
            // 2. thenComparing by salary descending, nulls last
            // 3. thenComparing by name ascending
            null;

        employees.sort(order);

        for (Employee e : employees) {
            System.out.printf("%-8s| %-13s| %6s%n",
                e.name(), e.dept(), e.salary());
        }
    }
}`,
      hints: [
        'For nullable dept: Comparator.comparing(Employee::dept, Comparator.nullsLast(Comparator.naturalOrder())). This wraps a standard String comparator with null-safe handling.',
        'For salary descending with nulls last: Comparator.comparing(Employee::salary, Comparator.nullsLast(Comparator.reverseOrder())). nullsLast puts nulls at the end; reverseOrder sorts the non-null values highest-first.',
        'Remember the reversed() pitfall: do NOT call reversed() on the outer chain. Apply reverseOrder() inside the Comparator.comparing call for salary only, so it does not flip the dept comparison.',
      ],
      solution: `import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class MultiKeySort {

    record Employee(String name, String dept, Integer salary) {}

    public static void main(String[] args) {
        List<Employee> employees = new ArrayList<>(List.of(
            new Employee("Alice",   "Engineering", 90000),
            new Employee("Bob",     "Engineering", 75000),
            new Employee("Carol",   "Design",      80000),
            new Employee("Dave",    null,          70000),
            new Employee("Eve",     "Engineering", null),
            new Employee("Frank",   "Design",      80000),
            new Employee("Grace",   "Engineering", 90000)
        ));

        Comparator<Employee> order =
            // 1. dept ascending, null dept sorts last
            Comparator.comparing(Employee::dept,
                            Comparator.nullsLast(Comparator.naturalOrder()))
            // 2. salary descending within dept; null salary sorts last
            .thenComparing(Employee::salary,
                            Comparator.nullsLast(Comparator.reverseOrder()))
            // 3. name ascending as final tiebreaker
            .thenComparing(Employee::name);

        employees.sort(order);

        for (Employee e : employees) {
            System.out.printf("%-8s| %-13s| %6s%n",
                e.name(), e.dept(), e.salary());
        }
    }
}`,
      explanation: `This exercise targets the two most common \`Comparator\` mistakes in production code:
forgetting to handle \`null\` (leading to NPE at sort time) and misplacing \`reversed()\`
(accidentally flipping keys you wanted to keep ascending).

**\`Comparator.nullsLast(inner)\`** wraps \`inner\` with a null guard: \`null\` values are
moved to the end and all non-null values are compared by \`inner\`. It composes cleanly
with any comparator, so \`nullsLast(reverseOrder())\` gives "descending, nulls last"
without any manual null check.

**Why not chain \`.reversed()\` on the outer comparator?** Because \`reversed()\` flips
*everything* built so far. Had we written \`.thenComparingInt(Employee::salary).reversed()\`,
it would flip the dept comparator too, putting "Engineering" before "Design". By passing
\`Comparator.reverseOrder()\` inside \`comparing(...)\` we keep the reversal scoped to
the salary key only.

\`Comparator.naturalOrder()\` is the typed equivalent of \`(a, b) -> a.compareTo(b)\` — it
picks up the natural ordering of \`String\` (lexicographic) without requiring a lambda.`,
    },
  ],
  takeaways: [
    'If you override \`equals\`, you **must** override \`hashCode\` with the same fields — violating this causes silent HashMap misses. Using a mutable object as a HashMap key is equally dangerous.',
    'Never structurally modify a collection during for-each iteration; use \`Iterator.remove()\`, \`removeIf\`, or a separate remove list to avoid \`ConcurrentModificationException\`.',
    '\`LinkedHashMap(accessOrder=true)\` + \`removeEldestEntry\` is the canonical O(1) LRU cache — no external queue or node class required.',
    'For top-K problems, a **min-heap of size k** costs O(n log k) and O(k) space; sorting the entire frequency map costs O(n log n). The heap wins when k << n.',
    'Use \`Comparator.nullsLast\` / \`nullsFirst\` to handle nullable fields safely; apply \`reverseOrder()\` **inside** \`Comparator.comparing()\` to reverse a single key without flipping the entire chain.',
    '\`TreeSet\` and \`TreeMap\` offer \`floor\`, \`ceiling\`, \`headSet\`, \`tailSet\`, and \`subSet\` — all O(log n) — making them the right choice for range queries and sorted-min/max access patterns.',
    'Default to \`ArrayList\` / \`HashMap\` / \`HashSet\`; switch to \`PriorityQueue\` for K-th element patterns, \`TreeMap\`/\`TreeSet\` for sorted/range access, and \`LinkedHashMap\` when access or insertion order matters alongside O(1) lookup.',
  ],
}
