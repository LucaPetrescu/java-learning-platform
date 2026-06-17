import type { Lab } from './types'

// Markdown convention: tilde fences (~~~java / ~~~json / ~~~text) inside template literals.
// Inline code uses escaped backticks: \`like this\`.
// No raw ${ sequences — always escape as \${ when a literal dollar-brace is needed.

export const lab15: Lab = {
  id: 'lab-15',
  number: 15,
  track: 'spring',
  title: 'Building Web APIs with Spring MVC',
  subtitle: 'Your first @RestController — handling HTTP, reading input, returning data, and dealing with errors cleanly',
  estimatedHours: 6,
  concepts: [
    '@RestController',
    '@GetMapping',
    '@PostMapping',
    '@PathVariable',
    '@RequestParam',
    '@RequestBody',
    'ResponseEntity',
    'record DTOs',
    'Bean Validation',
    '@Valid',
    '@RestControllerAdvice',
    'ProblemDetail',
  ],
  overview: `You know core Java well. Spring is new. This lab starts at the very beginning —
**what happens when an HTTP request arrives**, and how you write a Spring controller to
handle it — then works up to returning proper status codes, validating input, and sending
back friendly error messages.

Every concept is explained before you use it. Every code example is complete and
runnable. Work through the theory sections in order, then do the exercises — they build
on each other step by step.

**Spring Boot setup assumed:**

~~~text
Parent:       spring-boot-starter-parent 4.0.x
Dependency:   spring-boot-starter-webmvc
Java:         21
~~~

That single starter gives you Tomcat, Spring MVC, and Jackson for JSON — no extra
configuration needed to get going.`,

  theory: [
    {
      id: 'what-is-spring-mvc',
      heading: 'What does Spring MVC actually do?',
      body: `When your Spring Boot app starts, it embeds a **Tomcat web server** inside the
application. Tomcat listens for HTTP requests and hands them to Spring's
**DispatcherServlet**, which is the single entry point for all web traffic.

The DispatcherServlet's job is to look at each request — the URL, the HTTP method
(GET, POST, …) — and find the right **controller method** in your code to run. It then
takes whatever that method returns and turns it into an HTTP response.

~~~text
Browser / API client
       |
       |  GET /api/greetings/42
       v
  Tomcat (embedded)
       |
       v
  DispatcherServlet
       |
       |  "Which method handles GET /api/greetings/42?"
       v
  Your @RestController method
       |
       |  returns a Java object
       v
  Jackson (JSON serialiser)
       |
       v
  HTTP Response  {"id": 42, "message": "Hello"}
~~~

You don't write any of that plumbing. You just annotate a class and its methods, and
Spring wires everything else up automatically. That is the "magic" — it is real code
under the hood, but Spring's auto-configuration does it for you.`,
    },
    {
      id: 'first-controller',
      heading: 'Your first @RestController',
      body: `The two annotations you need to know first:

- **\`@RestController\`** marks a class as a web controller whose methods return data
  (not a view / HTML page). Spring attaches Jackson to it automatically, so any object
  you return is serialised to JSON.
- **\`@GetMapping("/path")\`** says "run this method when a GET request arrives at this
  path."

Here is the smallest possible working controller:

~~~java
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello, world!";
    }
}
~~~

Start the app and open \`http://localhost:8080/hello\` — you will see \`Hello, world!\`.

**Returning a Java object instead of a plain string:**

~~~java
// A record is the cleanest way to define a response shape.
// Records are immutable data holders — Java generates the constructor,
// getters, equals, hashCode, and toString for you.
public record GreetingResponse(long id, String message) {}

@RestController
@RequestMapping("/api/greetings")  // base path for this whole class
public class GreetingController {

    @GetMapping("/{id}")            // GET /api/greetings/42
    public GreetingResponse greet(@PathVariable long id) {
        return new GreetingResponse(id, "Hello from greeting " + id);
    }
}
~~~

When you hit \`GET /api/greetings/42\`, Spring serialises the record to:

~~~json
{
  "id": 42,
  "message": "Hello from greeting 42"
}
~~~

**What is \`@PathVariable\`?** The \`{id}\` in the path is a template — a placeholder.
\`@PathVariable long id\` tells Spring to extract whatever is in that slot and pass it
to your method as a \`long\`.

**What is \`@RequestMapping\`?** Putting it on the class sets a base path that all
methods in the class share. \`@GetMapping("/{id}")\` on the method means the full path
is \`/api/greetings/{id}\`.`,
    },
    {
      id: 'reading-input',
      heading: 'Reading input — @PathVariable, @RequestParam, @RequestBody',
      body: `There are three main ways a client can send you data. Here is how to read each one.

---

**\`@PathVariable\` — data embedded in the URL path**

~~~java
// Client:  GET /api/users/7
// Method:
@GetMapping("/{id}")
public UserResponse getUser(@PathVariable Long id) { ... }
~~~

Use path variables for resource identifiers (the thing you are looking up).

---

**\`@RequestParam\` — query string parameters after the \`?\`**

~~~java
// Client:  GET /api/users?page=0&size=20&active=true
// Method:
@GetMapping
public List<UserResponse> listUsers(
        @RequestParam(defaultValue = "0")  int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "true") boolean active) { ... }
~~~

\`defaultValue\` means the parameter is optional — if the client omits it, Spring uses
the default. Without \`defaultValue\`, the parameter is required and Spring returns 400
if it is missing.

---

**\`@RequestBody\` — JSON in the request body (usually for POST / PUT)**

~~~java
// Client sends:
// POST /api/users
// Content-Type: application/json
// { "name": "Ada", "email": "ada@example.com" }

// You define a record to hold the incoming data:
public record CreateUserRequest(String name, String email) {}

// Then read it:
@PostMapping
public UserResponse create(@RequestBody CreateUserRequest req) {
    // req.name() == "Ada",  req.email() == "ada@example.com"
    ...
}
~~~

Jackson reads the JSON and constructs the record for you. No parsing code needed.`,
    },
    {
      id: 'response-entity',
      heading: 'Returning the right status code with ResponseEntity',
      body: `HTTP status codes matter. A successful GET returns 200, but a successful POST
(resource created) should return **201 Created**. Not Found should return **404**. If
you just \`return someObject;\` Spring always sends 200, even if it is wrong.

**\`ResponseEntity<T>\`** gives you full control over status, headers, and body:

~~~java
import org.springframework.http.ResponseEntity;
import java.net.URI;

@PostMapping
public ResponseEntity<UserResponse> create(@RequestBody CreateUserRequest req) {
    // ... save the user, get back the new id ...
    long newId = 7L;
    UserResponse body = new UserResponse(newId, req.name(), req.email());

    // ResponseEntity.created() sets status 201 AND adds a Location header
    // pointing at the URL where the new resource can be fetched.
    URI location = URI.create("/api/users/" + newId);
    return ResponseEntity.created(location).body(body);
}
~~~

The client receives:

~~~text
HTTP/1.1 201 Created
Location: /api/users/7
Content-Type: application/json

{"id": 7, "name": "Ada", "email": "ada@example.com"}
~~~

**Other common patterns:**

~~~java
// 200 OK with a body (same as plain return, but explicit)
return ResponseEntity.ok(body);

// 204 No Content — for DELETE where there is nothing to return
return ResponseEntity.noContent().build();

// 404 Not Found with no body
return ResponseEntity.notFound().build();
~~~

**When to use \`ResponseEntity\` vs a plain return:**
Use \`ResponseEntity\` when the status code varies (especially 201 for POST, 204 for
DELETE, or when you might return 200 vs 404). For a simple GET that always succeeds,
a plain \`return object;\` (which gives 200) is fine.`,
    },
    {
      id: 'dtos-not-entities',
      heading: 'Why you return record DTOs, not JPA entities',
      body: `Once you add a database (JPA / Hibernate), you will have **entity classes** annotated
with \`@Entity\`. It is tempting to return these directly from a controller. Do not.

Here is why, in plain terms:

**1. Lazy loading crashes outside a database session.**
JPA entities can have fields that are loaded "on demand" (lazy). Jackson tries to
read every field to serialise the response, but the database session is already closed
by the time the controller runs. Result: an ugly \`LazyInitializationException\` crash.

**2. You expose your entire database schema.**
Every column — including internal ones, audit fields, hashed passwords — becomes
part of your public API. Adding a column to the table immediately changes what clients
receive.

**3. You lose control of your API contract.**
Six months later you rename a column for internal reasons. Every client breaks.

**The fix: use a record as a DTO (Data Transfer Object).**
A DTO is a plain data class whose only job is to carry the data you want to send. You
control exactly which fields appear:

~~~java
// Entity (in your persistence layer — never leave the service/repo layer)
@Entity
public class User {
    @Id Long id;
    String name;
    String email;
    String passwordHash;    // must NEVER be sent to clients
    boolean internalFlag;   // internal only
}

// Response DTO (what the controller returns)
public record UserResponse(Long id, String name, String email) {

    // A static factory that maps from the entity.
    // All mapping logic stays in one place.
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail());
        // passwordHash and internalFlag are simply not included
    }
}
~~~

Records are perfect for DTOs: they are immutable, concise, and Jackson knows how to
deserialise JSON into them without any extra annotations.`,
    },
    {
      id: 'validation',
      heading: 'Input validation with @Valid and Jakarta constraints',
      body: `You should never trust data that comes from a client. Spring integrates
**Jakarta Bean Validation** to check request data automatically before your method runs.

**Step 1 — add constraints to your request record:**

~~~java
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(

    @NotBlank(message = "name must not be blank")
    @Size(max = 80, message = "name must be 80 characters or fewer")
    String name,

    @NotBlank(message = "email must not be blank")
    @Email(message = "email must be a valid address")
    String email,

    @Positive(message = "age must be a positive number")
    int age
) {}
~~~

**Step 2 — add \`@Valid\` to the controller parameter:**

~~~java
@PostMapping
public ResponseEntity<UserResponse> create(
        @Valid @RequestBody CreateUserRequest req) {
    // If any constraint fails, Spring throws MethodArgumentNotValidException
    // BEFORE this method body runs. You never see invalid data here.
    ...
}
~~~

**Commonly used constraint annotations** (all in \`jakarta.validation.constraints\`):

| Annotation | What it checks |
|---|---|
| \`@NotNull\` | value is not null |
| \`@NotBlank\` | String is not null, not empty, not just whitespace |
| \`@Size(min, max)\` | String length or collection size |
| \`@Email\` | looks like a valid email |
| \`@Positive\` | number is > 0 |
| \`@PositiveOrZero\` | number is >= 0 |
| \`@Min(n)\` / \`@Max(n)\` | numeric lower / upper bound |
| \`@Pattern(regexp)\` | matches a regular expression |

If validation fails, Spring returns a 400 Bad Request automatically. The default
response body is not very readable. The next section shows how to make it nice.`,
    },
    {
      id: 'error-handling',
      heading: 'Friendly error responses with @RestControllerAdvice and ProblemDetail',
      body: `When something goes wrong — bad input, resource not found — clients need a
clear, structured error response, not a stack trace.

**RFC 9457 / ProblemDetail** is an internet standard for HTTP error responses. Spring
Boot supports it natively. It looks like this:

~~~json
{
  "type":     "about:blank",
  "title":    "Not Found",
  "status":   404,
  "detail":   "User 99 not found",
  "instance": "/api/users/99"
}
~~~

**\`@RestControllerAdvice\`** is a special class where you write methods that catch
exceptions thrown anywhere in your controllers. Think of it as a central error handler.

Here is a complete, gentle example:

~~~java
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;

// A custom exception you throw when a resource is not found.
// Define this once and throw it from any controller.
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) { super(message); }
}

// The central error handler — annotate with @RestControllerAdvice.
// Spring finds it automatically.
@RestControllerAdvice
public class GlobalExceptionHandler {

    // This method runs whenever any controller throws NotFoundException.
    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(
            NotFoundException ex,
            HttpServletRequest request) {

        // ProblemDetail.forStatusAndDetail() is the factory method.
        // It sets status and detail in one call.
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());

        // instance = the URL that was requested
        pd.setInstance(URI.create(request.getRequestURI()));

        return pd;   // Spring serialises this to the standard JSON shape
    }
}
~~~

In your controller, just throw:

~~~java
@GetMapping("/{id}")
public UserResponse get(@PathVariable Long id) {
    User user = store.get(id);
    if (user == null) {
        throw new NotFoundException("User " + id + " not found");
    }
    return UserResponse.from(user);
}
~~~

The advice class catches it and returns a clean 404 with a JSON body — no try/catch in
the controller, no repeated error-building code.

**Going deeper:** For validation errors (\`MethodArgumentNotValidException\`), you can add a
second \`@ExceptionHandler\` in the same advice class that includes a list of which fields
failed. Exercise C in this lab walks you through that. For now, just knowing the pattern
exists is enough.`,
    },
  ],

  exercises: [
    {
      id: 'first-rest-controller',
      title: 'Your first @RestController — in-memory note store',
      difficulty: 'warmup',
      prompt: `Build a tiny REST API for storing notes. There is no database — use a
\`java.util.Map\` in memory. This exercise gets you comfortable with the basic
controller shape, record DTOs, \`@GetMapping\`, \`@PostMapping\`, and returning the right
status codes.

**The data shape:**

- Each note has an \`id\` (long) and a \`text\` (String).
- The request to create a note carries only \`text\`.
- The response always includes \`id\` and \`text\`.

**What to implement:**

1. A \`NoteResponse\` record with fields \`id\` and \`text\`.
2. A \`CreateNoteRequest\` record with field \`text\`.
3. A \`NoteController\` annotated with \`@RestController\` and
   \`@RequestMapping("/api/notes")\` that handles:
   - \`GET /api/notes\` — return all notes as a \`List<NoteResponse>\`. Start with HTTP 200.
   - \`GET /api/notes/{id}\` — return one note by id. Return 200 if found.
     For now, if not found, return 404 using \`ResponseEntity.notFound().build()\`.
   - \`POST /api/notes\` — create a note, return **201 Created** with the note in the body
     and a \`Location\` header pointing to \`/api/notes/{newId}\`.

Use \`java.util.concurrent.ConcurrentHashMap\` and \`java.util.concurrent.atomic.AtomicLong\`
as your store and id sequence — they are thread-safe and need no setup.

**You do not need @Valid yet** — that is Exercise B.`,
      starter: `import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

// TODO 1: define NoteResponse record (fields: long id, String text)

// TODO 2: define CreateNoteRequest record (field: String text)

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    // in-memory store — key is the note id
    private final Map<Long, String> store = new ConcurrentHashMap<>();
    private final AtomicLong idSequence = new AtomicLong(1);

    // TODO 3: GET /api/notes — return all notes as List<NoteResponse>
    //   Hint: store.entrySet().stream()
    //              .map(e -> new NoteResponse(e.getKey(), e.getValue()))
    //              .toList()

    // TODO 4: GET /api/notes/{id} — return one note or 404
    //   Hint: use ResponseEntity<NoteResponse> as the return type.
    //   If store.get(id) == null, return ResponseEntity.notFound().build()
    //   Otherwise return ResponseEntity.ok(new NoteResponse(...))

    // TODO 5: POST /api/notes — create a note, return 201 + Location
    //   Hint: long newId = idSequence.getAndIncrement();
    //         store.put(newId, req.text());
    //         URI location = URI.create("/api/notes/" + newId);
    //         return ResponseEntity.created(location).body(new NoteResponse(...));
}`,
      hints: [
        'Records are declared at the top level of the file (or as a nested static type). \`public record NoteResponse(long id, String text) {}\` is all you need — Java generates the constructor and accessors.',
        'For the GET list: \`@GetMapping\` with no path argument matches \`GET /api/notes\` (the base path from \`@RequestMapping\`). Return type is \`List<NoteResponse>\` — Spring serialises the list to a JSON array automatically.',
        'For the 201 response: \`ResponseEntity.created(URI.create("/api/notes/" + newId)).body(new NoteResponse(newId, req.text()))\` does everything in one chain — sets status 201, adds the Location header, and attaches the body.',
      ],
      solution: `import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public record NoteResponse(long id, String text) {}
public record CreateNoteRequest(String text) {}

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final Map<Long, String> store = new ConcurrentHashMap<>();
    private final AtomicLong idSequence = new AtomicLong(1);

    @GetMapping
    public List<NoteResponse> listAll() {
        return store.entrySet().stream()
                .map(e -> new NoteResponse(e.getKey(), e.getValue()))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<NoteResponse> getOne(@PathVariable Long id) {
        String text = store.get(id);
        if (text == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(new NoteResponse(id, text));
    }

    @PostMapping
    public ResponseEntity<NoteResponse> create(@RequestBody CreateNoteRequest req) {
        long newId = idSequence.getAndIncrement();
        store.put(newId, req.text());
        URI location = URI.create("/api/notes/" + newId);
        return ResponseEntity.created(location)
                .body(new NoteResponse(newId, req.text()));
    }
}`,
      explanation: `**Records as DTOs** are the modern Spring Boot pattern. Two lines declare a full
immutable data class: \`public record NoteResponse(long id, String text) {}\`. Jackson
knows how to serialise and deserialise records without any extra configuration.

**\`@RequestMapping\` on the class** sets the base path once. Each method annotation
(\`@GetMapping\`, \`@PostMapping\`) is relative to it, which avoids repeating the prefix
on every method.

**\`ResponseEntity\`** is the key to correct status codes. \`ResponseEntity.notFound().build()\`
returns a 404 with an empty body — appropriate when the resource does not exist.
\`ResponseEntity.created(location).body(...)\` returns 201 with both a \`Location\` header
(where to find the new resource) and a JSON body.

The \`ConcurrentHashMap\` and \`AtomicLong\` are thread-safe without synchronisation blocks —
Spring can handle multiple concurrent requests on different threads, so thread safety
matters even for toy in-memory stores.`,
    },
    {
      id: 'add-validation',
      title: 'Add @Valid validation to the note request',
      difficulty: 'core',
      prompt: `Extend the note controller from Exercise A by adding **input validation** to
\`CreateNoteRequest\`.

**Validation rules:**

- \`text\` must not be blank (null, empty, or only whitespace).
- \`text\` must be at most 500 characters.

**Steps:**

1. Add Jakarta constraint annotations to \`CreateNoteRequest\`.
2. Add \`@Valid\` before \`@RequestBody\` in the POST handler.
3. Verify the behaviour: sending \`{"text": ""}\` should produce a **400 Bad Request**.
   (Spring throws \`MethodArgumentNotValidException\` automatically — you do not need to
   check anything in the method body.)

You can test with curl or any HTTP client:

~~~text
# Should succeed:
curl -X POST http://localhost:8080/api/notes \\
     -H "Content-Type: application/json" \\
     -d '{"text":"Hello world"}'

# Should return 400:
curl -X POST http://localhost:8080/api/notes \\
     -H "Content-Type: application/json" \\
     -d '{"text":""}'
~~~

The 400 response body from Spring's default handler is not very clean. Exercise C
fixes that. For now, just confirm that validation is being triggered.`,
      starter: `import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public record NoteResponse(long id, String text) {}

// TODO 1: add @NotBlank and @Size(max = 500) to the 'text' field
public record CreateNoteRequest(
    // TODO: annotate this field
    String text
) {}

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final Map<Long, String> store = new ConcurrentHashMap<>();
    private final AtomicLong idSequence = new AtomicLong(1);

    @GetMapping
    public List<NoteResponse> listAll() {
        return store.entrySet().stream()
                .map(e -> new NoteResponse(e.getKey(), e.getValue()))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<NoteResponse> getOne(@PathVariable Long id) {
        String text = store.get(id);
        if (text == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(new NoteResponse(id, text));
    }

    // TODO 2: add @Valid before @RequestBody in this method
    @PostMapping
    public ResponseEntity<NoteResponse> create(@RequestBody CreateNoteRequest req) {
        long newId = idSequence.getAndIncrement();
        store.put(newId, req.text());
        URI location = URI.create("/api/notes/" + newId);
        return ResponseEntity.created(location)
                .body(new NoteResponse(newId, req.text()));
    }
}`,
      hints: [
        '\`@NotBlank\` (from \`jakarta.validation.constraints\`) checks that the String is not null, not empty, and not just whitespace — one annotation covers all three cases. Add it directly on the record component: \`@NotBlank String text\`.',
        '\`@Size(max = 500)\` sets the upper length limit. You can combine message text: \`@Size(max = 500, message = "text must be 500 characters or fewer")\`.',
        'Adding \`@Valid\` before \`@RequestBody\` is the trigger. Without it, constraint annotations on the record are ignored — Spring only validates when \`@Valid\` (or \`@Validated\`) is present.',
      ],
      solution: `import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public record NoteResponse(long id, String text) {}

public record CreateNoteRequest(
    @NotBlank(message = "text must not be blank")
    @Size(max = 500, message = "text must be 500 characters or fewer")
    String text
) {}

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final Map<Long, String> store = new ConcurrentHashMap<>();
    private final AtomicLong idSequence = new AtomicLong(1);

    @GetMapping
    public List<NoteResponse> listAll() {
        return store.entrySet().stream()
                .map(e -> new NoteResponse(e.getKey(), e.getValue()))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<NoteResponse> getOne(@PathVariable Long id) {
        String text = store.get(id);
        if (text == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(new NoteResponse(id, text));
    }

    @PostMapping
    public ResponseEntity<NoteResponse> create(
            @Valid @RequestBody CreateNoteRequest req) {
        long newId = idSequence.getAndIncrement();
        store.put(newId, req.text());
        URI location = URI.create("/api/notes/" + newId);
        return ResponseEntity.created(location)
                .body(new NoteResponse(newId, req.text()));
    }
}`,
      explanation: `**\`@NotBlank\` vs \`@NotNull\` vs \`@NotEmpty\`** — these are easy to confuse:

- \`@NotNull\` — only checks the value is not null. An empty string \`""\` passes.
- \`@NotEmpty\` — not null and not empty string/collection. A string of spaces \`"   "\` passes.
- \`@NotBlank\` — not null, not empty, and not only whitespace. This is almost always what
  you want for user-facing text fields.

**Where \`@Valid\` goes** matters: it must be on the **method parameter**, not on the record
itself. \`@Valid @RequestBody CreateNoteRequest req\` tells Spring to run the validator on
the incoming \`req\` object. Without \`@Valid\`, the constraint annotations on the record
fields are just metadata — nothing checks them.

When validation fails, Spring throws \`MethodArgumentNotValidException\` and returns a
400 status. The next exercise adds a proper error handler that returns a clean response.`,
    },
    {
      id: 'not-found-advice',
      title: 'Add a @RestControllerAdvice for 404 and validation errors',
      difficulty: 'core',
      prompt: `The note controller currently returns 404 via \`ResponseEntity.notFound().build()\`
inline, and the validation error response is whatever Spring's default looks like.
Both approaches have problems:

- Inline \`ResponseEntity.notFound()\` works for one controller but does not scale — you'd
  copy it everywhere.
- The default validation error body is verbose and inconsistent.

**Replace both** with a \`@RestControllerAdvice\` that returns \`ProblemDetail\`.

**Step 1 — Create a \`NoteNotFoundException\`:**

~~~java
public class NoteNotFoundException extends RuntimeException {
    public NoteNotFoundException(long id) {
        super("Note " + id + " not found");
    }
}
~~~

**Step 2 — Update the GET /{id} handler to throw it:**

~~~java
@GetMapping("/{id}")
public NoteResponse getOne(@PathVariable Long id) {
    String text = store.get(id);
    if (text == null) throw new NoteNotFoundException(id);
    return new NoteResponse(id, text);
    // return type is now NoteResponse, not ResponseEntity — the advice handles the 404
}
~~~

**Step 3 — Implement \`GlobalExceptionHandler\`:**

The class must be annotated \`@RestControllerAdvice\` and must handle two exceptions:

1. **\`NoteNotFoundException\`** — return a \`ProblemDetail\` with:
   - status: 404
   - detail: the exception message (e.g. \`"Note 99 not found"\`)
   - instance: the request URI

2. **\`MethodArgumentNotValidException\`** — return a \`ProblemDetail\` with:
   - status: 400
   - title: \`"Validation Failed"\`
   - detail: e.g. \`"1 constraint violation(s)"\`
   - instance: the request URI
   - an extension property \`"errors"\` containing a list of objects,
     each with \`"field"\` and \`"message"\` keys

**Imports you will need:**

~~~java
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;
~~~`,
      starter: `import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;

// Step 1: your custom exception
public class NoteNotFoundException extends RuntimeException {
    public NoteNotFoundException(long id) {
        super("Note " + id + " not found");
    }
}

@RestControllerAdvice
public class GlobalExceptionHandler {

    // TODO A: handle NoteNotFoundException -> 404 ProblemDetail
    // Steps:
    //   ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    //   pd.setInstance(URI.create(request.getRequestURI()));
    //   return pd;
    @ExceptionHandler(NoteNotFoundException.class)
    public ProblemDetail handleNotFound(
            NoteNotFoundException ex,
            HttpServletRequest request) {
        return null; // replace this
    }

    // TODO B: handle MethodArgumentNotValidException -> 400 ProblemDetail with field errors
    // Steps:
    //   1. collect errors: ex.getBindingResult().getFieldErrors()
    //      each FieldError has .getField() and .getDefaultMessage()
    //   2. build ProblemDetail with status 400
    //   3. set title "Validation Failed", detail with violation count, instance
    //   4. pd.setProperty("errors", listOfMaps)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        return null; // replace this
    }
}`,
      hints: [
        '\`ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage())\` creates the object with status and detail already set. Then \`pd.setInstance(URI.create(request.getRequestURI()))\` adds the URL. That is all you need for the 404 handler.',
        'For the validation handler, collect field errors first: \`var errors = ex.getBindingResult().getFieldErrors().stream().map(fe -> Map.of("field", fe.getField(), "message", fe.getDefaultMessage())).toList();\` — then \`pd.setProperty("errors", errors)\` adds them to the ProblemDetail.',
        '\`ex.getErrorCount()\` gives the number of constraint violations as an int. Use it to build the detail string: \`ex.getErrorCount() + " constraint violation(s)"\`.',
      ],
      solution: `import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;

public class NoteNotFoundException extends RuntimeException {
    public NoteNotFoundException(long id) {
        super("Note " + id + " not found");
    }
}

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NoteNotFoundException.class)
    public ProblemDetail handleNotFound(
            NoteNotFoundException ex,
            HttpServletRequest request) {

        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setInstance(URI.create(request.getRequestURI()));
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {

        var errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field",   (Object) fe.getField(),
                        "message", (Object) fe.getDefaultMessage()))
                .toList();

        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                ex.getErrorCount() + " constraint violation(s)");
        pd.setTitle("Validation Failed");
        pd.setInstance(URI.create(request.getRequestURI()));
        pd.setProperty("errors", errors);
        return pd;
    }
}`,
      explanation: `**Why throw an exception instead of returning \`ResponseEntity.notFound()\`?**
When controllers throw domain exceptions, the controller method stays clean — it only
describes the happy path. The \`@RestControllerAdvice\` class is the single place where
all error translation happens. As the project grows, this is much easier to maintain
than scattering \`ResponseEntity\` status decisions across dozens of methods.

**\`ProblemDetail\`** is Spring Boot's built-in implementation of RFC 9457 (the internet
standard for HTTP error responses). \`forStatusAndDetail()\` is the factory — it sets the
\`status\` and \`detail\` fields. \`setTitle()\` and \`setInstance()\` set the other standard
fields. \`setProperty()\` adds custom extension fields (like the \`errors\` list) that appear
at the top level of the JSON alongside the standard fields.

Spring automatically sets \`Content-Type: application/problem+json\` on the response when
you return a \`ProblemDetail\` — clients can detect error responses by content type.

Notice that \`HttpServletRequest\` is a method parameter but you never pass it — Spring
injects it automatically into \`@ExceptionHandler\` methods.`,
    },
    {
      id: 'full-crud-controller',
      title: 'Full CRUD controller with correct status codes (challenge)',
      difficulty: 'challenge',
      prompt: `Build a complete CRUD (Create, Read, Update, Delete) controller for a \`Book\`
resource using an in-memory store. This exercise pulls together everything from the
previous three exercises.

**The Book resource:**

- Fields: \`id\` (long, server-assigned), \`title\` (String), \`author\` (String),
  \`yearPublished\` (int).

**Records to define:**

- \`BookResponse(long id, String title, String author, int yearPublished)\`
- \`CreateBookRequest(String title, String author, int yearPublished)\` — all fields
  required with sensible constraints.

**Endpoints and expected status codes:**

| Verb + Path | Success | Not found |
|---|---|---|
| \`GET /api/books\` | 200 + list | — |
| \`GET /api/books/{id}\` | 200 + book | 404 via \`BookNotFoundException\` |
| \`POST /api/books\` | 201 + Location | — |
| \`DELETE /api/books/{id}\` | 204 No Content | 404 via \`BookNotFoundException\` |

**Constraints on \`CreateBookRequest\`:**

- \`title\`: not blank, max 200 chars.
- \`author\`: not blank, max 100 chars.
- \`yearPublished\`: between 1 and 2100 (\`@Min\` / \`@Max\`).

**Requirements:**

1. Throw \`BookNotFoundException\` for missing ids (define the exception).
2. A \`GlobalExceptionHandler\` (or reuse from Exercise C) that handles
   \`BookNotFoundException\` -> 404 ProblemDetail and
   \`MethodArgumentNotValidException\` -> 400 ProblemDetail.
3. The DELETE endpoint returns **204 No Content** (no body). Use
   \`ResponseEntity<Void>\` or the \`@ResponseStatus(HttpStatus.NO_CONTENT)\` shortcut.

**Hint for DELETE returning 204:**

~~~java
@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(@PathVariable Long id) {
    if (!store.containsKey(id)) throw new BookNotFoundException(id);
    store.remove(id);
    return ResponseEntity.noContent().build();  // 204, no body
}
~~~`,
      starter: `import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

// TODO 1: define BookNotFoundException (extends RuntimeException)

// TODO 2: define BookResponse record

// TODO 3: define CreateBookRequest record with validation constraints

// TODO 4: @RestControllerAdvice GlobalExceptionHandler
//         handle BookNotFoundException -> 404 ProblemDetail
//         handle MethodArgumentNotValidException -> 400 ProblemDetail

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final Map<Long, CreateBookRequest> store = new ConcurrentHashMap<>();
    private final AtomicLong idSeq = new AtomicLong(1);

    // TODO 5: GET /api/books — return List<BookResponse>, status 200

    // TODO 6: GET /api/books/{id} — return BookResponse or throw BookNotFoundException

    // TODO 7: POST /api/books — @Valid body, return 201 + Location

    // TODO 8: DELETE /api/books/{id} — delete or throw BookNotFoundException, return 204
}`,
      hints: [
        'For \`GET /api/books\`, iterate \`store.entrySet()\` and map each entry to a \`BookResponse\` using the key as \`id\` and the stored \`CreateBookRequest\` for the other fields.',
        'For \`POST\`, the Location URI pattern is \`"/api/books/" + newId\`. Use \`URI.create()\` then pass to \`ResponseEntity.created(location).body(...)\`.',
        'For \`DELETE\`, \`ResponseEntity.noContent().build()\` produces a 204 with no body. The generic type \`ResponseEntity<Void>\` signals there is no body content.',
      ],
      solution: `import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class BookNotFoundException extends RuntimeException {
    public BookNotFoundException(long id) {
        super("Book " + id + " not found");
    }
}

public record BookResponse(long id, String title, String author, int yearPublished) {}

public record CreateBookRequest(
    @NotBlank(message = "title must not be blank")
    @Size(max = 200, message = "title must be 200 characters or fewer")
    String title,

    @NotBlank(message = "author must not be blank")
    @Size(max = 100, message = "author must be 100 characters or fewer")
    String author,

    @Min(value = 1, message = "yearPublished must be at least 1")
    @Max(value = 2100, message = "yearPublished must be 2100 or earlier")
    int yearPublished
) {}

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(BookNotFoundException.class)
    public ProblemDetail handleNotFound(
            BookNotFoundException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setInstance(URI.create(request.getRequestURI()));
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field",   (Object) fe.getField(),
                        "message", (Object) fe.getDefaultMessage()))
                .toList();
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                ex.getErrorCount() + " constraint violation(s)");
        pd.setTitle("Validation Failed");
        pd.setInstance(URI.create(request.getRequestURI()));
        pd.setProperty("errors", errors);
        return pd;
    }
}

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final Map<Long, CreateBookRequest> store = new ConcurrentHashMap<>();
    private final AtomicLong idSeq = new AtomicLong(1);

    @GetMapping
    public List<BookResponse> listAll() {
        return store.entrySet().stream()
                .map(e -> new BookResponse(
                        e.getKey(),
                        e.getValue().title(),
                        e.getValue().author(),
                        e.getValue().yearPublished()))
                .toList();
    }

    @GetMapping("/{id}")
    public BookResponse getOne(@PathVariable Long id) {
        CreateBookRequest stored = store.get(id);
        if (stored == null) throw new BookNotFoundException(id);
        return new BookResponse(id, stored.title(), stored.author(), stored.yearPublished());
    }

    @PostMapping
    public ResponseEntity<BookResponse> create(
            @Valid @RequestBody CreateBookRequest req) {
        long newId = idSeq.getAndIncrement();
        store.put(newId, req);
        URI location = URI.create("/api/books/" + newId);
        return ResponseEntity.created(location)
                .body(new BookResponse(newId, req.title(), req.author(), req.yearPublished()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!store.containsKey(id)) throw new BookNotFoundException(id);
        store.remove(id);
        return ResponseEntity.noContent().build();
    }
}`,
      explanation: `This exercise is a complete mini-API: four endpoints, correct status codes,
validation, and centralised error handling. It is representative of what a real Spring
service endpoint looks like before persistence is added.

**Status code summary:**
- \`GET\` returning a resource: **200 OK** (plain return or \`ResponseEntity.ok()\`).
- \`POST\` creating a resource: **201 Created** with \`Location\` header pointing to the new resource.
- \`DELETE\` with no body: **204 No Content** (\`ResponseEntity.noContent().build()\`).
- Resource not found: **404 Not Found** — thrown as an exception, caught by the advice.
- Invalid input: **400 Bad Request** — thrown by Spring's validation layer, caught by the advice.

**The advice class is package-private** (no \`public\` on the class declaration) — that is
intentional here to keep the example self-contained. In a real multi-package project you
would put it in a \`web\` or \`exception\` package and make it public.

**Going deeper:** When you add a real database later, the mapping pattern stays the same —
your service method runs inside a \`@Transactional\` boundary, loads the entity, maps it to
a DTO record, and returns the DTO. The controller never sees the entity. The
\`@RestControllerAdvice\` adds one more handler for whatever database-level exceptions you
want to expose (e.g. a unique-constraint violation becoming a 409 Conflict).`,
    },
  ],

  takeaways: [
    '\`@RestController\` + \`@GetMapping\`/\`@PostMapping\` are all you need to expose an HTTP endpoint. Spring handles Tomcat, routing, and JSON serialisation automatically.',
    'Use \`@PathVariable\` for resource identifiers in the URL, \`@RequestParam\` for optional query-string filters, and \`@RequestBody\` for JSON payloads in POST/PUT requests.',
    '\`ResponseEntity\` gives you explicit control over HTTP status codes. Always return **201 Created** with a \`Location\` header for successful POST endpoints, and **204 No Content** for DELETE.',
    'Use **record DTOs** — not JPA entities — as controller return types. Records are concise, immutable, and protect you from lazy-loading crashes and accidental data leaks.',
    '\`@Valid\` on a \`@RequestBody\` parameter activates Jakarta Bean Validation before your method runs. Combine \`@NotBlank\`, \`@Size\`, \`@Positive\`, and similar annotations on the record fields.',
    'A single \`@RestControllerAdvice\` class handles all exceptions in one place. Returning \`ProblemDetail\` (RFC 9457) gives clients a standardised, machine-readable error shape.',
    'Going deeper: once you add Spring Security, configure CORS via a \`CorsConfigurationSource\` bean rather than \`@CrossOrigin\` or \`WebMvcConfigurer\` — the security filter chain runs before the DispatcherServlet and will block preflight requests otherwise.',
  ],
}
