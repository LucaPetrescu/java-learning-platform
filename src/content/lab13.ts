import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//  - Spring placeholders (\${...}) are written \${ inside template literals.
//
// Audience: developers who know core Java well but are brand new to Spring /
// Spring Boot. Theory introduces every concept from scratch, explains the
// "magic", and builds understanding step by step. Exercises are guided and
// foundational — no gotcha puzzles up front.

export const lab13: Lab = {
  id: 'lab-13',
  number: 13,
  track: 'spring',
  title: 'Spring Core — IoC & Dependency Injection',
  subtitle: 'What the container is, why it exists, and how to wire your first beans',
  estimatedHours: 6,
  concepts: [
    'Inversion of Control',
    'Dependency Injection',
    'ApplicationContext',
    '@Component stereotypes',
    '@Bean / @Configuration',
    'component scanning',
    'constructor injection',
    '@Autowired',
    '@Qualifier',
    '@Primary',
    'bean scopes',
    '@PostConstruct',
  ],
  overview: `You already know how to write Java classes and call \`new\`. This lab introduces
**Spring Core** — the part of the framework responsible for creating objects, connecting
them together, and managing their lifetimes. These ideas are called **Inversion of
Control** and **Dependency Injection**, and they are the foundation everything else in
Spring builds on.

We start from zero. Every Spring annotation is introduced and explained before it appears
in code. By the end of the lab you will be able to:

- Explain what the Spring container is and what problem it solves.
- Declare beans with \`@Component\` (and its stereotype aliases) and with \`@Bean\` inside a
  \`@Configuration\` class.
- Inject dependencies via constructor injection and understand why it is the recommended style.
- Resolve ambiguous beans with \`@Qualifier\` and \`@Primary\`.
- Know the default bean scope (singleton) and what a prototype scope is.
- Use \`@PostConstruct\` for initialisation logic that needs collaborators.

All code targets **Spring Boot 4 / Java 21**. Add the starters you need to \`pom.xml\`
(\`spring-boot-starter-webmvc\` for web, etc.) and use \`jakarta.*\` imports wherever
Jakarta EE types appear.`,

  theory: [
    {
      id: 'ioc-explained',
      heading: 'What is Inversion of Control — and why should you care?',
      body: `Before Spring, a class that needed a collaborator would create it:

~~~java
// Traditional approach: the class is in charge of its own dependencies
public class OrderService {
    private final PaymentGateway gateway = new StripeGateway(); // hard-coded
}
~~~

This seems fine until you need to:
- **Test \`OrderService\` in isolation** — you cannot swap in a fake gateway without
  changing the source code.
- **Switch from Stripe to PayPal** — you have to find every \`new StripeGateway()\` call and
  update it.
- **Apply cross-cutting concerns** (logging, transactions) transparently — hard when the
  object creates its own collaborators.

**Inversion of Control (IoC)** flips this relationship. Instead of the class creating its
own dependencies, something external — the **container** — creates the objects and hands
them in:

~~~java
// With IoC: the class declares what it needs; the container decides what to provide
public class OrderService {
    private final PaymentGateway gateway; // declared as a need, not a creation

    public OrderService(PaymentGateway gateway) {
        this.gateway = gateway; // received from outside — "injected"
    }
}
~~~

Passing a dependency in from outside is called **Dependency Injection (DI)**. Spring is a
DI container: it creates your objects, figures out what they need, and injects the right
collaborators automatically.

**Why this matters:**

| Without IoC | With IoC |
|---|---|
| Classes create their collaborators | Container creates all objects |
| Hard to test in isolation | Swap any dependency in a test with \`new MyService(mockGateway)\` |
| Config spread across many classes | Centralised in the container |
| Circular wiring is your problem | Container detects cycles at startup |

> Core Java analogy: think of IoC like a factory method pattern — but instead of one
> method, the container manages the entire object graph for the whole application.`,
    },
    {
      id: 'application-context',
      heading: 'The Spring Container — ApplicationContext',
      body: `Spring's container is represented by the \`ApplicationContext\` interface. It is the
central registry that:

1. **Discovers** classes you have marked as Spring beans.
2. **Creates** instances of those classes (respecting the right order and scope).
3. **Injects** each bean's dependencies into it.
4. **Manages** the lifecycle: calls init callbacks, holds the bean for the app's lifetime,
   and calls destroy callbacks on shutdown.

In a Spring Boot application the context is bootstrapped automatically by
\`SpringApplication.run()\` — you rarely need to touch it directly:

~~~java
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
        // The ApplicationContext is now up, all beans are wired and ready.
    }
}
~~~

**What is a bean?** Any object that is managed by the Spring container is called a
**bean**. Beans are created by the container, not by \`new\`. Once registered, any other
bean can ask the container for a bean of a given type and receive the same instance.

~~~java
// You can hold a reference to the context if you need it,
// but in practice you rarely do — injection handles everything.
@Component
public class Diagnostics {

    private final ApplicationContext ctx;

    public Diagnostics(ApplicationContext ctx) { // the context itself is injectable!
        this.ctx = ctx;
    }

    public void printBeanCount() {
        System.out.println("Beans in context: " + ctx.getBeanDefinitionCount());
    }
}
~~~

> **BeanFactory vs ApplicationContext:** \`BeanFactory\` is the low-level parent interface —
> it is lazy (creates beans on demand) and has no enterprise features. \`ApplicationContext\`
> extends it and adds: eager singleton creation at startup, AOP proxy support, event
> publishing, i18n, and environment/property abstraction. Always use \`ApplicationContext\` in
> real applications; \`BeanFactory\` is mostly historical.`,
    },
    {
      id: 'declaring-beans',
      heading: 'Declaring Beans — @Component Stereotypes and @Bean',
      body: `There are two main ways to register a bean with the Spring container.

---

### Way 1 — @Component (and its aliases)

Annotate your own class and Spring will discover and register it automatically during
**component scanning** (explained in the next section).

~~~java
import org.springframework.stereotype.Component;

@Component                          // marks this class as a Spring-managed bean
public class EmailClient {
    public void send(String address, String body) {
        System.out.println("Sending to " + address + ": " + body);
    }
}
~~~

Spring provides three **stereotype** aliases that carry the same DI behaviour but add
semantic meaning:

~~~java
@Service        // signals: this class holds business logic
@Repository     // signals: this class accesses a data store
                //   (also enables Spring's persistence-exception translation)
@Controller     // signals: this is a Spring MVC web controller
@RestController // shorthand for @Controller + @ResponseBody
~~~

All four are functionally equivalent for dependency injection purposes. Use the most
specific one that fits the role — it helps readers and tools understand the layer.

---

### Way 2 — @Bean inside a @Configuration class

Use this when you **do not own the class** (e.g. a third-party library), or when
construction logic is complex:

~~~java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration                          // marks this as a source of bean definitions
public class InfraConfig {

    @Bean                               // each method registers one bean
    public RestClient restClient() {
        return RestClient.builder()
            .baseUrl("https://api.example.com")
            .defaultHeader("Accept", "application/json")
            .build();
    }
}
~~~

The method return type determines what type the bean is registered under. Method
parameters are automatically injected by the container (just like constructor injection).

**Quick decision guide:**

| Situation | Use |
|---|---|
| You wrote the class | \`@Component\` / stereotype |
| Third-party class you don't own | \`@Bean\` in \`@Configuration\` |
| Complex or conditional construction | \`@Bean\` in \`@Configuration\` |
| Multiple beans of the same type | \`@Bean\` (one method per bean) |`,
    },
    {
      id: 'component-scanning',
      heading: 'How Spring Finds Your Beans — Component Scanning',
      body: `When you annotate a class with \`@Component\` (or a stereotype), Spring does not
automatically discover it. You have to enable **component scanning** — telling Spring
which packages to search.

In a Spring Boot application \`@SpringBootApplication\` already includes
\`@ComponentScan\`, which scans the package the annotated class is in and all
sub-packages recursively. This is why the convention is to put your main class at the
root of your package tree:

~~~text
com.example.myapp
├── App.java               ← @SpringBootApplication here
├── service
│   └── OrderService.java  ← @Service — found automatically
├── repository
│   └── OrderRepo.java     ← @Repository — found automatically
└── config
    └── InfraConfig.java   ← @Configuration — found automatically
~~~

~~~java
package com.example.myapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication  // includes @ComponentScan("com.example.myapp")
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}
~~~

If you ever place a bean outside the scanned package it will not be found and Spring will
throw \`NoSuchBeanDefinitionException\` when something tries to inject it. Keep your
classes inside the application's root package or adjust the scan with
\`@ComponentScan(basePackages = "...")\`.

**Bean naming:** by default the bean name is the uncapitalized class name. \`EmailClient\`
becomes \`"emailClient"\`, \`OrderService\` becomes \`"orderService"\`. You can override it:
\`@Component("mailer")\`.`,
    },
    {
      id: 'injection-styles',
      heading: 'Three Injection Styles — Use Constructor Injection',
      body: `Spring can inject a bean's dependencies in three ways. We introduce all three so you
recognise them in existing code, then explain clearly which one to use.

---

### Style 1 — Field injection (do not use)

~~~java
@Service
public class NotificationService {

    @Autowired                     // Spring injects directly into the field via reflection
    private EmailClient emailClient;
}
~~~

**Why to avoid it:**
- The field cannot be \`final\` — the object can exist in a partially-initialised state.
- Invisible to callers — there is no way to see from outside that the class needs an
  \`EmailClient\`.
- Unit testing requires a Spring context or reflection magic to inject a mock.

---

### Style 2 — Setter injection (use only for optional dependencies)

~~~java
@Service
public class ReportService {
    private TemplateEngine engine;

    @Autowired(required = false)    // optional: a null engine is handled gracefully
    public void setEngine(TemplateEngine engine) {
        this.engine = engine;
    }
}
~~~

Fine for optional collaborators where a sensible fallback exists. Not appropriate for
mandatory dependencies.

---

### Style 3 — Constructor injection (the standard)

~~~java
@Service
public class OrderService {

    private final PaymentGateway gateway;  // final: immutable after construction
    private final InventoryClient inventory;

    // @Autowired is optional when there is exactly one constructor (Spring 4.3+).
    // Spring injects matching beans for each parameter automatically.
    public OrderService(PaymentGateway gateway, InventoryClient inventory) {
        this.gateway  = gateway;
        this.inventory = inventory;
    }
}
~~~

**Why constructor injection wins:**

1. **Immutability** — fields can be \`final\`. The object is fully valid the moment it
   leaves the constructor.
2. **Mandatory by design** — the compiler refuses to create an \`OrderService\` without
   both arguments. No null surprises at runtime.
3. **Testable without a container** — \`new OrderService(fakeGateway, fakeInventory)\` in a
   plain JUnit test. No Spring context needed.
4. **Circular dependency detection** — if two beans form a cycle via constructors, Spring
   fails at startup with a clear error instead of producing a broken graph silently.

> Going forward, every exercise in this lab uses constructor injection. Make it a habit.`,
    },
    {
      id: 'qualifier-primary',
      heading: 'Multiple Beans of the Same Type — @Qualifier and @Primary',
      body: `When there is exactly one bean of the required type in the context, Spring injects it
without any extra hints. When there are **two or more**, Spring cannot guess which one you
want and throws \`NoUniqueBeanDefinitionException\` at startup.

**Setup — two implementations of one interface:**

~~~java
public interface NotificationSender {
    void send(String message);
}

@Component
public class EmailSender implements NotificationSender {
    @Override
    public void send(String message) {
        System.out.println("[EMAIL] " + message);
    }
}

@Component
public class SmsSender implements NotificationSender {
    @Override
    public void send(String message) {
        System.out.println("[SMS] " + message);
    }
}
~~~

If you now write:

~~~java
@Service
public class AlertService {
    public AlertService(NotificationSender sender) { ... } // which one??
}
~~~

Spring will fail to start. Fix it one of two ways.

---

### Fix 1 — @Primary: mark the default

~~~java
@Primary   // used whenever no qualifier is specified at the injection point
@Component
public class EmailSender implements NotificationSender { ... }
~~~

Now any injection point asking for \`NotificationSender\` without qualification receives
\`EmailSender\` automatically.

---

### Fix 2 — @Qualifier: name the exact bean at the injection point

~~~java
@Service
public class AlertService {
    private final NotificationSender sender;

    // @Qualifier overrides @Primary — gets SmsSender regardless of the default.
    public AlertService(@Qualifier("smsSender") NotificationSender sender) {
        this.sender = sender;
    }
}
~~~

The qualifier string is the bean name. By default the name is the uncapitalized class
name, so \`SmsSender\` becomes \`"smsSender"\`.

---

### The resolution algorithm (in order)

1. If there is exactly one bean of the required type → inject it.
2. If multiple candidates exist and one is \`@Primary\` → inject the primary one.
3. If \`@Qualifier\` is present at the injection point → inject the named bean (overrides
   \`@Primary\`).
4. Otherwise → fail with \`NoUniqueBeanDefinitionException\`.

> **Rule of thumb:** use \`@Primary\` for the "sensible default" used by most consumers;
> use \`@Qualifier\` at the rare injection points that genuinely need a different
> implementation.`,
    },
    {
      id: 'scopes-lifecycle',
      heading: 'Bean Scopes and @PostConstruct',
      body: `### Scopes

Every bean has a **scope** that controls how many instances the container creates and how
long they live.

| Scope | Instances | Lifetime |
|---|---|---|
| \`singleton\` (**default**) | 1 per container | Application lifetime |
| \`prototype\` | New instance per injection or \`getBean()\` call | Caller-managed |
| \`request\` | 1 per HTTP request | Request lifetime (web only) |
| \`session\` | 1 per HTTP session | Session lifetime (web only) |

**Singleton** is almost always what you want. It means there is one shared instance of
the bean for the entire application — efficient and predictable.

**Prototype** creates a brand-new instance every time something asks for the bean:

~~~java
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

@Component
@Scope("prototype")            // a new instance is created on every injection
public class ReportBuilder {
    private final List<String> lines = new ArrayList<>();
    public void addLine(String l) { lines.add(l); }
    public String build() { return String.join("\\n", lines); }
}
~~~

---

### @PostConstruct — initialisation after injection

Sometimes a bean needs to perform setup work that requires its injected collaborators to
be available first. The constructor runs before injection is complete on some edge cases,
so do not put such logic there. Instead use \`@PostConstruct\`:

~~~java
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

@Service
public class CacheService {

    private final DataRepository repository;
    private Map<String, String> cache;

    public CacheService(DataRepository repository) {
        this.repository = repository;
        // Do NOT call repository here in general lifecycle reasoning —
        // @PostConstruct is the safe place.
    }

    @PostConstruct                    // called once, after all injection is complete
    void init() {
        this.cache = repository.loadAll();
        System.out.println("Cache initialised with " + cache.size() + " entries.");
    }

    @PreDestroy                       // called just before the context shuts down
    void cleanup() {
        cache.clear();
    }
}
~~~

\`@PostConstruct\` and \`@PreDestroy\` are from the \`jakarta.annotation\` package (JSR-250).
They decouple your class from Spring-specific interfaces — which is why they are
preferred over \`InitializingBean\` or \`DisposableBean\`.

---

### Going deeper — the prototype-in-singleton caveat (advanced note)

If you inject a \`prototype\`-scoped bean into a \`singleton\` bean, the prototype is
injected **once** at the singleton's construction time and never again — effectively
behaving like a singleton. This surprises many developers. The fix is \`ObjectProvider<T>\`:
inject it into the singleton and call \`provider.getObject()\` each time you need a fresh
prototype. This is an intermediate topic; encounter it when you first hit the symptom.`,
    },
  ],

  exercises: [
    {
      id: 'declare-and-inject-service',
      title: 'Declare a @Service and inject it via constructor',
      difficulty: 'warmup',
      prompt: `In this first exercise you will declare two Spring beans and wire them
together using constructor injection — the most fundamental Spring skill.

**Goal:** build a small greeting system. A \`GreetingFormatter\` bean knows how to format
a greeting string. A \`GreetingService\` bean uses a \`GreetingFormatter\` to produce and
print a greeting.

**Requirements:**

1. Create an interface \`GreetingFormatter\` with a single method:
   \`String format(String name)\`.
2. Create \`FormalGreetingFormatter\` that implements \`GreetingFormatter\` and returns
   \`"Good day, <name>."\`. Annotate it with \`@Component\`.
3. Create \`GreetingService\` annotated with \`@Service\`. Constructor-inject a
   \`GreetingFormatter\`. Add a method \`void greet(String name)\` that calls the formatter
   and prints the result.
4. Write a \`@SpringBootTest\` test that auto-wires \`GreetingService\` and asserts that
   calling \`greet("Alice")\` prints (or returns) the expected string.

All fields in \`GreetingService\` must be \`final\`.`,
      starter: `import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

// TODO 1: Define the GreetingFormatter interface
// interface GreetingFormatter {
//     String format(String name);
// }

// TODO 2: Implement FormalGreetingFormatter — annotate with @Component
// @Component
// public class FormalGreetingFormatter implements GreetingFormatter {
//     ...
// }

// TODO 3: Implement GreetingService
@Service
public class GreetingService {

    // TODO: declare a final field of type GreetingFormatter
    // private final GreetingFormatter formatter;

    // TODO: add a constructor that receives a GreetingFormatter
    // Spring will automatically inject the matching bean.
    // public GreetingService(GreetingFormatter formatter) {
    //     this.formatter = formatter;
    // }

    public void greet(String name) {
        // TODO: use formatter to produce the greeting and print it
    }
}`,
      hints: [
        'Spring looks for beans by type. Because there is only one GreetingFormatter in the context (FormalGreetingFormatter), the constructor parameter is injected automatically — no @Autowired annotation required.',
        'Make the field final: "private final GreetingFormatter formatter;". This is only possible with constructor injection, and it guarantees the service is always fully initialised.',
        'In the test class, add @SpringBootTest and @Autowired GreetingService service; then call service.greet("Alice") and verify the output.',
      ],
      solution: `import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

// ── Interface ────────────────────────────────────────────────────────────────

public interface GreetingFormatter {
    String format(String name);
}

// ── Implementation ───────────────────────────────────────────────────────────

@Component
public class FormalGreetingFormatter implements GreetingFormatter {

    @Override
    public String format(String name) {
        return "Good day, " + name + ".";
    }
}

// ── Service ──────────────────────────────────────────────────────────────────

@Service
public class GreetingService {

    private final GreetingFormatter formatter; // final: immutable after construction

    // Single constructor — @Autowired is implied (Spring Boot 4 / Spring 4.3+)
    public GreetingService(GreetingFormatter formatter) {
        this.formatter = formatter;
    }

    public void greet(String name) {
        System.out.println(formatter.format(name));
    }
}

// ── Test ─────────────────────────────────────────────────────────────────────

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class GreetingServiceTest {

    @Autowired
    GreetingService greetingService;

    @Autowired
    GreetingFormatter formatter;

    @Test
    void formatterIsInjected() {
        // The injected formatter should be the FormalGreetingFormatter
        assertThat(formatter).isInstanceOf(FormalGreetingFormatter.class);
    }

    @Test
    void greetProducesExpectedFormat() {
        // format() is pure — test the formatter directly for precision
        String result = formatter.format("Alice");
        assertThat(result).isEqualTo("Good day, Alice.");
    }
}`,
      explanation: `Spring finds \`FormalGreetingFormatter\` via component scanning (it is annotated
\`@Component\` and lives inside the scanned package). When the container creates
\`GreetingService\` it sees a single constructor that needs a \`GreetingFormatter\` — it
looks in the context, finds exactly one bean of that type, and injects it.

Making the field \`final\` is the most important habit to build. It means the object is
**immutable** after construction: you can reason that the formatter will never be null or
swapped out mid-life. This is only possible with constructor injection.

The test does not use mocks — it lets the full Spring context start and verify real
wiring. For a unit test (no context) you would write:

~~~java
GreetingFormatter fmt = new FormalGreetingFormatter();
GreetingService svc = new GreetingService(fmt); // plain Java, no Spring
svc.greet("Alice");
~~~

Constructor injection makes this trivially easy.`,
    },
    {
      id: 'configuration-class',
      title: 'Wire two collaborators using @Configuration and @Bean',
      difficulty: 'core',
      prompt: `Not all beans come from \`@Component\`. When you cannot annotate a class directly
— or when construction requires multiple steps — you declare beans explicitly in a
\`@Configuration\` class.

**Goal:** build a simple document-processing pipeline. A \`TextNormaliser\` prepares raw
text (e.g. trims whitespace, lower-cases). A \`WordCounter\` counts words in normalised
text. A \`DocumentProcessor\` orchestrates the two.

**Requirements:**

1. Write \`TextNormaliser\` and \`WordCounter\` as plain Java classes — **no Spring
   annotations on them**. Their constructors take no arguments.
2. Write a \`@Configuration\` class \`ProcessingConfig\` that declares:
   - A \`@Bean\` method returning a \`TextNormaliser\`.
   - A \`@Bean\` method returning a \`WordCounter\`.
   - A \`@Bean\` method returning a \`DocumentProcessor\` that receives both as parameters
     (Spring injects them automatically).
3. \`DocumentProcessor\` is annotated \`@Service\` OR declared in the config — your choice.
   It must hold both collaborators as \`final\` fields and expose a method
   \`int process(String rawText)\` that normalises then counts.
4. Write a test that verifies \`process("  Hello World  ")\` returns \`2\`.`,
      starter: `import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;

// ── Plain Java classes (no Spring annotations) ────────────────────────────

class TextNormaliser {
    // TODO: implement String normalise(String raw)
    // Trim whitespace and lower-case the text.
    public String normalise(String raw) {
        return raw; // replace this
    }
}

class WordCounter {
    // TODO: implement int count(String text)
    // Split on whitespace and return the number of tokens.
    public int count(String text) {
        return 0; // replace this
    }
}

// ── Configuration class ───────────────────────────────────────────────────

@Configuration
public class ProcessingConfig {

    // TODO 1: declare a @Bean method for TextNormaliser
    // @Bean
    // public TextNormaliser textNormaliser() { ... }

    // TODO 2: declare a @Bean method for WordCounter
    // @Bean
    // public WordCounter wordCounter() { ... }

    // TODO 3: declare a @Bean method for DocumentProcessor.
    // Add TextNormaliser and WordCounter as parameters — Spring injects them.
    // @Bean
    // public DocumentProcessor documentProcessor(TextNormaliser n, WordCounter c) { ... }
}

// ── DocumentProcessor ─────────────────────────────────────────────────────

public class DocumentProcessor {

    // TODO: final fields for TextNormaliser and WordCounter
    // TODO: constructor
    // TODO: int process(String rawText)
}`,
      hints: [
        'A @Bean method\'s parameters are injected by the container, exactly like constructor parameters. Write "public DocumentProcessor documentProcessor(TextNormaliser normaliser, WordCounter counter)" and Spring supplies both beans.',
        'TextNormaliser.normalise can be: return raw.trim().toLowerCase(); — then WordCounter.count can be: return text.isBlank() ? 0 : text.split("\\\\s+").length;',
        'The test: @SpringBootTest, @Autowired DocumentProcessor processor, then assertThat(processor.process("  Hello World  ")).isEqualTo(2).',
      ],
      solution: `import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// ── Plain Java classes ────────────────────────────────────────────────────

class TextNormaliser {
    public String normalise(String raw) {
        return raw.trim().toLowerCase();
    }
}

class WordCounter {
    public int count(String text) {
        if (text == null || text.isBlank()) return 0;
        return text.split("\\s+").length;
    }
}

// ── DocumentProcessor ─────────────────────────────────────────────────────

public class DocumentProcessor {

    private final TextNormaliser normaliser;
    private final WordCounter counter;

    public DocumentProcessor(TextNormaliser normaliser, WordCounter counter) {
        this.normaliser = normaliser;
        this.counter    = counter;
    }

    public int process(String rawText) {
        String normalised = normaliser.normalise(rawText);
        return counter.count(normalised);
    }
}

// ── Configuration ─────────────────────────────────────────────────────────

@Configuration
public class ProcessingConfig {

    @Bean
    public TextNormaliser textNormaliser() {
        return new TextNormaliser();
    }

    @Bean
    public WordCounter wordCounter() {
        return new WordCounter();
    }

    @Bean
    public DocumentProcessor documentProcessor(TextNormaliser normaliser,
                                               WordCounter counter) {
        // Spring injects the two beans declared above as method parameters.
        return new DocumentProcessor(normaliser, counter);
    }
}

// ── Test ──────────────────────────────────────────────────────────────────

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class DocumentProcessorTest {

    @Autowired
    DocumentProcessor processor;

    @Test
    void countsWordsAfterNormalisation() {
        assertThat(processor.process("  Hello World  ")).isEqualTo(2);
    }

    @Test
    void emptyInputReturnsZero() {
        assertThat(processor.process("   ")).isEqualTo(0);
    }
}`,
      explanation: `\`TextNormaliser\` and \`WordCounter\` are plain Java — no Spring annotations. Spring does
not need to own every class; it only needs to know about the ones registered as beans.
The \`@Configuration\` class is the explicit wiring layer.

When Spring processes \`ProcessingConfig\`, it calls each \`@Bean\` method and registers the
return value. For \`documentProcessor\`, it sees the parameters \`TextNormaliser normaliser\`
and \`WordCounter counter\`, looks them up in the context (they were registered by the
earlier \`@Bean\` methods), and passes them in — exactly like constructor injection.

**Key insight:** \`@Configuration\` + \`@Bean\` is most useful when you do not own the
class (third-party libraries) or when you need conditional logic around construction.
For classes you write yourself, \`@Component\` / \`@Service\` is simpler. The two styles
complement each other.`,
    },
    {
      id: 'qualifier-primary-exercise',
      title: 'Resolve two implementations with @Qualifier and @Primary',
      difficulty: 'core',
      prompt: `When two beans implement the same interface, you must tell Spring which one to
inject where. This exercise practises both resolution mechanisms.

**Scenario:** a small notification system with two senders — email (the default) and SMS
(used only for urgent alerts).

**Requirements:**

1. Define interface \`MessageSender\` with method \`String send(String to, String text)\`
   that returns a confirmation string like \`"[EMAIL] sent to alice@example.com"\`.
2. Implement \`EmailMessageSender\` (annotated \`@Component\`) and \`SmsMessageSender\`
   (annotated \`@Component\`).
3. Mark \`EmailMessageSender\` with \`@Primary\` so it is the default.
4. Create \`UserNotifier\` (\`@Service\`) that constructor-injects a \`MessageSender\` with
   **no qualifier** — it should receive the email sender.
5. Create \`AlertNotifier\` (\`@Service\`) that constructor-injects a \`MessageSender\` with
   \`@Qualifier("smsMessageSender")\` — it should receive the SMS sender.
6. Write a test that verifies:
   - \`UserNotifier\` holds an \`EmailMessageSender\`.
   - \`AlertNotifier\` holds an \`SmsMessageSender\`.`,
      starter: `import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

// TODO 1: Define MessageSender interface
// public interface MessageSender {
//     String send(String to, String text);
// }

// TODO 2: Implement EmailMessageSender — add @Primary so it is the default
// @Primary
// @Component
// public class EmailMessageSender implements MessageSender { ... }

// TODO 3: Implement SmsMessageSender — plain @Component (no @Primary)
// @Component
// public class SmsMessageSender implements MessageSender { ... }

// TODO 4: UserNotifier — inject MessageSender with NO qualifier (gets Email)
@Service
public class UserNotifier {

    private final MessageSender sender;

    public UserNotifier(/* no qualifier needed */ MessageSender sender) {
        this.sender = sender;
    }

    public MessageSender getSender() { return sender; }
}

// TODO 5: AlertNotifier — inject MessageSender with @Qualifier("smsMessageSender")
@Service
public class AlertNotifier {

    private final MessageSender sender;

    public AlertNotifier(/* TODO: add @Qualifier */ MessageSender sender) {
        this.sender = sender;
    }

    public MessageSender getSender() { return sender; }
}`,
      hints: [
        'The default bean name is the uncapitalized class name. SmsMessageSender becomes "smsMessageSender". You can also set a custom name: @Component("sms").',
        '@Primary on EmailMessageSender means that when Spring sees an unqualified MessageSender injection point and finds multiple candidates, it chooses the @Primary one. UserNotifier needs no other annotation.',
        'In the test: assertThat(userNotifier.getSender()).isInstanceOf(EmailMessageSender.class); and assertThat(alertNotifier.getSender()).isInstanceOf(SmsMessageSender.class);',
      ],
      solution: `import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

// ── Interface ─────────────────────────────────────────────────────────────

public interface MessageSender {
    String send(String to, String text);
}

// ── Implementations ───────────────────────────────────────────────────────

@Primary           // default: used when no @Qualifier is present
@Component
public class EmailMessageSender implements MessageSender {
    @Override
    public String send(String to, String text) {
        return "[EMAIL] sent to " + to + ": " + text;
    }
}

@Component         // bean name: "smsMessageSender"
public class SmsMessageSender implements MessageSender {
    @Override
    public String send(String to, String text) {
        return "[SMS] sent to " + to + ": " + text;
    }
}

// ── Services ──────────────────────────────────────────────────────────────

@Service
public class UserNotifier {
    private final MessageSender sender;

    // No qualifier — @Primary EmailMessageSender is selected automatically
    public UserNotifier(MessageSender sender) {
        this.sender = sender;
    }

    public MessageSender getSender() { return sender; }
}

@Service
public class AlertNotifier {
    private final MessageSender sender;

    // @Qualifier overrides @Primary — selects SmsMessageSender by name
    public AlertNotifier(@Qualifier("smsMessageSender") MessageSender sender) {
        this.sender = sender;
    }

    public MessageSender getSender() { return sender; }
}

// ── Test ──────────────────────────────────────────────────────────────────

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class NotifierWiringTest {

    @Autowired UserNotifier  userNotifier;
    @Autowired AlertNotifier alertNotifier;

    @Test
    void userNotifierReceivesEmailSender() {
        assertThat(userNotifier.getSender()).isInstanceOf(EmailMessageSender.class);
    }

    @Test
    void alertNotifierReceivesSmsMessageSender() {
        assertThat(alertNotifier.getSender()).isInstanceOf(SmsMessageSender.class);
    }
}`,
      explanation: `Spring's disambiguation algorithm at each injection point:

1. Find all beans that match the required type (\`MessageSender\`).
2. If exactly one → inject it.
3. If multiple and one is \`@Primary\` → inject the primary one (used by \`UserNotifier\`).
4. If \`@Qualifier\` is present → inject the named bean regardless of \`@Primary\` (used by
   \`AlertNotifier\`).
5. Otherwise → fail with \`NoUniqueBeanDefinitionException\`.

\`UserNotifier\` asks for \`MessageSender\`, Spring finds two candidates, picks
\`EmailMessageSender\` because it is \`@Primary\`.

\`AlertNotifier\` asks for \`@Qualifier("smsMessageSender") MessageSender\`, Spring ignores
\`@Primary\` and injects \`SmsMessageSender\` by name.

**Fragility note:** the qualifier string \`"smsMessageSender"\` is derived from the class
name. If the class is renamed, you must update the string. A safer approach (advanced) is
a custom qualifier annotation — a meta-annotation carrying \`@Qualifier\` — which is
refactoring-safe. For this lab, the string form is the right starting point.`,
    },
    {
      id: 'postconstruct-init',
      title: 'Challenge — wire a @Configuration bean with @PostConstruct initialisation',
      difficulty: 'challenge',
      prompt: `This exercise combines \`@Configuration\` / \`@Bean\` wiring with \`@PostConstruct\`
initialisation and a \`@Value\`-injected property.

**Scenario:** a \`TemplateRegistry\` loads message templates on startup. The templates are
stored in a \`TemplateStore\` (a simple in-memory map). The registry reads a configurable
prefix from application properties and uses it to qualify template keys.

**Requirements:**

1. Create \`TemplateStore\` — a plain class (no Spring annotations) with a \`Map<String,String>\`
   that stores templates and a \`void put(String key, String value)\` / \`String get(String key)\`
   API.
2. Create \`TemplateRegistry\` annotated \`@Service\`. It should:
   - Constructor-inject a \`TemplateStore\`.
   - Inject a property \`app.template.prefix\` (default \`"default"\`) via \`@Value\`.
   - In \`@PostConstruct\`, register at least two templates using the prefix as part of the
     key (e.g. \`"\${prefix}:welcome"\` and \`"\${prefix}:goodbye"\`).
   - Expose \`String get(String key)\` that delegates to the store.
3. In a \`@Configuration\` class, declare a \`@Bean\` for \`TemplateStore\`.
4. Set \`app.template.prefix=greet\` in \`src/test/resources/application.properties\`.
5. Write a test that verifies:
   - \`registry.get("greet:welcome")\` returns a non-blank string.
   - \`registry.get("greet:goodbye")\` returns a non-blank string.`,
      starter: `import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

// ── TemplateStore — plain Java, no Spring annotations ─────────────────────

class TemplateStore {
    private final Map<String, String> store = new HashMap<>();

    public void put(String key, String value) {
        store.put(key, value);
    }

    public String get(String key) {
        return store.getOrDefault(key, "");
    }
}

// ── TemplateRegistry ──────────────────────────────────────────────────────

@Service
public class TemplateRegistry {

    private final TemplateStore templateStore;

    // TODO: inject the app.template.prefix property with default "default"
    // Hint: @Value("\${app.template.prefix:default}")
    private String prefix;

    public TemplateRegistry(TemplateStore templateStore) {
        this.templateStore = templateStore;
    }

    // TODO: add @PostConstruct method that registers two templates
    // Key pattern: prefix + ":welcome" and prefix + ":goodbye"

    public String get(String key) {
        return templateStore.get(key);
    }
}

// ── Configuration ─────────────────────────────────────────────────────────

@Configuration
public class TemplateConfig {

    // TODO: declare a @Bean for TemplateStore
}`,
      hints: [
        'Write @Value("\\${app.template.prefix:default}") on the field. The \\${ is a Spring property placeholder (not Java interpolation). The :default part is the fallback value if the property is absent.',
        'In @PostConstruct: templateStore.put(prefix + ":welcome", "Welcome!"); templateStore.put(prefix + ":goodbye", "Goodbye!"); — simple string values are fine.',
        'In src/test/resources/application.properties add: app.template.prefix=greet — then the test can assert registry.get("greet:welcome") is not blank.',
      ],
      solution: `import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

// ── TemplateStore ─────────────────────────────────────────────────────────

class TemplateStore {
    private final Map<String, String> store = new HashMap<>();

    public void put(String key, String value) { store.put(key, value); }
    public String get(String key)             { return store.getOrDefault(key, ""); }
}

// ── TemplateRegistry ──────────────────────────────────────────────────────

@Service
public class TemplateRegistry {

    private final TemplateStore templateStore;

    // @Value injects the property value from application.properties / env vars.
    // The :default part is the fallback when the property is not set.
    @Value("\${app.template.prefix:default}")
    private String prefix;

    public TemplateRegistry(TemplateStore templateStore) {
        this.templateStore = templateStore;
    }

    @PostConstruct
    void loadTemplates() {
        // Called after injection — prefix is already populated by @Value.
        templateStore.put(prefix + ":welcome", "Welcome to our service!");
        templateStore.put(prefix + ":goodbye", "Thank you, see you soon!");
    }

    public String get(String key) {
        return templateStore.get(key);
    }
}

// ── Configuration ─────────────────────────────────────────────────────────

@Configuration
public class TemplateConfig {

    @Bean
    public TemplateStore templateStore() {
        return new TemplateStore();
    }
}

// ── src/test/resources/application.properties ─────────────────────────────
// app.template.prefix=greet

// ── Test ──────────────────────────────────────────────────────────────────

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class TemplateRegistryTest {

    @Autowired
    TemplateRegistry registry;

    @Test
    void welcomeTemplateIsLoaded() {
        assertThat(registry.get("greet:welcome")).isNotBlank();
    }

    @Test
    void goodbyeTemplateIsLoaded() {
        assertThat(registry.get("greet:goodbye")).isNotBlank();
    }
}`,
      explanation: `Several patterns come together here.

**\`@Value\`** injects a property value at field injection time — it happens before
\`@PostConstruct\` is called, which is why the \`prefix\` field is already populated inside
\`loadTemplates()\`. The \`\${app.template.prefix:default}\` syntax reads
\`app.template.prefix\` from any property source (application.properties, environment
variables, system properties) and falls back to \`"default"\` if the property is absent.

**\`@PostConstruct\`** runs after both constructor injection and field injection (\`@Value\`)
are complete. It is the correct place for any initialisation that requires injected
values. If you tried to read \`prefix\` in the constructor, \`@Value\` would not yet have
run and the field would be \`null\`.

**\`@Configuration\` + \`@Bean\`** is used here because \`TemplateStore\` has no Spring
annotation (it is a plain class). The config class is the explicit registration point.

The test exercises the full chain: Spring Boot loads the context, applies
\`application.properties\`, injects the \`TemplateStore\` bean, injects the property value,
and runs \`@PostConstruct\` — all before the first test method runs.`,
    },
  ],

  takeaways: [
    '**Inversion of Control** means the container — not your class — is responsible for creating objects and wiring their dependencies. You declare what you need; Spring decides what to provide.',
    'Annotate your own classes with \`@Component\` (or a stereotype like \`@Service\`, \`@Repository\`). Use \`@Bean\` methods inside a \`@Configuration\` class for third-party types or complex construction logic.',
    'Always use **constructor injection** for mandatory dependencies: it makes fields \`final\`, ensures objects are fully initialised at creation, allows plain-Java unit tests without a container, and causes circular dependency cycles to fail loudly at startup.',
    'When multiple beans implement the same interface, mark the default with \`@Primary\` and override it at specific injection points with \`@Qualifier("beanName")\`.',
    '\`@PostConstruct\` is the right place for initialisation logic that needs injected collaborators — it runs after all injection (including \`@Value\`) is complete. \`@PreDestroy\` is its shutdown counterpart.',
    'The default bean scope is **singleton**: one shared instance per application context. \`@Scope("prototype")\` creates a new instance on every injection — but beware injecting a prototype into a singleton (the prototype is only injected once). Use \`ObjectProvider<T>\` to get a fresh prototype per call.',
    'A circular dependency between two constructor-injected beans fails at startup — which is a feature, not a bug. The fix is almost always to extract a third bean that holds the shared concern, turning the cycle into a clean dependency graph.',
  ],
}
