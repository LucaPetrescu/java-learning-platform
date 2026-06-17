import type { Lab } from './types'

// Markdown convention used across all labs:
//  - Code blocks use TILDE fences (~~~java … ~~~) so they live safely inside
//    JS template literals without escaping.
//  - Inline code uses escaped backticks: \`like this\`.
//
// Audience: developers solid in core Java, BRAND NEW to Spring Boot.
// Theory defines every concept before use, explains the "magic", and builds
// up step by step. Exercises are foundational and guided.

export const lab14: Lab = {
  id: 'lab-14',
  number: 14,
  track: 'spring',
  title: 'Spring Boot Essentials & Configuration',
  subtitle:
    'From zero to a running app: starters, auto-config, properties, profiles & a first look at Actuator',
  estimatedHours: 6,
  concepts: [
    'Spring Boot vs plain Spring',
    'starters',
    'auto-configuration',
    '@SpringBootApplication',
    'embedded server',
    'application.properties',
    'application.yml',
    '@Value',
    '@ConfigurationProperties',
    'profiles',
    'Actuator',
  ],
  overview: `If you have ever used plain Spring, you know the setup: dozens of XML files or
\`@Configuration\` classes, carefully chosen library versions, a separate servlet container
to install. Spring Boot makes all of that disappear.

This lab starts from scratch. We will answer four questions:

1. **What does Spring Boot actually add?** (starters, auto-configuration, embedded server)
2. **How does the magic work?** (what \`@SpringBootApplication\` does, how auto-config
   decides what to create)
3. **How do you configure your app?** (\`application.properties\`, \`application.yml\`,
   \`@Value\`, \`@ConfigurationProperties\`)
4. **How do you have different settings per environment?** (profiles)

We finish with a first look at **Actuator**, a built-in set of HTTP endpoints that tell
you everything about a running app.

No prior Spring experience required — every concept is introduced before it is used.`,

  theory: [
    {
      id: 'what-spring-boot-adds',
      heading: 'What Spring Boot adds over plain Spring',
      body: `Plain Spring is a powerful framework, but setting it up involves a lot of manual work:

- You pick every library yourself and make sure the versions are compatible.
- You write \`@Configuration\` classes (or XML) to tell Spring which beans to create.
- You package a WAR and deploy it to a separate Tomcat or Jetty installation.

**Spring Boot removes all of that friction** through three mechanisms:

---

### 1. Starters — curated dependency bundles

A **starter** is a special Maven/Gradle dependency that pulls in a group of compatible
libraries with one line. You never manually hunt for versions.

~~~xml
<!-- One line gives you Spring MVC + Jackson + embedded Tomcat -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webmvc</artifactId>
</dependency>
~~~

The parent POM pins all the version numbers so you never have to:

~~~xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.0.x</version>
</parent>
~~~

---

### 2. Auto-configuration — sensible defaults from classpath detection

Adding a starter to the classpath is a signal. Spring Boot sees that Tomcat is present
and automatically configures a web server for you. It sees H2 on the classpath and
automatically sets up an in-memory database. You get a working app with zero extra
configuration.

This is called **auto-configuration**. We will look at exactly how it works in the next
section.

---

### 3. Embedded server — no separate install needed

Instead of deploying a WAR to an external Tomcat, Spring Boot **embeds** the server
inside your application JAR. Running your app is as simple as:

~~~text
java -jar myapp.jar
~~~

Tomcat starts up inside the same JVM as your code. This is why Spring Boot apps are so
easy to run locally and inside Docker containers.

---

> **In short:** Spring Boot is opinionated. It makes common choices for you — choices
> that you can override any time you need to. The goal is to get you from "I have an
> idea" to "I have a running service" with almost no boilerplate.`,
    },
    {
      id: 'springbootapplication',
      heading: '@SpringBootApplication explained simply',
      body: `Every Spring Boot app has a main class annotated with \`@SpringBootApplication\`. This
single annotation does three things:

~~~java
// What @SpringBootApplication actually expands to:
@SpringBootConfiguration   // 1. This class is a configuration class
@EnableAutoConfiguration   // 2. Turn on auto-configuration
@ComponentScan             // 3. Scan this package (and sub-packages) for Spring components
public class MyApp {

    public static void main(String[] args) {
        SpringApplication.run(MyApp.class, args);
    }
}
~~~

Let us look at each part:

---

**1. \`@SpringBootConfiguration\`** (= \`@Configuration\`)

Tells Spring: "this class can define beans using \`@Bean\` methods." A **bean** is just an
object that Spring creates and manages for you. We will add beans in this class later.

---

**2. \`@EnableAutoConfiguration\`**

Triggers the auto-configuration machinery. Spring Boot looks at what is on the classpath
and automatically creates beans you would otherwise have to declare by hand — a web
server, a database connection pool, a JSON serializer, and so on.

We will explore this more deeply in the next section.

---

**3. \`@ComponentScan\`**

Tells Spring to look at all classes in the **same package as \`MyApp\` and below** for
classes annotated with \`@Component\`, \`@Service\`, \`@Repository\`, or \`@Controller\`, and
register them as beans automatically.

This is the most important practical consequence: **keep your main class at the root of
your package**. If your main class is in \`com.example\` and a service is in
\`com.other\`, the component scan will not find it.

~~~text
com.example
  MyApp.java              <-- @SpringBootApplication here
  service/
    OrderService.java     <-- found by @ComponentScan ✓
  repository/
    OrderRepository.java  <-- found ✓

com.other
  ExternalService.java    <-- NOT found ✗
~~~

---

The main method calls \`SpringApplication.run()\`. This starts the **application context**
(Spring's container of all beans), triggers auto-configuration, starts the embedded web
server, and then your app is live.`,
    },
    {
      id: 'autoconfiguration-how',
      heading: 'How auto-configuration decides what to create',
      body: `Auto-configuration works through **conditions**. Every auto-configuration class is
guarded by one or more \`@Conditional\` annotations. Spring evaluates the conditions first
— if they pass, the beans are created; if not, the class is skipped entirely.

The most common conditions:

| Annotation | Creates the bean only when… |
|---|---|
| \`@ConditionalOnClass\` | a specific class is on the classpath |
| \`@ConditionalOnMissingBean\` | you have NOT already declared a bean of that type |
| \`@ConditionalOnProperty\` | a config property has a certain value |

Here is a simplified example of what the Tomcat auto-configuration looks like internally:

~~~java
@AutoConfiguration
@ConditionalOnClass(Tomcat.class)           // only if Tomcat JAR is present
@ConditionalOnMissingBean(WebServer.class)  // only if you haven't configured your own
public class TomcatAutoConfiguration {

    @Bean
    public WebServer webServer() {
        return new TomcatWebServer(/* default settings */);
    }
}
~~~

The key insight is \`@ConditionalOnMissingBean\`: **if you declare your own bean of the
same type, the auto-configuration backs off**. You are never locked in to the default.

> **Going deeper:** Auto-configuration classes are listed in a file called
> \`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports\`
> inside the starter JAR. You can open any starter in your IDE (Ctrl/Cmd + click the
> dependency) and browse this file to see exactly what Spring Boot auto-configures when
> you add that starter. You can also run your app with \`--debug\` to print the full
> Conditions Evaluation Report to the console, showing every class that was applied or
> skipped and the exact reason why.`,
    },
    {
      id: 'properties',
      heading: 'Externalized configuration: application.properties and application.yml',
      body: `Hard-coding values like database URLs or port numbers in your Java code is a bad idea
— you would have to recompile every time something changes. Spring Boot solves this with
**externalized configuration**: values live in files (or environment variables) outside
your compiled code.

The main configuration file is \`src/main/resources/application.properties\`:

~~~properties
# src/main/resources/application.properties
server.port=8080
app.name=My Awesome App
app.max-retries=3
~~~

You can also use YAML (many people find it more readable for nested config):

~~~yaml
# src/main/resources/application.yml
server:
  port: 8080
app:
  name: My Awesome App
  max-retries: 3
~~~

Both formats are equivalent. Pick one and stick to it — do not mix them in the same
project.

---

**Where Spring Boot looks for configuration (highest priority first):**

1. Command-line arguments: \`java -jar app.jar --server.port=9090\`
2. OS environment variables: \`SERVER_PORT=9090\`
3. Profile-specific file: \`application-prod.properties\`
4. Default file: \`application.properties\` / \`application.yml\`

Higher items override lower items. So a command-line argument always wins over the
properties file. This is very useful for Docker and Kubernetes, where you inject
configuration through environment variables without touching the packaged JAR.

---

**Naming conventions — they all mean the same thing:**

Spring Boot uses "relaxed binding", which means it accepts multiple spellings of the
same property name:

~~~properties
# All of these resolve to the same property: app.max-retries
app.max-retries=3          # kebab-case (preferred in .properties/.yml)
app.maxRetries=3           # camelCase
~~~

~~~text
# As an environment variable (uppercase + underscores):
APP_MAX_RETRIES=3
~~~`,
    },
    {
      id: 'value-annotation',
      heading: 'Reading a property with @Value',
      body: `The simplest way to read a single property value into your code is the \`@Value\`
annotation. You put the property key inside \`\${...}\` notation:

~~~java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AppInfo {

    // Reads the value of app.name from application.properties
    @Value("\${app.name}")
    private String appName;

    // Reads app.max-retries; uses 3 as a default if the property is not set
    @Value("\${app.max-retries:3}")
    private int maxRetries;

    public void printInfo() {
        System.out.println("App: " + appName + ", max retries: " + maxRetries);
    }
}
~~~

With \`application.properties\`:
~~~properties
app.name=My Awesome App
app.max-retries=5
~~~

Output: \`App: My Awesome App, max retries: 5\`

---

**A few things to know about \`@Value\`:**

- The key inside \`\${...}\` must match **exactly** — \`\${app.maxRetries}\` will NOT
  find \`app.max-retries\`. (Relaxed binding only applies to \`@ConfigurationProperties\`,
  which we cover next.)
- If the property is missing and you have no default, the application fails to start
  with a clear error — this is good, you find out immediately.
- Constructor injection is preferred (see below) but \`@Value\` is most commonly
  used on fields for simplicity with single values.

~~~java
// Preferred: @Value on a constructor parameter
@Component
public class AppInfo {

    private final String appName;

    public AppInfo(@Value("\${app.name}") String appName) {
        this.appName = appName;
    }
}
~~~`,
    },
    {
      id: 'configurationproperties',
      heading: 'Type-safe config groups with @ConfigurationProperties',
      body: `When you have several related config values, \`@Value\` gets tedious quickly — one
annotation per field, exact key matching, no validation. The better approach is
**\`@ConfigurationProperties\`**, which binds an entire section of your config to a Java
object at once.

Say your config looks like this:

~~~yaml
app:
  mail:
    host: smtp.example.com
    port: 587
    username: sender@example.com
    connection-timeout-ms: 3000
~~~

Create a class (or record) that mirrors this structure, and annotate it:

~~~java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

// "prefix" tells Spring which top-level key to bind
@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {

    private String host;
    private int port;
    private String username;
    private int connectionTimeoutMs;   // relaxed binding: maps to connection-timeout-ms

    // standard getters and setters (or use a record in Java 21)
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public int getConnectionTimeoutMs() { return connectionTimeoutMs; }
    public void setConnectionTimeoutMs(int v) { this.connectionTimeoutMs = v; }
}
~~~

Now inject it like any other bean:

~~~java
@Service
public class MailService {

    private final MailProperties mail;

    public MailService(MailProperties mail) {   // constructor injection
        this.mail = mail;
    }

    public void send(String to, String subject) {
        System.out.println("Sending via " + mail.getHost() + ":" + mail.getPort());
    }
}
~~~

---

**Adding validation** (recommended): annotate the class with \`@Validated\` and add
Jakarta Validation constraints. If a value is invalid, the app refuses to start with a
clear error — you find the problem at deploy time, not at 3am when the first email fails.

~~~java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@Component
@ConfigurationProperties(prefix = "app.mail")
@Validated
public class MailProperties {

    @NotBlank
    private String host;

    @Min(1) @Max(65535)
    private int port = 587;   // default value

    // ... rest of fields, getters, setters
}
~~~

You need the validation starter for this to work:

~~~xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
~~~

---

**\`@Value\` vs \`@ConfigurationProperties\` — when to use each:**

| | \`@Value\` | \`@ConfigurationProperties\` |
|---|---|---|
| One-off single value | good fit | overkill |
| Group of related values | tedious | **preferred** |
| Relaxed binding | no | yes |
| Startup validation | no | yes (with \`@Validated\`) |
| IDE completion | no | yes (with annotation processor) |`,
    },
    {
      id: 'profiles',
      heading: 'Profiles: different config per environment',
      body: `Almost every real application needs different settings for development and production:
a local H2 database vs a real PostgreSQL, verbose logging vs quiet logging, a fake email
sender vs a real SMTP server.

Spring Boot **profiles** solve this. A profile is a named environment (e.g. \`dev\`,
\`prod\`, \`test\`). You create a separate config file for each environment, and only the
active profile's file is loaded.

---

**Step 1: create profile-specific property files**

~~~text
src/main/resources/
  application.properties          <-- always loaded (shared config)
  application-dev.properties      <-- loaded only when 'dev' profile is active
  application-prod.properties     <-- loaded only when 'prod' profile is active
~~~

The profile-specific file **overrides** values from the base \`application.properties\`.

~~~properties
# application.properties (always active)
app.name=My App
server.port=8080

# application-dev.properties
logging.level.root=DEBUG
app.database-url=jdbc:h2:mem:devdb

# application-prod.properties
logging.level.root=WARN
app.database-url=jdbc:postgresql://prod-host:5432/mydb
~~~

---

**Step 2: activate a profile**

~~~text
# Via command line:
java -jar myapp.jar --spring.profiles.active=prod

# Via environment variable (common in Docker/Kubernetes):
SPRING_PROFILES_ACTIVE=prod

# In application.properties (for a fixed local default):
spring.profiles.default=dev
~~~

---

**Profile-specific beans**

You can also use \`@Profile\` to register a bean only in certain environments:

~~~java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class MailConfig {

    // This bean is only created when 'dev' profile is active
    @Bean
    @Profile("dev")
    public MailSender stubMailSender() {
        return (to, subject, body) ->
            System.out.println("[DEV] Pretending to send mail to " + to);
    }

    // This bean is only created when 'prod' profile is active
    @Bean
    @Profile("prod")
    public MailSender realMailSender(MailProperties props) {
        return new SmtpMailSender(props.getHost(), props.getPort());
    }
}
~~~

> **Watch out:** if a profile-guarded bean is not registered (because the profile is not
> active), and another bean depends on it, the app will fail to start with
> \`NoSuchBeanDefinitionException\`. Always make sure at least one bean of each required
> type is available for any combination of profiles you intend to run.`,
    },
    {
      id: 'actuator',
      heading: 'A first look at Actuator',
      body: `Once your app is running in production, you need to be able to answer questions like:
"Is the app healthy?", "What config values is it using?", "How many requests is it
handling?". **Spring Boot Actuator** adds a set of HTTP endpoints that answer these
questions without you having to write any code.

---

**Adding Actuator**

~~~xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
~~~

By default, only two endpoints are exposed over HTTP:

- \`GET /actuator/health\` — reports whether the app is healthy
- \`GET /actuator/info\` — app version / build info

---

**The health endpoint**

~~~text
GET http://localhost:8080/actuator/health

Response:
{ "status": "UP" }
~~~

To see more detail, add this to \`application.yml\`:

~~~yaml
management:
  endpoint:
    health:
      show-details: always
  endpoints:
    web:
      exposure:
        include: health,info,env
~~~

With details enabled, you see the status of each component (disk space, database, etc.):

~~~text
{
  "status": "UP",
  "components": {
    "db": { "status": "UP", "details": { "database": "H2" } },
    "diskSpace": { "status": "UP", "details": { "total": 500GB, "free": 200GB } }
  }
}
~~~

This endpoint is exactly what you point your **load balancer** or **Kubernetes
readiness probe** at — if the status is \`DOWN\`, traffic stops being routed to that
instance.

---

**Other useful endpoints**

| Endpoint | What it shows |
|---|---|
| \`/actuator/env\` | Every property source and the resolved value for each key |
| \`/actuator/metrics\` | Request counts, JVM memory, etc. |
| \`/actuator/conditions\` | Which auto-configurations were applied and why |

The \`/actuator/env\` endpoint is particularly useful for debugging configuration
problems — it shows you exactly which source provided each property value.

---

> **Going deeper:** You can write your own \`HealthIndicator\` bean by implementing the
> \`HealthIndicator\` interface. Spring Boot automatically includes it in the composite
> health response. This is how you add a custom check — for example, "can my app reach
> the payment gateway?" — to the standard health endpoint. See the optional challenge
> exercise at the end of this lab for a guided implementation.`,
    },
  ],

  exercises: [
    {
      id: 'read-properties-with-value',
      title: 'Read properties with @Value and print them at startup',
      difficulty: 'warmup',
      prompt: `In this exercise you will create a minimal Spring Boot application, add a few
properties to \`application.properties\`, read them with \`@Value\`, and print them when
the app starts.

**What to build:**

1. A \`@SpringBootApplication\` main class.
2. An \`application.properties\` file with these three properties:
   - \`app.name\` — a short string (your choice)
   - \`app.version\` — a version string like \`1.0.0\`
   - \`app.max-items=10\`
3. A \`@Component\` class called \`AppBanner\` that:
   - Injects all three values using \`@Value\`.
   - Implements \`CommandLineRunner\` so it runs at startup.
   - Prints: \`Started <name> v<version> (max items: <max>)\`

**Expected output (example):**
~~~text
Started My Store v1.0.0 (max items: 10)
~~~

**Stretch goal:** add a fourth property \`app.owner\` but do NOT add it to
\`application.properties\`. Use \`@Value("\${app.owner:Unknown")\` with a default.
Confirm the default prints instead of an error.`,
      starter: `// File: Application.java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// File: AppBanner.java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class AppBanner implements CommandLineRunner {

    // TODO: inject app.name using @Value
    private String appName;

    // TODO: inject app.version using @Value
    private String version;

    // TODO: inject app.max-items using @Value
    private int maxItems;

    @Override
    public void run(String... args) {
        // TODO: print "Started <name> v<version> (max items: <maxItems>)"
    }
}`,
      hints: [
        'The \`@Value\` annotation syntax is \`@Value("\\${property.key}")\`. The \`\\$\` is just how you write a dollar sign inside a Java string.',
        '\`CommandLineRunner\` is an interface with one method: \`void run(String... args)\`. Spring Boot calls it automatically after the context is fully started.',
        'To inject into a constructor parameter instead of a field: \`public AppBanner(@Value("\\${app.name}") String appName) { this.appName = appName; }\`',
      ],
      solution: `// File: Application.java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// File: AppBanner.java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class AppBanner implements CommandLineRunner {

    private final String appName;
    private final String version;
    private final int maxItems;
    private final String owner;

    public AppBanner(
            @Value("\${app.name}") String appName,
            @Value("\${app.version}") String version,
            @Value("\${app.max-items}") int maxItems,
            @Value("\${app.owner:Unknown}") String owner) {
        this.appName  = appName;
        this.version  = version;
        this.maxItems = maxItems;
        this.owner    = owner;
    }

    @Override
    public void run(String... args) {
        System.out.println("Started " + appName + " v" + version
            + " (max items: " + maxItems + ", owner: " + owner + ")");
    }
}

// File: src/main/resources/application.properties
// app.name=My Store
// app.version=1.0.0
// app.max-items=10
// (app.owner intentionally omitted to show default kicks in)`,
      explanation: `\`@Value\` reads from the merged set of all property sources. When you write
\`@Value("\${app.name}")\`, Spring finds \`app.name\` in \`application.properties\` and
substitutes it before your bean is created.

The colon syntax — \`\${app.owner:Unknown}\` — provides a default that is used when the
property is absent. Without a default, a missing property causes a startup failure with
\`IllegalArgumentException: Could not resolve placeholder\`. That early failure is
actually good design: it makes misconfiguration visible immediately rather than hiding
it until runtime.

Using constructor injection (as in the solution) instead of field injection is the
recommended Spring style: it makes the dependencies explicit, allows the class to be
\`final\`, and makes unit testing straightforward without needing a Spring context.`,
    },
    {
      id: 'configprops-group',
      title: 'Bind a config group with @ConfigurationProperties and validate it',
      difficulty: 'core',
      prompt: `In this exercise you will replace a scattered set of \`@Value\` fields with a single
\`@ConfigurationProperties\` class that validates its own values at startup.

**Config to bind** (add this to \`application.yml\`):

~~~yaml
app:
  store:
    name: My Store
    max-items-per-cart: 20
    support-email: help@mystore.com
    discount-percent: 10
~~~

**What to build:**

1. A \`StoreProperties\` class (or record) annotated with
   \`@ConfigurationProperties(prefix = "app.store")\` and \`@Validated\`.
2. Add these constraints:
   - \`name\` must not be blank (\`@NotBlank\`)
   - \`maxItemsPerCart\` must be between 1 and 100 (\`@Min\`, \`@Max\`)
   - \`supportEmail\` must be a valid email (\`@Email\`)
   - \`discountPercent\` must be 0–50 (\`@Min\`, \`@Max\`)
3. A \`@Component\` \`StoreInfo\` that injects \`StoreProperties\` via the constructor and
   implements \`CommandLineRunner\` to print the values.
4. **Test the validation**: change \`max-items-per-cart\` to \`200\` and confirm the app
   refuses to start with a clear error.

**Starter pom dependency you need:**

~~~xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
~~~`,
      starter: `// File: StoreProperties.java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

// TODO: add @Component
// TODO: add @ConfigurationProperties with the right prefix
// TODO: add @Validated
public class StoreProperties {

    // TODO: add @NotBlank
    private String name;

    // TODO: add @Min(1) @Max(100)
    private int maxItemsPerCart;

    // TODO: add @Email
    private String supportEmail;

    // TODO: add @Min(0) @Max(50)
    private int discountPercent;

    // TODO: add getters and setters for all fields
}

// File: StoreInfo.java
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class StoreInfo implements CommandLineRunner {

    // TODO: inject StoreProperties via constructor

    @Override
    public void run(String... args) {
        // TODO: print all four property values
    }
}`,
      hints: [
        'The class needs \`@Component\` (so Spring registers it as a bean), \`@ConfigurationProperties(prefix = "app.store")\` (so Spring binds the config subtree), and \`@Validated\` (so the constraints are enforced). All three annotations together.',
        'With relaxed binding, \`max-items-per-cart\` in YAML automatically maps to the field \`maxItemsPerCart\` in Java — you do not have to do anything special.',
        'If validation fails you will see a \`BindValidationException\` in the startup log listing exactly which fields violated which constraints. Look for lines like: \`Field error in object \'app.store\' on field \'maxItemsPerCart\': must be less than or equal to 100.\`',
      ],
      solution: `// File: StoreProperties.java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@Component
@ConfigurationProperties(prefix = "app.store")
@Validated
public class StoreProperties {

    @NotBlank
    private String name;

    @Min(1) @Max(100)
    private int maxItemsPerCart;

    @Email
    private String supportEmail;

    @Min(0) @Max(50)
    private int discountPercent;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getMaxItemsPerCart() { return maxItemsPerCart; }
    public void setMaxItemsPerCart(int v) { this.maxItemsPerCart = v; }

    public String getSupportEmail() { return supportEmail; }
    public void setSupportEmail(String v) { this.supportEmail = v; }

    public int getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(int v) { this.discountPercent = v; }
}

// File: StoreInfo.java
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class StoreInfo implements CommandLineRunner {

    private final StoreProperties store;

    public StoreInfo(StoreProperties store) {
        this.store = store;
    }

    @Override
    public void run(String... args) {
        System.out.println("Store: " + store.getName());
        System.out.println("Max cart items: " + store.getMaxItemsPerCart());
        System.out.println("Support email: " + store.getSupportEmail());
        System.out.println("Discount: " + store.getDiscountPercent() + "%");
    }
}`,
      explanation: `\`@ConfigurationProperties\` is the recommended way to group related config values.
Compared to six separate \`@Value\` fields, this approach:

- **Uses relaxed binding** — \`max-items-per-cart\` in YAML maps to \`maxItemsPerCart\`
  in Java automatically. With \`@Value\` you would have to use the exact YAML key.
- **Validates at startup** — the \`@Validated\` + constraint annotations mean bad config
  is caught before a single HTTP request is handled. If you set \`max-items-per-cart: 200\`,
  you get a clear \`BindValidationException\` with the field name and broken constraint.
- **Documents the config surface** — a developer reading \`StoreProperties\` sees all
  the config keys in one place, with their types and constraints.

The IDE (with the \`spring-boot-configuration-processor\` annotation processor on the
classpath) also generates autocompletion metadata for your custom properties,
so \`app.store.max-items-per-cart\` shows up in suggestions just like built-in
Spring properties do.`,
    },
    {
      id: 'profiles-exercise',
      title: 'Define dev and prod profiles with different greeting messages',
      difficulty: 'core',
      prompt: `Profiles let you keep different settings for different environments. In this exercise
you will create two profiles — \`dev\` and \`prod\` — where each one has a different
greeting message and log level, and you will use \`@Profile\` to create a bean that
only exists in one profile.

**What to build:**

1. \`application.properties\` — shared base config:
   - \`app.greeting=Hello from the base config\`
   - \`spring.profiles.default=dev\`

2. \`application-dev.properties\` — dev overrides:
   - \`app.greeting=Hello from DEV!\`
   - \`logging.level.root=DEBUG\`

3. \`application-prod.properties\` — prod overrides:
   - \`app.greeting=Hello from PRODUCTION.\`
   - \`logging.level.root=WARN\`

4. A \`@Component\` \`GreetingRunner\` that implements \`CommandLineRunner\`,
   injects \`app.greeting\` with \`@Value\`, and prints it at startup.

5. A \`@Configuration\` class \`ProfileDemoConfig\` with:
   - A \`@Bean\` annotated \`@Profile("dev")\` that returns a \`String\` bean named
     \`environmentLabel\` with value \`"DEVELOPMENT"\`.
   - A \`@Bean\` annotated \`@Profile("prod")\` that returns a \`String\` bean named
     \`environmentLabel\` with value \`"PRODUCTION"\`.

6. \`GreetingRunner\` should also inject the \`environmentLabel\` bean and print it.

**Verify both profiles** by running the app twice:
- Once with no arguments (should use \`dev\` default).
- Once with \`--spring.profiles.active=prod\`.`,
      starter: `// File: Application.java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// File: GreetingRunner.java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class GreetingRunner implements CommandLineRunner {

    // TODO: inject app.greeting using @Value
    private String greeting;

    // TODO: inject the "environmentLabel" String bean
    // Hint: use @Qualifier("environmentLabel") on the constructor parameter
    private String environmentLabel;

    @Override
    public void run(String... args) {
        // TODO: print greeting and environmentLabel
    }
}

// File: ProfileDemoConfig.java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class ProfileDemoConfig {

    // TODO: @Bean @Profile("dev") String environmentLabel() returning "DEVELOPMENT"

    // TODO: @Bean @Profile("prod") String environmentLabel() returning "PRODUCTION"
    // Note: you cannot have two methods with the same name in one class.
    // Name them devLabel() and prodLabel() but give them the same bean name via @Bean(name="environmentLabel")
}`,
      hints: [
        'To give a \`@Bean\` method a specific bean name different from the method name, use \`@Bean(name = "environmentLabel")\`. This lets you have two differently-named methods that produce a bean with the same name (only one is active per profile).',
        'To inject a bean by name rather than type, use \`@Qualifier("environmentLabel")\` alongside \`@Autowired\` (or in the constructor parameter list).',
        'With \`spring.profiles.default=dev\` in \`application.properties\`, running without any \`--spring.profiles.active\` argument automatically uses the \`dev\` profile.',
      ],
      solution: `// File: Application.java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// File: GreetingRunner.java
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class GreetingRunner implements CommandLineRunner {

    private final String greeting;
    private final String environmentLabel;

    public GreetingRunner(
            @Value("\${app.greeting}") String greeting,
            @Qualifier("environmentLabel") String environmentLabel) {
        this.greeting = greeting;
        this.environmentLabel = environmentLabel;
    }

    @Override
    public void run(String... args) {
        System.out.println("[" + environmentLabel + "] " + greeting);
    }
}

// File: ProfileDemoConfig.java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class ProfileDemoConfig {

    @Bean(name = "environmentLabel")
    @Profile("dev")
    public String devLabel() {
        return "DEVELOPMENT";
    }

    @Bean(name = "environmentLabel")
    @Profile("prod")
    public String prodLabel() {
        return "PRODUCTION";
    }
}

// File: src/main/resources/application.properties
// app.greeting=Hello from the base config
// spring.profiles.default=dev

// File: src/main/resources/application-dev.properties
// app.greeting=Hello from DEV!
// logging.level.root=DEBUG

// File: src/main/resources/application-prod.properties
// app.greeting=Hello from PRODUCTION.
// logging.level.root=WARN`,
      explanation: `Profile-specific property files follow the naming pattern
\`application-{profileName}.properties\` (or \`.yml\`). When a profile is active, Spring
Boot loads both the base \`application.properties\` and the profile-specific file, with
the profile-specific file winning on any overlapping keys.

Setting \`spring.profiles.default=dev\` in the base file means developers get the
\`dev\` config automatically without having to pass any arguments, which reduces
"works on my machine" issues.

The \`@Profile\` annotation on \`@Bean\` methods means Spring only registers that bean
when the named profile is active. The two \`@Bean\` methods with the same logical name
(\`environmentLabel\`) are allowed precisely because only one can ever be active at a
time — the others are simply not registered.

This is the idiomatic way to swap implementations per environment: define an interface
(or use \`String\` as we did here), provide one implementation per profile via
\`@Profile\`-annotated \`@Bean\` methods, and inject the interface everywhere else.`,
    },
    {
      id: 'custom-health-indicator',
      title: 'Add a custom Actuator HealthIndicator (optional challenge)',
      difficulty: 'challenge',
      prompt: `Actuator's \`/actuator/health\` endpoint reports the health of your application. In
this challenge you will write your own \`HealthIndicator\` that checks a custom condition
and contributes to the composite health status.

**Scenario:** your app depends on a feature flag service. When the flag service is
reachable, everything is fine. When it is down, you want the health endpoint to report
\`DOWN\` with a helpful detail message.

**What to build:**

1. An interface \`FeatureFlagClient\` with one method: \`boolean isReachable()\`.

2. An \`InMemoryFeatureFlagClient\` that implements the interface, has a
   \`boolean healthy\` field (default \`true\`), and returns it from \`isReachable()\`.
   Annotate it with \`@Component\`.

3. A \`FeatureFlagHealthIndicator\` class that:
   - Implements \`HealthIndicator\` (from \`org.springframework.boot.actuate.health\`).
   - Injects \`FeatureFlagClient\` via constructor injection.
   - Returns \`Health.up().withDetail("service", "feature-flags").build()\` when
     \`isReachable()\` returns \`true\`.
   - Returns \`Health.down().withDetail("reason", "feature flag service unreachable").build()\`
     when it returns \`false\`.
   - Wraps the call in \`try/catch\` and returns \`Health.down(exception).build()\`
     if an exception is thrown.
   - Annotate it with \`@Component\`.

4. Expose the health endpoint with full details in \`application.yml\`:

~~~yaml
management:
  endpoint:
    health:
      show-details: always
  endpoints:
    web:
      exposure:
        include: health
~~~

5. Write a \`CommandLineRunner\` that uses \`InMemoryFeatureFlagClient\` to first start
   healthy (check \`/actuator/health\`), then flip \`healthy = false\` and check again.

**Expected output at \`/actuator/health\` when healthy:**
~~~text
{
  "status": "UP",
  "components": {
    "featureFlag": { "status": "UP", "details": { "service": "feature-flags" } },
    ...
  }
}
~~~`,
      starter: `// File: FeatureFlagClient.java
public interface FeatureFlagClient {
    boolean isReachable();
}

// File: InMemoryFeatureFlagClient.java
import org.springframework.stereotype.Component;

@Component
public class InMemoryFeatureFlagClient implements FeatureFlagClient {

    private boolean healthy = true;

    // TODO: add a setter so tests can flip the flag

    @Override
    public boolean isReachable() {
        // TODO: return the healthy field
        return true;
    }
}

// File: FeatureFlagHealthIndicator.java
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component
public class FeatureFlagHealthIndicator implements HealthIndicator {

    // TODO: inject FeatureFlagClient via constructor

    @Override
    public Health health() {
        // TODO: call client.isReachable()
        //   - true  -> Health.up() with detail "service" = "feature-flags"
        //   - false -> Health.down() with detail "reason" = "feature flag service unreachable"
        //   - exception -> Health.down(ex)
        return Health.unknown().build();
    }
}`,
      hints: [
        'Spring Boot discovers \`HealthIndicator\` beans automatically — no registration needed beyond \`@Component\`. The bean name determines the key in the JSON: \`FeatureFlagHealthIndicator\` → key \`featureFlag\` (suffix stripped, first letter lowercased).',
        '\`Health.up()\`, \`Health.down()\`, \`Health.down(exception)\` are builder methods. Chain \`.withDetail(key, value)\` before \`.build()\` to attach extra information.',
        'The overall \`/actuator/health\` status becomes \`DOWN\` as soon as any component reports \`DOWN\`. This is the composite aggregation behaviour — you do not have to do anything special to trigger it.',
      ],
      solution: `// File: FeatureFlagClient.java
public interface FeatureFlagClient {
    boolean isReachable();
}

// File: InMemoryFeatureFlagClient.java
import org.springframework.stereotype.Component;

@Component
public class InMemoryFeatureFlagClient implements FeatureFlagClient {

    private boolean healthy = true;

    public void setHealthy(boolean healthy) {
        this.healthy = healthy;
    }

    @Override
    public boolean isReachable() {
        return healthy;
    }
}

// File: FeatureFlagHealthIndicator.java
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component
public class FeatureFlagHealthIndicator implements HealthIndicator {

    private final FeatureFlagClient client;

    public FeatureFlagHealthIndicator(FeatureFlagClient client) {
        this.client = client;
    }

    @Override
    public Health health() {
        try {
            boolean reachable = client.isReachable();
            if (reachable) {
                return Health.up()
                    .withDetail("service", "feature-flags")
                    .build();
            } else {
                return Health.down()
                    .withDetail("reason", "feature flag service unreachable")
                    .build();
            }
        } catch (Exception ex) {
            return Health.down(ex).build();
        }
    }
}

// File: HealthDemoRunner.java
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class HealthDemoRunner implements CommandLineRunner {

    private final InMemoryFeatureFlagClient client;

    public HealthDemoRunner(InMemoryFeatureFlagClient client) {
        this.client = client;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("App started. Check /actuator/health — should be UP.");
        Thread.sleep(5000);
        System.out.println("Flipping feature flag client to unhealthy...");
        client.setHealthy(false);
        System.out.println("Check /actuator/health again — should now be DOWN.");
    }
}`,
      explanation: `A \`HealthIndicator\` is a simple callback: implement the interface, annotate
with \`@Component\`, and Spring Boot does the rest. The health endpoint is a **composite**
— it calls every \`HealthIndicator\` bean and aggregates them. One \`DOWN\` makes the
overall status \`DOWN\`. This composite behaviour is what makes the health endpoint useful
as a readiness probe: any broken dependency immediately surfaces.

The three-branch \`try/catch\` pattern (up, down with detail, down with exception) ensures
the health endpoint **never throws**. If your indicator throws an uncaught exception,
Actuator catches it and marks that component \`DOWN\` anyway, but it is better to be
explicit about error conditions.

The bean name convention (\`FeatureFlagHealthIndicator\` → JSON key \`featureFlag\`) is
automatic and follows the pattern: strip the \`HealthIndicator\` suffix, then lowercase
the first character. If you need a custom key, annotate the class with
\`@Bean(name = "myCustomKey")\` in a \`@Configuration\` class instead of using
\`@Component\` directly.`,
    },
  ],

  takeaways: [
    'Spring Boot adds three things over plain Spring: **starters** (curated dependency bundles), **auto-configuration** (beans created from classpath detection), and an **embedded server** (no separate Tomcat install).',
    '\`@SpringBootApplication\` is shorthand for three annotations: \`@SpringBootConfiguration\` (this class can declare beans), \`@EnableAutoConfiguration\` (turn on auto-config), and \`@ComponentScan\` (find \`@Component\` classes in this package tree). Keep your main class at the root package.',
    'Auto-configuration uses \`@ConditionalOnClass\` and \`@ConditionalOnMissingBean\`: it only creates defaults when the library is present AND you have not declared your own bean. Override any default simply by providing your own bean of the same type.',
    'Prefer \`@ConfigurationProperties\` over \`@Value\` for groups of related config: it supports relaxed binding (so \`max-items-per-cart\` maps to \`maxItemsPerCart\` automatically), startup validation with \`@Validated\`, and documents your config surface in one place.',
    'Profiles let you have different config per environment. Name files \`application-{profile}.properties\`, set \`spring.profiles.default=dev\` for local work, and activate production config with \`--spring.profiles.active=prod\` or the \`SPRING_PROFILES_ACTIVE\` environment variable.',
    'Actuator\'s \`/actuator/health\` endpoint is a composite of all \`HealthIndicator\` beans. Point your load balancer or Kubernetes readiness probe at it — one \`DOWN\` component makes the whole app report \`DOWN\` and stops traffic being sent to it.',
    'Use \`/actuator/env\` to debug config problems: it shows every property source and the resolved value for each key, making it clear which source (env var, profile file, base file) actually won.',
  ],
}
