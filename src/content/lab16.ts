import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: solid in core Java, brand new to Spring.
// Level: BEGINNER -> INTERMEDIATE — every concept is defined before use;
// no gotcha-first content; small runnable examples; step-by-step build-up.
// Spring Boot 4 / Java 21 / spring-boot-starter-data-jpa / jakarta.persistence.*

export const lab16: Lab = {
  id: 'lab-16',
  number: 16,
  track: 'spring',
  title: 'Data Access with Spring Data JPA',
  subtitle: 'From raw SQL to managed entities — JPA, Hibernate, repositories, and transactions for Spring beginners',
  estimatedHours: 6,
  concepts: [
    'ORM', 'JPA', 'Hibernate', '@Entity', '@Id', '@GeneratedValue',
    'JpaRepository', 'CRUD', 'derived queries', '@Query', 'JPQL',
    'Pageable', 'Page', '@Transactional',
  ],
  overview: `Most applications need to store data in a database. Before Spring Data JPA, that
meant writing a lot of repetitive JDBC code: open a connection, prepare a statement,
map each column to a field, close the connection, handle exceptions … for every query.

Spring Data JPA takes nearly all of that away. You define a Java class that maps to
a database table, extend one interface, and Spring writes the database code for you at
startup. This lab builds that picture from scratch.

**What you will learn:**

- What JPA and Hibernate are and why they exist.
- How to turn a plain Java class into a database table with \`@Entity\` and \`@Id\`.
- What a *repository* is and the magic behind \`JpaRepository\` (Spring generates the implementation so you never have to).
- The built-in CRUD methods and how to use them.
- How to add your own queries by simply naming a method (\`findByStatus\`, \`findByNameContaining\`, …).
- How to write a custom JPQL query with \`@Query\` and return a page of results.
- What a *transaction* is and what the \`@Transactional\` annotation does.

No previous Spring Data experience is assumed. The H2 in-memory database is used for
all examples — no database installation required.`,
  theory: [
    {
      id: 'what-is-jpa',
      heading: 'What is JPA — and why do we need it?',
      body: `Every time you write a Java application that reads or writes data, you are dealing
with an **impedance mismatch**: your Java world has *objects* (instances of classes with
fields and methods), but a relational database stores *rows* in *tables* with *columns*.
Bridging the two by hand is tedious and error-prone.

**JPA** (Jakarta Persistence API) is a *specification* — a set of rules and interfaces
that describe how to map Java objects to database tables. You use annotations like
\`@Entity\` and \`@Id\` to describe the mapping, and JPA takes care of the SQL.

**Hibernate** is the most popular *implementation* of JPA. When you add
\`spring-boot-starter-data-jpa\` to a Spring Boot project, Hibernate is pulled in
automatically as the JPA provider.

**The term ORM (Object-Relational Mapping)** is the general name for this technique.
JPA / Hibernate is Java's standard ORM solution.

In a sentence: *JPA is the specification; Hibernate is the library that implements it;
Spring Data JPA builds a convenient abstraction on top of both.*

~~~text
Your code
   |
   v
Spring Data JPA   <-- repository interfaces, derived queries, @Query
   |
   v
JPA (jakarta.persistence.*)   <-- @Entity, @Id, EntityManager
   |
   v
Hibernate   <-- generates and executes SQL
   |
   v
JDBC / H2 / PostgreSQL / MySQL …
~~~

> **No magic — just generated code.** When Spring Boot starts your application it scans
> your \`@Entity\` classes and creates the tables (if \`spring.jpa.hibernate.ddl-auto=create\`
> or \`create-drop\`). For H2 in development this is perfectly fine.`,
    },
    {
      id: 'entity-basics',
      heading: 'Defining your first @Entity',
      body: `A JPA **entity** is a plain Java class with one extra rule: every entity must have a
field that uniquely identifies each row — its **primary key**, marked \`@Id\`.

Here is the minimal entity you need to understand:

~~~java
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity                           // 1. This class maps to a database table
public class Product {

    @Id                           // 2. This field is the primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 3. The DB auto-increments it
    private Long id;

    private String name;          // 4. Each field maps to a column automatically
    private String status;
    private double price;

    // JPA requires a no-argument constructor (can be protected)
    protected Product() {}

    // Your own constructor for creating new products
    public Product(String name, String status, double price) {
        this.name   = name;
        this.status = status;
        this.price  = price;
    }

    // Standard getters
    public Long   getId()     { return id; }
    public String getName()   { return name; }
    public String getStatus() { return status; }
    public double getPrice()  { return price; }
}
~~~

**What each annotation does:**

| Annotation | Meaning |
|---|---|
| \`@Entity\` | Marks the class as a JPA entity. Spring Boot creates a \`product\` table for it. |
| \`@Id\` | Marks the primary key field. Every entity needs exactly one. |
| \`@GeneratedValue(strategy = GenerationType.IDENTITY)\` | Tells the database to generate the ID automatically (auto-increment). You never set \`id\` yourself. |

**Column names are derived automatically.** The field \`name\` maps to the column \`name\`,
\`status\` maps to \`status\`, etc. You can customise with \`@Column(name = "product_name")\`
if needed, but the defaults are usually fine.

**The protected no-arg constructor** is required by the JPA specification. Hibernate uses
it internally when reconstructing objects from database rows. You never call it yourself.`,
    },
    {
      id: 'jpa-repository',
      heading: 'What is a repository — and the magic of JpaRepository',
      body: `A **repository** is a class (or interface) that provides data access methods for a
specific entity: save a product, find it by id, delete it, list all of them. The
repository pattern keeps database code in one place and away from your business logic.

With Spring Data JPA you do **not write the implementation yourself**. You declare an
interface that extends \`JpaRepository<T, ID>\`:

- \`T\` is the entity type (e.g. \`Product\`).
- \`ID\` is the type of the primary key (e.g. \`Long\`).

~~~java
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
    // Nothing here yet — Spring Data already gives you full CRUD for free
}
~~~

That is the entire file. Spring Boot sees this interface at startup, generates a
complete implementation behind the scenes, and registers it as a Spring bean. You never
write a \`@Component\` or \`@Repository\` annotation on your own implementation class —
because there is no implementation class to write.

**How does Spring know to create it?** Spring Boot's auto-configuration includes
\`@EnableJpaRepositories\`, which scans your packages for interfaces that extend any
Spring Data repository interface and automatically creates proxy implementations for them.

**Using the repository** — just inject it with constructor injection:

~~~java
import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final ProductRepository repository;

    // Constructor injection (preferred — no @Autowired needed in Spring Boot 4)
    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }
}
~~~`,
    },
    {
      id: 'crud-methods',
      heading: 'Built-in CRUD methods',
      body: `Because \`JpaRepository\` already implements them, you get all of these methods the
moment you extend it — no extra code needed:

~~~java
// ---- Saving ----
Product saved = repository.save(product);      // INSERT if new; UPDATE if id already exists

// ---- Finding ----
Optional<Product> byId  = repository.findById(1L);
List<Product>     all   = repository.findAll();
boolean exists          = repository.existsById(1L);
long    count           = repository.count();

// ---- Deleting ----
repository.deleteById(1L);
repository.delete(product);
~~~

**A complete runnable example** using a \`CommandLineRunner\` (Spring Boot calls the
\`run\` method once the application has started):

~~~java
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataDemo implements CommandLineRunner {

    private final ProductRepository repository;

    public DataDemo(ProductRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        // 1. Save some products
        repository.save(new Product("Laptop",  "ACTIVE", 999.99));
        repository.save(new Product("Mouse",   "ACTIVE", 29.99));
        repository.save(new Product("Old Keyboard", "DISCONTINUED", 15.00));

        // 2. List all
        System.out.println("All products: " + repository.findAll());

        // 3. Find by id
        repository.findById(1L).ifPresent(p ->
            System.out.println("Found: " + p.getName()));

        // 4. Delete
        repository.deleteById(3L);
        System.out.println("After delete, count: " + repository.count());
    }
}
~~~

**\`Optional<T>\`** — \`findById\` returns an \`Optional\` rather than \`null\` because a
product with that id may or may not exist. Use \`ifPresent\`, \`orElseThrow\`, or
\`orElse(defaultValue)\` to unwrap it safely.`,
    },
    {
      id: 'derived-queries',
      heading: 'Derived query methods — queries from method names',
      body: `Spring Data JPA can generate a query just from the name of a method you declare in
your repository interface. You write the signature; Spring figures out the SQL.

The name must follow the pattern \`findBy<Field><Condition>\`:

~~~java
public interface ProductRepository extends JpaRepository<Product, Long> {

    // SELECT * FROM product WHERE status = ?
    List<Product> findByStatus(String status);

    // SELECT * FROM product WHERE name LIKE '%?%'
    List<Product> findByNameContaining(String keyword);

    // SELECT * FROM product WHERE status = ? AND price < ?
    List<Product> findByStatusAndPriceLessThan(String status, double maxPrice);
}
~~~

**How Spring parses the name:**

1. Strip \`findBy\` (or \`countBy\`, \`deleteBy\`, …).
2. Split what remains at camelCase boundaries: \`Status\` → field \`status\`; \`NameContaining\` → field \`name\` with \`LIKE\` condition.
3. \`And\` / \`Or\` combine multiple predicates.

**Common keyword suffixes:**

| Keyword | SQL equivalent |
|---|---|
| \`findByName\` | \`WHERE name = ?\` |
| \`findByNameContaining\` | \`WHERE name LIKE '%?%'\` |
| \`findByPriceLessThan\` | \`WHERE price < ?\` |
| \`findByPriceGreaterThanEqual\` | \`WHERE price >= ?\` |
| \`findByStatusIn\` | \`WHERE status IN (?)\` |
| \`findByActiveTrue\` | \`WHERE active = true\` |
| \`findByStatusOrderByPriceAsc\` | \`… ORDER BY price ASC\` |

These cover the vast majority of straightforward queries. When a query becomes too
complex to express in a method name (multiple joins, aggregates, subqueries) you reach
for \`@Query\` instead — covered in the next section.`,
    },
    {
      id: 'query-annotation',
      heading: '@Query, JPQL, and pagination with Pageable',
      body: `**What is JPQL?**
JPQL (Jakarta Persistence Query Language) looks a lot like SQL, but instead of table
and column names it uses your *entity class names* and *field names*. Hibernate translates
your JPQL to the dialect SQL your database understands.

~~~java
// SQL:   SELECT * FROM product WHERE status = 'ACTIVE'
// JPQL:  SELECT p FROM Product p WHERE p.status = 'ACTIVE'
//                        ^^^^^^                   ^^^^^^
//                        entity class             field name
~~~

The \`@Query\` annotation lets you attach a JPQL query to a repository method:

~~~java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long> {

    // Named parameter :status matches @Param("status")
    @Query("SELECT p FROM Product p WHERE p.status = :status AND p.price < :maxPrice")
    List<Product> findCheapByStatus(@Param("status") String status,
                                    @Param("maxPrice") double maxPrice);
}
~~~

---

**Pagination with Pageable and Page**

Loading every row from a large table at once is a bad idea. Spring Data JPA supports
pagination through the \`Pageable\` parameter and the \`Page<T>\` return type.

Any repository method — derived or \`@Query\` — can accept a \`Pageable\` and return a
\`Page<T>\`:

~~~java
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ProductRepository extends JpaRepository<Product, Long> {

    // Return one page of active products
    Page<Product> findByStatus(String status, Pageable pageable);

    // @Query also works with Pageable
    @Query("SELECT p FROM Product p WHERE p.price < :max")
    Page<Product> findAffordable(@Param("max") double max, Pageable pageable);
}
~~~

**Creating and reading a \`PageRequest\`:**

~~~java
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

// Page 0 (the first page), 10 items per page, sorted by name ascending
Pageable pageable = PageRequest.of(0, 10, Sort.by("name").ascending());

Page<Product> page = repository.findByStatus("ACTIVE", pageable);

List<Product> items      = page.getContent();       // the actual products
long          total      = page.getTotalElements(); // total matching rows
int           totalPages = page.getTotalPages();
boolean       hasMore    = page.hasNext();
~~~

Spring Data automatically issues a second \`COUNT\` query so \`getTotalElements()\` works.
This is why pagination is cheap: you only load one page of rows, not all of them.`,
    },
    {
      id: 'transactional',
      heading: 'Transactions and @Transactional',
      body: `**What is a transaction?**

A *transaction* is a group of database operations that either all succeed together
or all fail together. The classic example is a bank transfer: you debit account A and
credit account B. If the debit succeeds but the credit fails (say, the server crashes)
the money disappears. A transaction guarantees that either both happen or neither does.

The four properties of a transaction are often called **ACID**:

| Property | Meaning |
|---|---|
| **A**tomicity | All or nothing — partial success is not allowed. |
| **C**onsistency | The database moves from one valid state to another. |
| **I**solation | Concurrent transactions do not see each other's uncommitted changes. |
| **D**urability | Once committed, data survives a crash. |

---

**\`@Transactional\` in Spring**

You declare that a method should run inside a transaction by annotating it with
\`@Transactional\` (import from \`org.springframework.transaction.annotation.Transactional\`):

~~~java
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository orderRepo;
    private final InventoryRepository inventoryRepo;

    public OrderService(OrderRepository orderRepo, InventoryRepository inventoryRepo) {
        this.orderRepo     = orderRepo;
        this.inventoryRepo = inventoryRepo;
    }

    @Transactional          // BEGIN transaction before this method
    public void placeOrder(Order order) {
        orderRepo.save(order);              // step 1: save the order
        inventoryRepo.reduceStock(order);   // step 2: reduce inventory

        // If step 2 throws a RuntimeException, Spring rolls back step 1 too.
        // The database is left unchanged — as if neither save happened.
    }                       // COMMIT if no exception; ROLLBACK if RuntimeException
~~~

**Key points to remember:**

- Spring wraps the method in a transaction via a proxy. The transaction begins when
  the method starts and commits (or rolls back) when it finishes.
- By default, Spring rolls back on **\`RuntimeException\`** (and its subclasses) and
  **lets checked \`Exception\` commit**. Add \`rollbackFor = MyCheckedException.class\` to
  change this.
- For read-only operations (queries with no writes) add \`readOnly = true\`:
  \`@Transactional(readOnly = true)\`. This is a hint to Hibernate to skip some internal
  bookkeeping, making it slightly faster.
- Spring Data repository methods are already transactional by default — you only need
  \`@Transactional\` on your own *service* methods that combine multiple operations.

~~~java
// Example: a @Transactional service method that does two saves atomically
@Transactional
public void transferStock(Long fromId, Long toId, int quantity) {
    Product from = productRepo.findById(fromId).orElseThrow();
    Product to   = productRepo.findById(toId).orElseThrow();

    from.setStock(from.getStock() - quantity);
    to.setStock(to.getStock()   + quantity);

    productRepo.save(from);
    productRepo.save(to);

    // Both saves are committed together.
    // If anything throws a RuntimeException here, both are rolled back.
}
~~~

---

**Going deeper — two things to look up when you're ready:**

1. **The N+1 problem.** When you load a list of entities that each have a lazy-loaded
   association (e.g. a \`Product\` that has a list of \`Review\` objects), accessing those
   reviews in a loop fires one extra SQL query per product — \`1 + N\` queries total
   instead of 1. The fix is a \`JOIN FETCH\` in a \`@Query\` or an \`@EntityGraph\` annotation.
   Enable \`spring.jpa.show-sql=true\` in \`application.properties\` to see your queries
   and spot this pattern.

2. **Lazy loading.** By default, \`@OneToMany\` associations (a \`Product\` with many
   \`Review\`s) are loaded *lazily* — Hibernate only fetches them when your code actually
   accesses them. This is usually the right default, but it requires an open transaction
   (session) at the time of access; accessing a lazy collection outside a transaction
   throws \`LazyInitializationException\`. Annotating your service method with
   \`@Transactional\` keeps the session open and prevents this.`,
    },
  ],
  exercises: [
    {
      id: 'crud-with-repository',
      title: 'Define an @Entity and use built-in CRUD methods',
      difficulty: 'warmup',
      prompt: `**Your goal:** set up a tiny Spring Boot application with one entity and a repository,
then use the built-in CRUD methods to create, read, update, and delete records.

**Setup** — \`pom.xml\` dependencies you need:

~~~xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
~~~

\`application.properties\`:

~~~properties
spring.datasource.url=jdbc:h2:mem:testdb
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
~~~

**Tasks:**

1. Create a \`Task\` entity with fields \`id\` (Long, auto-generated), \`title\` (String), and
   \`status\` (String — e.g. \`"OPEN"\` / \`"DONE"\`).
2. Create a \`TaskRepository\` that extends \`JpaRepository<Task, Long>\`.
3. In a \`CommandLineRunner\` bean:
   a. Save three tasks (two OPEN, one DONE).
   b. Print all tasks (\`findAll()\`).
   c. Find the first task by id and print its title.
   d. Change its status to \`"DONE"\` and save it again.
   e. Delete the last task by id.
   f. Print the final count.
4. Run the application and observe the SQL in the console (because \`show-sql=true\`).

**Expected output (approximately):**
~~~text
Saved 3 tasks
All tasks: [Task{id=1, title='Write tests', status='OPEN'}, ...]
Found: Write tests
After update, status: DONE
After delete, count: 2
~~~`,
      starter: `import jakarta.persistence.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

// TODO 1: Define Task entity
// @Entity
// public class Task { ... }

// TODO 2: Define TaskRepository
// public interface TaskRepository extends JpaRepository<Task, Long> { }

@SpringBootApplication
public class Lab16App {

    public static void main(String[] args) {
        SpringApplication.run(Lab16App.class, args);
    }

    @Bean
    CommandLineRunner demo(/* TODO: inject TaskRepository */) {
        return args -> {
            // TODO 3a: save three tasks
            // TODO 3b: print all tasks
            // TODO 3c: find first by id and print title
            // TODO 3d: update status to DONE and save
            // TODO 3e: delete the last task by id
            // TODO 3f: print final count
        };
    }
}`,
      hints: [
        'The \`@Entity\` class needs a protected no-arg constructor (JPA requirement) and an \`@Id @GeneratedValue(strategy = GenerationType.IDENTITY)\` field.',
        '\`repository.save(entity)\` returns the saved entity with its generated \`id\` populated — capture that return value if you need the id for a later \`findById\` call.',
        'To update a record: load it with \`findById\`, call the setter on the returned object, then call \`save\` again. The same \`save\` method handles both inserts and updates.',
      ],
      solution: `import jakarta.persistence.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.JpaRepository;

@Entity
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String status;

    protected Task() {}

    public Task(String title, String status) {
        this.title  = title;
        this.status = status;
    }

    public Long   getId()     { return id; }
    public String getTitle()  { return title; }
    public String getStatus() { return status; }
    public void   setStatus(String status) { this.status = status; }

    @Override
    public String toString() {
        return "Task{id=" + id + ", title='" + title + "', status='" + status + "'}";
    }
}

public interface TaskRepository extends JpaRepository<Task, Long> {}

@SpringBootApplication
public class Lab16App {

    public static void main(String[] args) {
        SpringApplication.run(Lab16App.class, args);
    }

    @Bean
    CommandLineRunner demo(TaskRepository repository) {
        return args -> {
            // 3a. Save three tasks — capture return values to get the generated ids
            Task t1 = repository.save(new Task("Write tests",   "OPEN"));
            Task t2 = repository.save(new Task("Fix the bug",   "OPEN"));
            Task t3 = repository.save(new Task("Update README", "DONE"));
            System.out.println("Saved 3 tasks");

            // 3b. Print all
            System.out.println("All tasks: " + repository.findAll());

            // 3c. Find first task by id
            repository.findById(t1.getId())
                      .ifPresent(t -> System.out.println("Found: " + t.getTitle()));

            // 3d. Update status
            Task loaded = repository.findById(t1.getId()).orElseThrow();
            loaded.setStatus("DONE");
            repository.save(loaded);
            System.out.println("After update, status: " +
                repository.findById(t1.getId()).orElseThrow().getStatus());

            // 3e. Delete the last task
            repository.deleteById(t3.getId());

            // 3f. Final count
            System.out.println("After delete, count: " + repository.count());
        };
    }
}`,
      explanation: `**\`@Entity\`** is the annotation that makes a plain Java class part of the JPA world.
Spring Boot reads it at startup and creates the \`task\` table in H2 automatically
(because of \`ddl-auto=create-drop\`).

**\`JpaRepository\`** is the magic: you write an interface with zero method bodies and
Spring Data generates a fully working implementation. \`save\`, \`findById\`, \`findAll\`,
\`deleteById\`, and \`count\` are all inherited.

**\`save\` handles both INSERT and UPDATE.** If the entity has no id (or id is null),
it issues an \`INSERT\` and populates the id on the returned object. If the entity already
has an id, it issues an \`UPDATE\`. That is why you capture the return value of \`save\` —
the returned instance has the generated \`id\` set.

**\`findById\` returns \`Optional<Task>\`** because a row with that id may not exist.
Using \`orElseThrow()\` throws \`NoSuchElementException\` if absent; \`orElse(null)\` returns
null; \`ifPresent(consumer)\` calls the consumer only when a value is present.

With \`spring.jpa.show-sql=true\` you can see every SQL statement in the console — a
great habit when learning JPA.`,
    },
    {
      id: 'derived-query-methods',
      title: 'Add derived query methods',
      difficulty: 'core',
      prompt: `You already have a \`Task\` entity (from the previous exercise) with \`id\`, \`title\`,
and \`status\`. Extend it and the repository with derived query methods.

**Add one more field to \`Task\`:**

~~~java
private String assignee;   // e.g. "alice", "bob"
~~~

Add a getter and update your constructor to accept it:
\`new Task("Write tests", "OPEN", "alice")\`.

**Tasks — add these methods to \`TaskRepository\`:**

1. \`findByStatus(String status)\` — return all tasks with the given status.
2. \`findByAssignee(String assignee)\` — return all tasks for a given assignee.
3. \`findByStatusAndAssignee(String status, String assignee)\` — combine both filters.
4. \`findByTitleContaining(String keyword)\` — tasks whose title contains the keyword
   (case-insensitive in H2 by default).
5. \`countByStatus(String status)\` — return the number of tasks with that status (returns \`long\`).

**In your \`CommandLineRunner\`:**

- Save at least four tasks with different statuses and assignees.
- Call each method and print the results.
- Verify that \`findByStatusAndAssignee("OPEN", "alice")\` returns only alice's open tasks.`,
      starter: `// Extend Task with an 'assignee' field (add field, getter, update constructor)

// Add the following method signatures to TaskRepository:
public interface TaskRepository extends JpaRepository<Task, Long> {

    // TODO 1: find all tasks by status
    // TODO 2: find all tasks by assignee
    // TODO 3: find tasks by both status AND assignee
    // TODO 4: find tasks whose title contains a keyword
    // TODO 5: count tasks by status (return long)
}

// In CommandLineRunner:
//   - save four tasks, e.g.:
//       new Task("Write tests",    "OPEN", "alice")
//       new Task("Review PR",      "OPEN", "bob")
//       new Task("Deploy to prod", "DONE", "alice")
//       new Task("Update docs",    "OPEN", "alice")
//   - call each new method and print the results`,
      hints: [
        'Spring Data parses the method name. \`findByStatus\` maps to \`WHERE status = ?\`, \`findByTitleContaining\` maps to \`WHERE title LIKE \'%?%\'\`, \`countByStatus\` maps to \`SELECT COUNT(*) … WHERE status = ?\`.',
        'For \`findByStatusAndAssignee\`, the method name is exactly two predicates joined by \`And\`. The parameter order matches the field order in the name: status first, then assignee.',
        'You do not write any SQL or JPQL. Spring Data generates the query at startup by reading the method name. If the field name in the method name does not match a field on the entity, you get a startup error — which is actually helpful for catching typos early.',
      ],
      solution: `import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

@Entity
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String status;
    private String assignee;

    protected Task() {}

    public Task(String title, String status, String assignee) {
        this.title    = title;
        this.status   = status;
        this.assignee = assignee;
    }

    public Long   getId()       { return id; }
    public String getTitle()    { return title; }
    public String getStatus()   { return status; }
    public String getAssignee() { return assignee; }

    @Override
    public String toString() {
        return "Task{id=" + id + ", title='" + title
             + "', status='" + status + "', assignee='" + assignee + "'}";
    }
}

public interface TaskRepository extends JpaRepository<Task, Long> {

    // 1. All tasks with a given status
    List<Task> findByStatus(String status);

    // 2. All tasks for a given assignee
    List<Task> findByAssignee(String assignee);

    // 3. Combined filter
    List<Task> findByStatusAndAssignee(String status, String assignee);

    // 4. Title contains keyword (LIKE '%keyword%')
    List<Task> findByTitleContaining(String keyword);

    // 5. Count by status
    long countByStatus(String status);
}

// In CommandLineRunner:
//
// repository.save(new Task("Write tests",    "OPEN", "alice"));
// repository.save(new Task("Review PR",      "OPEN", "bob"));
// repository.save(new Task("Deploy to prod", "DONE", "alice"));
// repository.save(new Task("Update docs",    "OPEN", "alice"));
//
// System.out.println("OPEN tasks: " + repository.findByStatus("OPEN"));
// System.out.println("alice tasks: " + repository.findByAssignee("alice"));
// System.out.println("alice OPEN: " + repository.findByStatusAndAssignee("OPEN","alice"));
// System.out.println("Contains 'test': " + repository.findByTitleContaining("test"));
// System.out.println("OPEN count: " + repository.countByStatus("OPEN"));`,
      explanation: `Spring Data JPA reads the method name at **startup time** and builds a query object
for it before your application serves any requests. If the name is invalid (e.g. a field
that does not exist on the entity), the application fails to start — which is exactly the
right behaviour. You get a compile-time-like safety check without writing any SQL.

The parsing rules are consistent:
- \`findBy<Field>\` → \`WHERE field = ?\`
- \`findBy<Field>Containing\` → \`WHERE field LIKE '%?%'\`
- \`countBy<Field>\` → \`SELECT COUNT(*) WHERE field = ?\`
- \`And\` / \`Or\` combine multiple predicates in the order they appear in the name.

Derived methods cover the straightforward cases very well. When a query grows complex —
multiple joins, aggregate functions, subqueries — switch to \`@Query\` to keep the method
name readable.`,
    },
    {
      id: 'query-and-pagination',
      title: 'Write a @Query and return a Page',
      difficulty: 'core',
      prompt: `You will write a custom JPQL query and combine it with Spring Data JPA's pagination
support.

**Starting point:** the same \`Task\` entity and \`TaskRepository\` from the previous exercises
(id, title, status, assignee).

**Tasks:**

1. Add a \`@Query\` method to \`TaskRepository\` that returns tasks where the status matches
   a parameter AND the assignee matches another parameter, using named JPQL parameters
   (\`:status\` and \`:assignee\`).
2. Add a second \`@Query\` method that accepts a \`Pageable\` parameter and returns a
   \`Page<Task>\` of all tasks whose title contains a keyword. Use a JPQL \`LOWER()\` call
   to make the search case-insensitive:
   \`WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :keyword, '%'))\`.
3. In your runner:
   - Create at least six tasks with different titles, statuses, and assignees.
   - Call method 1 and print the results.
   - Call method 2 with a \`PageRequest\` of page 0, size 2. Print the content, the total
     element count, and whether there is a next page.

**Expected console output (approximately):**
~~~text
Custom query result: [Task{..., title='Write tests', status='OPEN', assignee='alice'}, ...]
Page content: [Task{id=1, title='Write unit tests', ...}, Task{id=3, title='Write docs', ...}]
Total matching: 4
Has next page: true
~~~`,
      starter: `import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    // Keep the derived methods from exercise 2 here if you like

    // TODO 1: @Query method — tasks by status AND assignee using named params
    // Hint: "SELECT t FROM Task t WHERE t.status = :status AND t.assignee = :assignee"

    // TODO 2: @Query method returning Page<Task> — title contains keyword, case-insensitive
    // Hint: use LOWER(t.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
    //       and accept a Pageable parameter
}

// In CommandLineRunner, save 6+ tasks and call both new methods.
// For method 2, create the Pageable like this:
//   Pageable pageable = PageRequest.of(0, 2);
// Then read: page.getContent(), page.getTotalElements(), page.hasNext()`,
      hints: [
        'The full JPQL for task 1: \`"SELECT t FROM Task t WHERE t.status = :status AND t.assignee = :assignee"\`. Name your parameters with \`@Param("status")\` and \`@Param("assignee")\` on the method arguments.',
        'For task 2, the signature is: \`Page<Task> searchByTitle(@Param("keyword") String keyword, Pageable pageable);\`. Spring Data sees the \`Pageable\` parameter and automatically applies LIMIT/OFFSET to the JPQL.',
        '\`PageRequest.of(0, 2)\` means "page index 0 (the first page), 2 items per page". \`page.getTotalElements()\` returns the total number of rows that match — Spring issues a \`SELECT COUNT(*)\` query for you automatically.',
      ],
      solution: `import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByStatus(String status);
    List<Task> findByAssignee(String assignee);

    // Task 1: named JPQL parameters
    @Query("SELECT t FROM Task t WHERE t.status = :status AND t.assignee = :assignee")
    List<Task> findByStatusAndAssigneJpql(@Param("status")   String status,
                                          @Param("assignee") String assignee);

    // Task 2: case-insensitive title search with pagination
    @Query("SELECT t FROM Task t WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<Task> searchByTitle(@Param("keyword") String keyword, Pageable pageable);
}

// ---- CommandLineRunner additions ----
//
// repository.save(new Task("Write unit tests",    "OPEN", "alice"));
// repository.save(new Task("Write integration tests", "OPEN", "bob"));
// repository.save(new Task("Write docs",          "OPEN", "alice"));
// repository.save(new Task("Write release notes", "DONE", "alice"));
// repository.save(new Task("Fix the login bug",   "OPEN", "bob"));
// repository.save(new Task("Review PR",           "DONE", "carol"));
//
// // Method 1
// List<Task> aliceOpen = repository.findByStatusAndAssigneJpql("OPEN", "alice");
// System.out.println("Custom query result: " + aliceOpen);
//
// // Method 2
// Pageable firstTwo = PageRequest.of(0, 2);
// Page<Task> page   = repository.searchByTitle("write", firstTwo);
// System.out.println("Page content: "    + page.getContent());
// System.out.println("Total matching: "  + page.getTotalElements());
// System.out.println("Has next page: "   + page.hasNext());`,
      explanation: `**JPQL vs derived methods:** derived methods are generated from the method name
automatically and are great for simple filters. \`@Query\` lets you write the query
explicitly when you need more control — aggregate functions, functions like \`LOWER()\`,
or simply a more readable query for complex conditions.

**Named parameters (\`:name\`)** are the preferred style over positional parameters
(\`?1\`, \`?2\`) because the order of arguments does not matter and the query is self-documenting.
Match each \`:name\` placeholder with a \`@Param("name")\` annotation on the corresponding
method argument.

**Pageable + Page:** adding \`Pageable\` as the last parameter tells Spring Data to wrap
the JPQL in a \`LIMIT / OFFSET\` clause and issue a companion \`SELECT COUNT(*)\` to fill in
\`getTotalElements()\`. All of that happens automatically — you only declare the interface.

**\`LOWER()\` for case-insensitivity:** JPQL supports a handful of string functions. Using
\`LOWER(t.title) LIKE LOWER(CONCAT('%', :keyword, '%'))\` makes the search match
\`"Write"\`, \`"write"\`, and \`"WRITE"\` equally — without needing a database-specific operator.`,
    },
    {
      id: 'transactional-service',
      title: 'A @Transactional service method',
      difficulty: 'challenge',
      prompt: `In this exercise you will write a service method that does **two saves inside one
transaction** and observe what happens when an exception is thrown halfway through.

**Scenario:** you are building a simple task-transfer feature. Transferring a task from
one assignee to another should:
1. Create a new \`AuditLog\` record noting the transfer.
2. Update the \`Task\`'s assignee field.

Both operations must succeed together or neither should persist. If updating the task
fails (simulated by throwing a \`RuntimeException\`), the audit log should also be rolled back.

**Tasks:**

1. Create a second entity \`AuditLog\` with fields \`id\` (Long, auto-generated),
   \`message\` (String), and \`createdAt\` (String — keep it simple with a fixed timestamp
   for now). Create an \`AuditLogRepository extends JpaRepository<AuditLog, Long>\`.

2. Create a \`TransferService\` with constructor injection of both repositories.

3. Write a \`@Transactional\` method \`transfer(Long taskId, String toAssignee, boolean simulateFailure)\`:
   - Save a new \`AuditLog\` with a message like \`"Transfer task " + taskId + " to " + toAssignee\`.
   - Load the \`Task\` by \`taskId\`.
   - If \`simulateFailure\` is true, throw a \`RuntimeException("Simulated failure")\` *before* calling \`save\` on the updated task.
   - Otherwise, set the new assignee and save the task.

4. In your \`CommandLineRunner\`:
   - Call \`transfer(id, "charlie", false)\` — verify both the task is updated AND the log is saved.
   - Call \`transfer(id, "dave", true)\` — verify that the audit log count did NOT increase (the insert was rolled back).

**Hint for verification:**
~~~java
System.out.println("Audit log count: " + auditLogRepository.count()); // should stay the same after failure
~~~`,
      starter: `import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// TODO 1: Create AuditLog entity (id, message, createdAt String)
// TODO 1: Create AuditLogRepository extends JpaRepository<AuditLog, Long>

@Service
public class TransferService {

    private final TaskRepository     taskRepo;
    private final AuditLogRepository auditRepo;

    // TODO: constructor injection
    public TransferService(TaskRepository taskRepo, AuditLogRepository auditRepo) {
        this.taskRepo  = taskRepo;
        this.auditRepo = auditRepo;
    }

    // TODO 3: @Transactional transfer method
    @Transactional
    public void transfer(Long taskId, String toAssignee, boolean simulateFailure) {
        // step 1: save audit log
        // step 2: load task
        // step 3: if simulateFailure, throw new RuntimeException("Simulated failure")
        // step 4: update assignee and save task
    }
}

// In CommandLineRunner:
// Task t = taskRepo.save(new Task("Some task", "OPEN", "alice"));
// transferService.transfer(t.getId(), "charlie", false);
// System.out.println("After successful transfer, log count: " + auditRepo.count()); // expect 1
// try {
//     transferService.transfer(t.getId(), "dave", true);
// } catch (RuntimeException e) {
//     System.out.println("Transfer failed: " + e.getMessage());
// }
// System.out.println("After failed transfer, log count: " + auditRepo.count()); // expect STILL 1`,
      hints: [
        '\`@Transactional\` wraps the whole method in a database transaction. Spring rolls back automatically when a \`RuntimeException\` (or its subclasses) escapes the method. Both the audit log insert AND the task update are part of the same transaction, so both are rolled back together.',
        'Make sure the \`TransferService\` is called from *outside* the bean (from the \`CommandLineRunner\`) so the Spring proxy wraps the call and the \`@Transactional\` behaviour takes effect.',
        'If you want to see the rollback visually, enable \`spring.jpa.show-sql=true\`. You will see the INSERT for the audit log, then the \`ROLLBACK\` statement when the exception is thrown — no INSERT is persisted.',
      ],
      solution: `import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// ---- AuditLog entity ----
@Entity
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String message;
    private String createdAt;

    protected AuditLog() {}

    public AuditLog(String message, String createdAt) {
        this.message   = message;
        this.createdAt = createdAt;
    }

    public Long   getId()        { return id; }
    public String getMessage()   { return message; }
    public String getCreatedAt() { return createdAt; }

    @Override
    public String toString() {
        return "AuditLog{id=" + id + ", message='" + message + "'}";
    }
}

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {}

// ---- TransferService ----
@Service
public class TransferService {

    private final TaskRepository     taskRepo;
    private final AuditLogRepository auditRepo;

    public TransferService(TaskRepository taskRepo, AuditLogRepository auditRepo) {
        this.taskRepo  = taskRepo;
        this.auditRepo = auditRepo;
    }

    @Transactional      // <-- everything below is one atomic operation
    public void transfer(Long taskId, String toAssignee, boolean simulateFailure) {
        // Step 1: persist the audit log entry
        auditRepo.save(new AuditLog(
            "Transfer task " + taskId + " to " + toAssignee,
            "2024-01-01T12:00:00"
        ));

        // Step 2: load the task (throws NoSuchElementException if not found)
        Task task = taskRepo.findById(taskId).orElseThrow();

        // Step 3: simulate a failure BEFORE saving the updated task
        if (simulateFailure) {
            throw new RuntimeException("Simulated failure");
            // RuntimeException -> Spring rolls back the whole transaction
            // The audit log INSERT above is also rolled back
        }

        // Step 4: update and save
        task.setAssignee(toAssignee);
        taskRepo.save(task);
    }
}

// ---- CommandLineRunner usage ----
//
// Task t = taskRepo.save(new Task("Important task", "OPEN", "alice"));
//
// // Successful transfer
// transferService.transfer(t.getId(), "charlie", false);
// System.out.println("Log count after success: " + auditRepo.count()); // 1
// System.out.println("Task assignee: " +
//     taskRepo.findById(t.getId()).orElseThrow().getAssignee()); // charlie
//
// // Failed transfer — both saves rolled back
// try {
//     transferService.transfer(t.getId(), "dave", true);
// } catch (RuntimeException e) {
//     System.out.println("Transfer failed: " + e.getMessage());
// }
// System.out.println("Log count after failure: " + auditRepo.count()); // still 1`,
      explanation: `**Why \`@Transactional\` gives you atomicity:** Spring wraps the method call in a
database transaction via a proxy. All SQL that executes inside the method is sent to the
same database connection, and either all of it is committed at the end or all of it is
rolled back. The database enforces this at the connection level — no partial writes can
sneak through.

**The rollback rule:** by default, Spring rolls back on any unchecked exception
(\`RuntimeException\` and its subclasses). A checked \`Exception\` does *not* trigger a
rollback by default. Use \`@Transactional(rollbackFor = IOException.class)\` to make
checked exceptions roll back too.

**Why you must call through the proxy:** \`@Transactional\` works because Spring generates
a proxy class around your bean. Calls from *other beans* go through that proxy, which
manages the transaction. Calling a \`@Transactional\` method on \`this\` directly (from
within the same class) bypasses the proxy and the method runs without a transaction.
That is why the \`CommandLineRunner\` injects \`TransferService\` and calls it from there,
rather than calling it internally.

**Reading the SQL log:** with \`spring.jpa.show-sql=true\` you will see the \`INSERT\` for
the audit log followed by a \`ROLLBACK\` when the exception fires — concrete proof that the
transaction boundary works as designed.`,
    },
  ],
  takeaways: [
    '**JPA** is the specification for object-relational mapping in Java; **Hibernate** is the library that implements it. \`@Entity\`, \`@Id\`, and \`@GeneratedValue\` are the three annotations you need to map a class to a table.',
    '**Spring Data JPA generates the repository implementation for you at startup.** Extending \`JpaRepository<T, ID>\` gives you \`save\`, \`findById\`, \`findAll\`, \`deleteById\`, \`count\`, and more — with zero code written by you.',
    '**Derived query methods** let you declare queries by naming a method: \`findByStatus\`, \`findByNameContaining\`, \`countByAssignee\`. Spring parses the name at startup and generates the SQL — no SQL or JPQL needed for simple filters.',
    '**\`@Query\`** with JPQL is the escape hatch for complex queries. JPQL uses entity and field names (not table and column names) and supports \`LOWER()\`, aggregates, and other functions that derived methods cannot express.',
    '**Pagination with \`Pageable\` and \`Page<T>\`** keeps large result sets manageable. Pass a \`PageRequest.of(pageIndex, pageSize)\` to any repository method and get back content, total count, and navigation metadata — all with a single parameter addition.',
    '**\`@Transactional\`** wraps a method in a database transaction: all database operations inside either commit together or roll back together on a \`RuntimeException\`. Annotate service methods that combine multiple writes to guarantee atomicity.',
    'Enable \`spring.jpa.show-sql=true\` in \`application.properties\` during development to see every SQL statement Hibernate issues — this is the fastest way to understand what your repository calls actually do and to spot unexpected extra queries.',
  ],
}
