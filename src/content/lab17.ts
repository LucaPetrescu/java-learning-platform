import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Spring Boot 4 / Java 21 target. Test starters:
//   spring-boot-starter-webmvc-test (slice), spring-boot-starter-test (general).
//   @MockitoBean replaces deprecated @MockBean. jakarta.* imports. Constructor injection.

export const lab17: Lab = {
  id: 'lab-17',
  number: 17,
  track: 'spring',
  title: 'Testing Spring Boot Applications',
  subtitle: 'From fast unit tests to slice tests and integration tests — explained from scratch',
  estimatedHours: 6,
  concepts: [
    'test pyramid',
    'JUnit 5',
    'Mockito',
    '@ExtendWith',
    'MockMvc',
    '@WebMvcTest',
    '@MockitoBean',
    '@DataJpaTest',
    'TestEntityManager',
    '@SpringBootTest',
    'AssertJ',
    'context caching',
  ],
  overview: `You already know JUnit 5: you can write \`@Test\` methods and run them. Now you are
writing your first Spring Boot application, and a new question appears: **how do you test a
Spring controller? Or a JPA repository?**

The answer is not "just use \`@SpringBootTest\` for everything." That works, but a suite of
fifty tests that each boot the full application context takes several minutes to run — and
you will run your tests dozens of times a day.

This lab introduces you to the **test pyramid for Spring**: fast, plain Mockito unit tests at
the bottom; focused *slice tests* in the middle (they load only the part of Spring they need);
and a small number of full integration tests at the top. You will write each kind from scratch,
and every concept will be explained before you use it.

By the end you will know **which tool to reach for** when you need to test a service, a
controller, or a repository — and why.`,
  theory: [
    {
      id: 'why-testing',
      heading: 'Why testing matters and what "fast" means',
      body: `A test suite that takes eight minutes to run is one that developers stop running. The
goal is a suite fast enough to run before every commit — typically under a minute for the bulk
of tests — with a few slower tests reserved for CI.

**The test pyramid** is a useful mental model. Imagine three tiers:

~~~text
         /\\
        /  \\
       / E2E \\          few, slow, brittle
      /--------\\
     /  @Spring  \\      integration: loads the full app
    /  BootTest   \\
   /--------------\\
  /  Slice tests   \\    @WebMvcTest, @DataJpaTest — loads only one layer
 /------------------\\
/  Unit / Mockito    \\  fastest, no Spring at all
/--------------------\\
~~~

**Bottom tier — unit tests.** Pure Java. You create the class you want to test directly,
pass in mock dependencies, and call methods. No Spring, no application context, no
database. These run in milliseconds.

**Middle tier — slice tests.** Spring loads *only* the layer you care about: the web layer
(controllers), or the persistence layer (JPA repositories), but not both at once. Startup
is a few seconds instead of ten or more.

**Top tier — integration tests.** \`@SpringBootTest\` loads the entire application context.
Use these sparingly — one smoke test to assert the context starts, and perhaps one or two
tests that verify a user-facing flow end to end.

The rest of this lab walks you through each tier in order, starting at the bottom.`,
    },
    {
      id: 'unit-test-mockito',
      heading: 'Unit testing a service with Mockito — no Spring needed',
      body: `A service class with constructor-injected dependencies is trivially testable without
Spring. You simply create the dependencies as Mockito mocks and pass them in.

**What is a mock?** A mock is a fake object that you control. You tell it what to return
when certain methods are called (\`when(...).thenReturn(...)\`), and afterwards you can check
which methods were called (\`verify(...)\`).

The JUnit 5 extension that makes Mockito annotations work is
\`@ExtendWith(MockitoExtension.class)\`. Place it on the test class:

~~~java
// BookService depends on BookRepository — let's test it in isolation.

@ExtendWith(MockitoExtension.class)             // activate Mockito annotations
class BookServiceTest {

    @Mock
    private BookRepository repository;           // Mockito creates a fake BookRepository

    @InjectMocks
    private BookService service;                 // Mockito creates the real BookService
                                                 // and injects 'repository' into it

    @Test
    void findById_returnsBookWhenFound() {
        // Arrange: tell the fake repository what to return
        var book = new Book(1L, "Clean Code", "Robert Martin");
        when(repository.findById(1L)).thenReturn(Optional.of(book));

        // Act: call the real service
        var result = service.findById(1L);

        // Assert: the service returned what the repository gave it
        assertThat(result).isPresent();
        assertThat(result.get().title()).isEqualTo("Clean Code");
    }

    @Test
    void findById_returnsEmptyWhenNotFound() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThat(service.findById(99L)).isEmpty();
    }
}
~~~

Key points to understand:

- \`@Mock\` creates a Mockito mock of the interface or class. By default every method returns
  \`null\` (or \`0\` / \`false\` for primitives) unless you stub it with \`when\`.
- \`@InjectMocks\` creates a **real** instance of the class under test and injects the
  \`@Mock\`-annotated fields into it via constructor injection.
- There is **no \`@SpringBootTest\`**, no \`@ExtendWith(SpringExtension.class)\`, and no
  application context. This test starts in under 100 ms.

The \`verify\` method checks that a mock method was called:

~~~java
verify(repository).findById(1L);         // was called exactly once with argument 1L
verify(repository, never()).save(any()); // was never called
~~~`,
    },
    {
      id: 'webmvctest',
      heading: '@WebMvcTest — testing your controller without starting a server',
      body: `\`@WebMvcTest\` is a **slice annotation**. It tells Spring Boot: "start only the web layer —
the \`DispatcherServlet\`, controllers, filters, and JSON serialization. Do not start JPA,
do not scan service or repository beans."

Because the scope is small, startup is fast. Any bean the controller depends on (typically
a service) is **not** loaded automatically — you must supply it as a mock.

In Spring Boot 4, use **\`@MockitoBean\`** (from
\`org.springframework.test.context.bean.override.mockito\`) to register a mock in the Spring
context. This is the replacement for the now-deprecated \`@MockBean\`.

Spring also auto-configures a \`MockMvc\` bean in a \`@WebMvcTest\`. \`MockMvc\` lets you perform
HTTP requests **in-process** — no real network, no real HTTP server:

~~~java
@WebMvcTest(BookController.class)      // load only BookController and the web layer
class BookControllerTest {

    @Autowired
    private MockMvc mockMvc;            // injected automatically by @WebMvcTest

    @MockitoBean                        // Spring Boot 4 replacement for @MockBean
    private BookService bookService;   // the real BookService is not loaded; this mock is

    @Test
    void getBook_returns200WithBody() throws Exception {
        var book = new BookDto(1L, "Clean Code", "Robert Martin");
        when(bookService.findById(1L)).thenReturn(Optional.of(book));

        mockMvc.perform(
                get("/books/{id}", 1L)
                    .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())                           // HTTP 200
            .andExpect(jsonPath("$.title").value("Clean Code"))   // JSON field check
            .andExpect(jsonPath("$.author").value("Robert Martin"));
    }

    @Test
    void getBook_returns404WhenNotFound() throws Exception {
        when(bookService.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/books/{id}", 99L))
            .andExpect(status().isNotFound());   // HTTP 404
    }
}
~~~

**Reading the fluent API:**

- \`mockMvc.perform(...)\` — executes a synthetic HTTP request.
- \`MockMvcRequestBuilders.get("/books/{id}", 1L)\` — builds a GET request.
- \`.andExpect(status().isOk())\` — asserts the HTTP status code.
- \`.andExpect(jsonPath("$.title").value("Clean Code"))\` — asserts a JSON field using
  Jayway JSONPath syntax. \`$\` is the root object; \`$.field\` accesses a top-level field.

**Important:** \`MockMvc\` is in-process. There is no TCP connection, no port, no thread pool.
The request goes straight through the \`DispatcherServlet\`. This is why it is fast.`,
    },
    {
      id: 'datajpatest',
      heading: '@DataJpaTest — testing your repository against a real (in-memory) database',
      body: `\`@DataJpaTest\` is another slice annotation. It configures:

- An **in-memory H2 database** (by default).
- Hibernate / Spring Data JPA.
- The \`@Entity\` classes and \`@Repository\` interfaces in your project.

It does **not** load controllers, services, or anything else. It also applies \`@Transactional\`
to every test method automatically, which means all rows written during a test are **rolled
back** after the test finishes — no cleanup needed.

\`TestEntityManager\` is a test-only wrapper around the JPA \`EntityManager\`. Use it to seed
data without calling the repository you are testing (that keeps setup and assertion separate):

~~~java
@DataJpaTest
class BookRepositoryTest {

    @Autowired
    private TestEntityManager em;         // for seeding data

    @Autowired
    private BookRepository repository;    // the repository we are testing

    @Test
    void findByAuthor_returnsMatchingBooks() {
        // Seed — use TestEntityManager, not the repository
        em.persist(new Book(null, "Clean Code",     "Robert Martin"));
        em.persist(new Book(null, "Clean Coder",    "Robert Martin"));
        em.persist(new Book(null, "Domain-Driven Design", "Eric Evans"));
        em.flush();    // write to the in-memory DB
        em.clear();    // evict from the first-level cache so the query hits the DB

        // Act
        List<Book> results = repository.findByAuthor("Robert Martin");

        // Assert
        assertThat(results).hasSize(2)
            .extracting(Book::title)
            .containsExactlyInAnyOrder("Clean Code", "Clean Coder");
    }
}
~~~

Why \`em.flush()\` and \`em.clear()\`? Without \`flush\`, Hibernate might not have sent the SQL
\`INSERT\`s to the database yet. Without \`clear\`, Hibernate can satisfy the query from its
in-memory cache rather than executing SQL — which means you would never test your query.
Calling both ensures your \`@Query\` or derived method name is actually exercised.`,
    },
    {
      id: 'springboottest',
      heading: '@SpringBootTest — the full integration test (use sparingly)',
      body: `\`@SpringBootTest\` loads the **complete \`ApplicationContext\`** — every bean, every
autoconfiguration, your datasource, your security config, everything. It is the most
realistic test environment, and the slowest.

~~~java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApplicationSmokeTest {

    @Autowired
    private TestRestTemplate restTemplate;    // real HTTP client

    @Test
    void contextLoads_and_healthEndpointResponds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
~~~

\`webEnvironment = RANDOM_PORT\` starts a real embedded server on an available port.
\`TestRestTemplate\` is a test-friendly HTTP client that knows the server's base URL.

**When to use \`@SpringBootTest\`:**

- One "smoke test" per application: verify the context starts and the health endpoint works.
- Tests that span the entire stack (controller → service → repository → database) for
  critical flows where you need to be sure all the wiring is correct.
- Avoid using it for testing a single controller or a single repository — that is exactly
  what \`@WebMvcTest\` and \`@DataJpaTest\` are for.

**Why not use it for everything?** Each \`@SpringBootTest\` configuration that differs from
others causes Spring to start a **new** application context. A suite of twenty classes each
using \`@SpringBootTest\` with slightly different mocks or properties can boot the context
twenty times. At ten seconds per boot, that is over three minutes just for context startup.`,
    },
    {
      id: 'context-cache',
      heading: 'Going deeper: the context cache and Testcontainers',
      body: `**The Spring test context cache.** Spring caches the \`ApplicationContext\` and reuses it
across test classes that share an identical configuration (same annotations, same active
profiles, same properties, same mocked beans). This is why slice tests are relatively cheap
even when you have many of them: all \`@DataJpaTest\` classes without extra configuration share
one context.

Things that **break** the cache and force a new context boot:

- Adding \`@MockitoBean\` on different beans in different test classes that share a base context.
- Using \`@DirtiesContext\` (marks the context dirty — a sledgehammer, avoid it unless truly
  necessary).
- Different \`@ActiveProfiles\` or \`@TestPropertySource\` values.

**Testcontainers.** The H2 in-memory database used by \`@DataJpaTest\` is convenient, but it
is not the database you run in production. **Testcontainers** is a library that starts
real database containers (PostgreSQL, MySQL, MongoDB, …) in Docker for tests. You declare a
\`@Container\` static field, and \`@DynamicPropertySource\` wires its connection URL into
Spring's datasource before the context starts:

~~~java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class BookRepositoryContainerTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void overrideDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",      postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private BookRepository repository;

    @Test
    void save_assignsId() {
        var saved = repository.save(new Book(null, "Effective Java", "Joshua Bloch"));
        assertThat(saved.id()).isNotNull();
    }
}
~~~

Testcontainers reuses the running container across all tests in the same JVM process, so
you pay the Docker startup cost once per suite run, not once per test class.`,
    },
    {
      id: 'choosing-the-right-test',
      heading: 'Choosing the right test type: a quick decision guide',
      body: `When you sit down to write a new test, ask yourself one question: **what is the
smallest context that proves what I need to prove?**

~~~text
What are you testing?              Use
─────────────────────────────────  ──────────────────────────────────────────
A service class in isolation       @ExtendWith(MockitoExtension.class) + @Mock
A controller's HTTP mapping        @WebMvcTest + MockMvc + @MockitoBean
A repository's derived query       @DataJpaTest + TestEntityManager
The full request/response flow     @SpringBootTest (use sparingly)
~~~

Some rules of thumb that will save you pain:

1. **Never mock the class under test.** \`@Mock private BookService bookService\` alongside
   \`@InjectMocks private BookService service\` is a common mistake — the test then verifies
   the mock, not the real code. Mock the *dependencies*, inject into the *real class*.

2. **\`@MockitoBean\` replaces \`@MockBean\`.** In Spring Boot 4, \`@MockBean\` is deprecated.
   Always import from \`org.springframework.test.context.bean.override.mockito\`.

3. **Prefer the smallest slice.** If \`@WebMvcTest\` is enough, do not reach for
   \`@SpringBootTest\`. If plain Mockito is enough, do not reach for \`@WebMvcTest\`.`,
    },
  ],
  exercises: [
    {
      id: 'unit-test-service',
      title: 'Plain Mockito unit test of a service',
      difficulty: 'warmup',
      prompt: `You are given a \`BookService\` that depends on a \`BookRepository\`. Your task is to
write a **pure Mockito unit test** — no Spring, no application context.

The test must cover two scenarios:

1. When the repository finds a book by its ISBN, the service returns it (wrapped in an
   \`Optional\`).
2. When the repository finds nothing, the service returns an empty \`Optional\`.

Additionally, after scenario 1, verify that \`repository.findByIsbn\` was called **exactly
once** with the correct ISBN.

**Requirements:**
- Use \`@ExtendWith(MockitoExtension.class)\`.
- Use \`@Mock\` for the repository and \`@InjectMocks\` for the service.
- Use AssertJ (\`assertThat\`) for assertions.
- No \`@SpringBootTest\`, no \`@WebMvcTest\`, no \`@DataJpaTest\`.`,
      starter: `// ── Domain (provided, do not modify) ─────────────────────────────────────────
// public record Book(Long id, String title, String isbn) {}
//
// public interface BookRepository {
//     Optional<Book> findByIsbn(String isbn);
// }
//
// @Service
// public class BookService {
//     private final BookRepository repository;
//     public BookService(BookRepository repository) {
//         this.repository = repository;
//     }
//     public Optional<Book> findByIsbn(String isbn) {
//         return repository.findByIsbn(isbn);
//     }
// }

// ── Your test ────────────────────────────────────────────────────────────────
package com.example.books;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// TODO 1: add the @ExtendWith annotation to activate Mockito
class BookServiceTest {

    // TODO 2: declare a @Mock field for BookRepository

    // TODO 3: declare an @InjectMocks field for BookService

    @Test
    void findByIsbn_returnsBookWhenFound() {
        // TODO 4: create a Book instance and stub repository.findByIsbn to return it

        // TODO 5: call service.findByIsbn and assert the result is present with the right title

        // TODO 6: verify that repository.findByIsbn was called once with the correct ISBN
    }

    @Test
    void findByIsbn_returnsEmptyWhenNotFound() {
        // TODO 7: stub repository.findByIsbn to return Optional.empty()

        // TODO 8: call service.findByIsbn and assert the result is empty
    }
}`,
      hints: [
        'Put \`@ExtendWith(MockitoExtension.class)\` on the class itself, just above \`class BookServiceTest {\`. This tells JUnit 5 to process Mockito annotations before each test.',
        'Stub the repository with \`when(repository.findByIsbn("978-0-13-468599-1")).thenReturn(Optional.of(book));\` before calling the service.',
        '\`verify(repository).findByIsbn("978-0-13-468599-1");\` checks the method was called exactly once. Place it after the \`service.findByIsbn()\` call.',
      ],
      solution: `package com.example.books;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookServiceTest {

    @Mock
    private BookRepository repository;

    @InjectMocks
    private BookService service;

    @Test
    void findByIsbn_returnsBookWhenFound() {
        var isbn = "978-0-13-468599-1";
        var book = new Book(1L, "Effective Java", isbn);
        when(repository.findByIsbn(isbn)).thenReturn(Optional.of(book));

        var result = service.findByIsbn(isbn);

        assertThat(result).isPresent();
        assertThat(result.get().title()).isEqualTo("Effective Java");
        verify(repository).findByIsbn(isbn);
    }

    @Test
    void findByIsbn_returnsEmptyWhenNotFound() {
        var isbn = "000-0-00-000000-0";
        when(repository.findByIsbn(isbn)).thenReturn(Optional.empty());

        var result = service.findByIsbn(isbn);

        assertThat(result).isEmpty();
    }
}`,
      explanation: `**\`@ExtendWith(MockitoExtension.class)\`** is the entry point for JUnit 5 + Mockito.
It processes \`@Mock\` and \`@InjectMocks\` before each test method.

**\`@Mock\`** creates a Mockito-managed fake that records all calls and returns default values
(\`null\`, \`0\`, \`false\`) unless you stub specific calls with \`when(...).thenReturn(...)\`.

**\`@InjectMocks\`** creates the **real** \`BookService\` and injects the \`@Mock\`-annotated
fields into it. Because \`BookService\` uses constructor injection, Mockito finds the
\`BookRepository\` parameter and passes in the mock automatically.

**\`verify\`** — after calling the service, \`verify(repository).findByIsbn(isbn)\` asserts that
the mock's \`findByIsbn\` method was called exactly once with that argument. This catches bugs
where the service might, for example, call \`findById\` instead of \`findByIsbn\`.

The whole test runs without starting Spring. You will notice the IDE feedback is instant.`,
    },
    {
      id: 'webmvctest-controller',
      title: '@WebMvcTest with MockMvc and @MockitoBean',
      difficulty: 'core',
      prompt: `You are given a \`BookController\` that handles \`GET /books/{id}\`. It delegates to
\`BookService\`. Your task is to write a **\`@WebMvcTest\`** test covering two scenarios:

1. When the service finds the book, the endpoint returns **HTTP 200** and a JSON body with
   the correct \`title\` and \`author\` fields.
2. When the service returns \`Optional.empty()\`, the endpoint returns **HTTP 404**.

**Requirements:**
- Use \`@WebMvcTest(BookController.class)\`.
- Inject \`MockMvc\` with \`@Autowired\`.
- Use **\`@MockitoBean\`** (not \`@MockBean\`) to mock \`BookService\`.
- Assert the HTTP status with \`status().isOk()\` or \`status().isNotFound()\`.
- Assert JSON body fields with \`jsonPath\`.
- Set the \`Accept\` header to \`APPLICATION_JSON\`.`,
      starter: `// ── Domain (provided, do not modify) ─────────────────────────────────────────
// public record BookDto(Long id, String title, String author) {}
//
// @Service
// public class BookService {
//     public Optional<BookDto> findById(Long id) { /* real impl */ }
// }
//
// @RestController
// @RequestMapping("/books")
// public class BookController {
//     private final BookService bookService;
//     public BookController(BookService bookService) {
//         this.bookService = bookService;
//     }
//
//     @GetMapping("/{id}")
//     public ResponseEntity<BookDto> getBook(@PathVariable Long id) {
//         return bookService.findById(id)
//             .map(ResponseEntity::ok)
//             .orElse(ResponseEntity.notFound().build());
//     }
// }

// ── Your test ────────────────────────────────────────────────────────────────
package com.example.books;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// TODO 1: add @WebMvcTest(BookController.class)
class BookControllerTest {

    // TODO 2: @Autowired MockMvc mockMvc;

    // TODO 3: @MockitoBean BookService bookService;

    @Test
    void getBook_returns200WithJsonBody() throws Exception {
        // TODO 4: stub bookService.findById(1L) to return Optional.of(new BookDto(...))

        // TODO 5: perform GET /books/1 with Accept: application/json
        // TODO 6: andExpect status 200
        // TODO 7: andExpect jsonPath("$.title") equals the title you stubbed
        // TODO 8: andExpect jsonPath("$.author") equals the author you stubbed
    }

    @Test
    void getBook_returns404WhenNotFound() throws Exception {
        // TODO 9: stub bookService.findById(99L) to return Optional.empty()

        // TODO 10: perform GET /books/99
        // TODO 11: andExpect status 404
    }
}`,
      hints: [
        '\`@WebMvcTest(BookController.class)\` goes on the class, just like \`@ExtendWith\`. Spring will load only the controller and the web layer.',
        'The \`@MockitoBean\` field must be the same type as the bean the controller depends on: \`@MockitoBean private BookService bookService;\`. Spring Boot 4 registers this as a mock in the application context and resets it between tests.',
        'For the 200 case, the full perform call looks like: \`mockMvc.perform(get("/books/{id}", 1L).accept(MediaType.APPLICATION_JSON)).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Effective Java"));\`',
      ],
      solution: `package com.example.books;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(BookController.class)
class BookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BookService bookService;

    @Test
    void getBook_returns200WithJsonBody() throws Exception {
        var dto = new BookDto(1L, "Effective Java", "Joshua Bloch");
        when(bookService.findById(1L)).thenReturn(Optional.of(dto));

        mockMvc.perform(
                get("/books/{id}", 1L)
                    .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Effective Java"))
            .andExpect(jsonPath("$.author").value("Joshua Bloch"));
    }

    @Test
    void getBook_returns404WhenNotFound() throws Exception {
        when(bookService.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/books/{id}", 99L))
            .andExpect(status().isNotFound());
    }
}`,
      explanation: `**\`@WebMvcTest(BookController.class)\`** tells Spring Boot to start only the web layer.
The \`DispatcherServlet\`, \`BookController\`, and Jackson (for JSON serialisation) are loaded.
\`BookService\` is **not** loaded — you must provide it as a \`@MockitoBean\`.

**\`@MockitoBean\`** (package \`org.springframework.test.context.bean.override.mockito\`) is the
Spring Boot 4 replacement for \`@MockBean\`. It registers a Mockito mock in the
\`BeanFactory\`, so the controller's constructor injection succeeds, and it automatically
resets the mock between tests.

**\`MockMvc\`** is injected automatically by the \`@WebMvcTest\` infrastructure. The
\`mockMvc.perform(...)\` call sends a synthetic request through the dispatcher — no network,
no port, no server.

**\`jsonPath\`** uses Jayway JSONPath. \`$\` is the root; \`$.title\` accesses the top-level
\`title\` field. For nested objects use \`$.author.lastName\`; for arrays use \`$.items[0].name\`.

The 404 test does not assert the body — only the status. \`BookController\` returns an empty
\`ResponseEntity.notFound().build()\`, which has no body, so there is nothing to assert.`,
    },
    {
      id: 'datajpatest-repository',
      title: '@DataJpaTest — verify a derived query method against seeded data',
      difficulty: 'core',
      prompt: `You are given a \`BookRepository\` with a derived query method \`findByAuthor(String author)\`.
Your task is to write a **\`@DataJpaTest\`** test that verifies the method works correctly.

The test must:

1. Use \`TestEntityManager\` to seed three books: two by "Joshua Bloch" and one by
   "Brian Goetz".
2. Call \`repository.findByAuthor("Joshua Bloch")\`.
3. Assert that exactly **two** books are returned.
4. Assert that both returned books have \`author\` equal to "Joshua Bloch".

**Requirements:**
- Use \`@DataJpaTest\` (default in-memory H2 database, no extra annotations needed).
- Call \`em.flush()\` and \`em.clear()\` after persisting so the query hits the database.
- Use AssertJ.
- Do **not** use \`repository.save\` for seeding — use \`em.persist\`.`,
      starter: `// ── Domain (provided, do not modify) ─────────────────────────────────────────
// @Entity
// public class Book {
//     @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
//     private Long id;
//     private String title;
//     private String author;
//     public Book() {}
//     public Book(Long id, String title, String author) { ... }
//     // getters …
// }
//
// public interface BookRepository extends JpaRepository<Book, Long> {
//     List<Book> findByAuthor(String author);
// }

// ── Your test ────────────────────────────────────────────────────────────────
package com.example.books;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// TODO 1: add @DataJpaTest
class BookRepositoryTest {

    // TODO 2: @Autowired TestEntityManager em;

    // TODO 3: @Autowired BookRepository repository;

    @Test
    void findByAuthor_returnsOnlyMatchingBooks() {
        // TODO 4: persist Book("Effective Java", "Joshua Bloch")
        // TODO 5: persist Book("Java Puzzlers", "Joshua Bloch")
        // TODO 6: persist Book("Java Concurrency in Practice", "Brian Goetz")
        // TODO 7: em.flush() and em.clear()

        // TODO 8: call repository.findByAuthor("Joshua Bloch")

        // TODO 9: assert size == 2
        // TODO 10: assert all returned books have author "Joshua Bloch"
    }
}`,
      hints: [
        '\`em.persist(new Book(null, "Effective Java", "Joshua Bloch"))\` — pass \`null\` for the id so the database assigns it (GenerationType.IDENTITY).',
        'Call \`em.flush()\` immediately after the last \`em.persist\` call, then \`em.clear()\`. Without these two calls, Hibernate may answer the query from its in-memory cache instead of running SQL.',
        'AssertJ: \`assertThat(results).hasSize(2)\` checks the count. \`assertThat(results).extracting(Book::getAuthor).containsOnly("Joshua Bloch")\` checks every element at once.',
      ],
      solution: `package com.example.books;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class BookRepositoryTest {

    @Autowired
    private TestEntityManager em;

    @Autowired
    private BookRepository repository;

    @Test
    void findByAuthor_returnsOnlyMatchingBooks() {
        em.persist(new Book(null, "Effective Java",                "Joshua Bloch"));
        em.persist(new Book(null, "Java Puzzlers",                 "Joshua Bloch"));
        em.persist(new Book(null, "Java Concurrency in Practice",  "Brian Goetz"));
        em.flush();   // send INSERT statements to the in-memory DB
        em.clear();   // evict from first-level cache

        List<Book> results = repository.findByAuthor("Joshua Bloch");

        assertThat(results).hasSize(2);
        assertThat(results)
            .extracting(Book::getAuthor)
            .containsOnly("Joshua Bloch");
    }
}`,
      explanation: `**\`@DataJpaTest\`** configures an in-memory H2 database, Hibernate, and Spring Data JPA.
It does not load controllers, services, or any other beans. Every test method is
\`@Transactional\` by default — all rows are rolled back after the test, so there is no
cleanup code needed.

**\`TestEntityManager\`** is the test wrapper around the JPA \`EntityManager\`. Using it for
seeding (instead of the repository under test) separates setup from the system under test.
If \`repository.save\` were broken, using it to seed would mask the real bug.

**\`em.flush()\`** forces Hibernate to send the pending SQL \`INSERT\` statements to the
database immediately. Without it, Hibernate may batch writes until the transaction commits.

**\`em.clear()\`** evicts all managed entities from the first-level (session-level) cache.
Without it, when \`repository.findByAuthor\` runs, Hibernate can return the persisted
entities directly from the cache without running any SQL at all. The derived query method
\`findByAuthor\` would pass trivially — but only because the cache answered, not because
your query definition is correct.

**AssertJ \`extracting\`** is a concise way to project a list of objects to one of their
fields and then assert on the projected values.`,
    },
    {
      id: 'springboottest-integration',
      title: 'Challenge: a full @SpringBootTest integration test',
      difficulty: 'challenge',
      prompt: `Now that you have practised unit tests and slice tests, write a **\`@SpringBootTest\`**
integration test. This is the top of the pyramid — use it sparingly.

The test must:

1. Start the application with a real embedded server (\`RANDOM_PORT\`).
2. Use \`TestRestTemplate\` to send a real HTTP request to \`GET /books\`.
3. Assert the response status is \`200 OK\`.
4. Assert the response body is a JSON array (even if it is empty).

**Why is this exercise a challenge?**  Not because the code is hard to write — it is
actually simpler than a \`@WebMvcTest\` test. The challenge is understanding **why** you
should keep tests like this rare and what trade-offs you are accepting.

After writing the test, add a comment answering: *"If you had 50 tests written this way,
what would happen to your build time, and what would you do instead?"*

**Requirements:**
- Use \`@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)\`.
- Inject \`TestRestTemplate\` with \`@Autowired\`.
- Use AssertJ for assertions.
- Your application must have at least a \`GET /books\` endpoint returning an array (use the
  same \`BookController\` from exercise b, backed by a real or in-memory database).`,
      starter: `package com.example.books;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

// TODO 1: add @SpringBootTest with webEnvironment = RANDOM_PORT
class BookIntegrationTest {

    // TODO 2: @Autowired TestRestTemplate restTemplate;

    @Test
    void getBooks_returns200AndJsonArray() {
        // TODO 3: call restTemplate.getForEntity("/books", String.class)

        // TODO 4: assert response.getStatusCode() equals HttpStatus.OK

        // TODO 5: assert response.getBody() starts with "[" (it is a JSON array)
    }

    // TODO 6: add a comment — what would happen with 50 tests like this?
}`,
      hints: [
        '\`TestRestTemplate\` knows the base URL of the running server automatically — just provide the path: \`restTemplate.getForEntity("/books", String.class)\`.',
        'A JSON array response body starts with \`[\`. You can assert it with \`assertThat(body).startsWith("[");\`.',
        'With 50 tests like this, each context boot takes ~5–15 s. If they all share the same context configuration, Spring caches it and you pay the cost once. If they differ (different mocks, different profiles), you pay it 50 times. The right answer is: move everything you can to \`@WebMvcTest\` or \`@DataJpaTest\`, and keep \`@SpringBootTest\` only for the critical integration paths.',
      ],
      solution: `package com.example.books;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

// If you had 50 tests written this way with different @MockitoBean or @ActiveProfiles
// configurations, Spring would have to start a new ApplicationContext for each unique
// configuration. At ~10 seconds per boot, that is over 8 minutes just for context
// startup — before a single test assertion runs. The fix: push everything that can be
// tested in isolation down to @WebMvcTest or @DataJpaTest, and use @SpringBootTest
// only for the small number of tests that genuinely need the full stack.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BookIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void getBooks_returns200AndJsonArray() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/books", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).startsWith("[");
    }
}`,
      explanation: `\`@SpringBootTest(webEnvironment = RANDOM_PORT)\` starts the complete application on a
random available port. \`TestRestTemplate\` is autoconfigured with the server's base URL, so
you only need to provide the path.

This test is realistic: it exercises the full stack — controller, service, repository,
database, HTTP serialisation — in one go. That is also its cost. If this is the only
\`@SpringBootTest\` in your suite, Spring starts the context once and caches it. If you add
a second test class with slightly different configuration (say, a different \`@MockitoBean\`),
Spring starts a **second** context.

**The key lesson:** \`@SpringBootTest\` is not wrong — it is the right tool for integration
seams. The mistake is using it as the default for every test. The slice tests you wrote in
exercises (a), (b), and (c) gave you the same level of confidence for their layers in a
fraction of the time. Use the smallest tool that proves what you need to prove.`,
    },
  ],
  takeaways: [
    'Use the **test pyramid**: pure Mockito unit tests at the base (milliseconds, no Spring), slice tests (\`@WebMvcTest\`, \`@DataJpaTest\`) in the middle (seconds), and a small number of \`@SpringBootTest\` integration tests at the top.',
    'A service with constructor-injected dependencies needs only \`@ExtendWith(MockitoExtension.class)\`, \`@Mock\` for each dependency, and \`@InjectMocks\` for the class under test — no Spring context at all.',
    '\`@WebMvcTest\` loads only the web layer; \`@DataJpaTest\` loads only the persistence layer. Both are fast because they skip the rest of the application context.',
    '\`@MockitoBean\` is the Spring Boot 4 replacement for the deprecated \`@MockBean\` — import it from \`org.springframework.test.context.bean.override.mockito\`.',
    'In a \`@DataJpaTest\`, always call \`em.flush()\` then \`em.clear()\` after seeding with \`TestEntityManager\` so your query actually hits the database rather than Hibernate\'s first-level cache.',
    '\`@SpringBootTest\` loads the entire application context; use it for smoke tests and critical end-to-end paths, not as the default for every test — each unique configuration starts a separate context and adds seconds to your build.',
    '**Never mock the class under test.** \`@Mock\` should only be used for the *dependencies*; \`@InjectMocks\` creates the real class. Mocking the class under test produces a test that verifies nothing about your production code.',
  ],
}
