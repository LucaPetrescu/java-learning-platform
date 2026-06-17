import type { Project } from './types'

// Three capstone projects to BUILD yourself — one per track plus a real-time
// WebSocket build modelled on the existing `starwalker-websocket-service`.
// Markdown fields follow the same convention as the labs: tilde code fences
// (~~~java … ~~~) and escaped inline backticks (\`like this\`).

const javaTelemetry: Project = {
  id: 'proj-java-telemetry',
  track: 'java',
  title: 'Orbital Telemetry Engine',
  subtitle: 'A pure-Java pipeline that ingests satellite telemetry, detects events & reports analytics',
  difficulty: 'capstone',
  estimate: '1–2 weeks',
  tags: ['Pure Java', 'records', 'sealed types', 'generics', 'streams', 'concurrency', 'patterns', 'I/O'],
  overview: `No frameworks — just you and the JDK. Build a command-line engine that reads
streams of satellite **position samples** (latitude, longitude, altitude, azimuth,
elevation, eclipsed, timestamp — the same shape the Starwalker platform pulls from the
N2YO API), cleans and validates them, **detects events** (a satellite rising into view,
setting, entering/leaving eclipse, or a data anomaly), and produces **per-satellite
analytics**.

It's deliberately designed to exercise the *entire* core-Java curriculum at once:
records and sealed types for the domain, a generic processing pipeline, the Strategy
pattern for pluggable detection rules, the Streams API for analytics, and an
\`ExecutorService\` to process many satellites in parallel. This is the project you talk
through when an interviewer asks "tell me about something non-trivial you built in plain
Java."`,
  learningGoals: [
    'Model a domain cleanly with records and a sealed event hierarchy (exhaustive switches)',
    'Design a small, composable generic pipeline instead of one giant method',
    'Apply Strategy / open-closed so new detection rules drop in without edits elsewhere',
    'Turn nested loops into Stream + Collectors analytics',
    'Parallelise CPU work safely with ExecutorService + Futures and prove the results match the sequential baseline',
    'Handle malformed real-world input without crashing (custom exceptions / a Result type)',
  ],
  requirements: `**Domain (Lab 12, 2, 3)**
- Model a \`Satellite\` and immutable, timestamped \`Sample\` records (mirror the Starwalker \`Position\`: lat, long, altitude, azimuth, elevation, eclipsed, timestamp).
- Represent detected events with a **sealed interface** \`Event\` permitting \`PassStart\`, \`PassEnd\`, \`EclipseEnter\`, \`EclipseExit\`, \`Anomaly\` — so consumers can \`switch\` over them exhaustively with no default.

**Ingestion (Lab 7)**
- Read telemetry from a directory of CSV (and optionally JSON) files, one satellite per file or a mixed feed.
- Tolerate bad data: malformed rows are collected as errors and reported, never crash the run. Use a custom exception type or a \`Result<T>\` rather than returning \`null\`.

**Pipeline (Lab 10, 11)**
- Build a generic, composable \`Stage<I, O>\` (a \`Function\`-like contract) and chain stages: raw → validated → ordered-by-time → events. Pipelines compose with \`andThen\`.

**Rule engine (Lab 4, 8, 9)**
- Detection rules implement a \`DetectionRule\` interface (Strategy). Ship at least: an elevation-threshold rule (pass start/end when elevation crosses 0°/10°), an eclipse-transition rule, and a gap/anomaly rule (a suspicious jump or a time gap). Adding a rule must not require touching the engine.

**Analytics (Lab 6, 11)**
- With Streams + Collectors, compute per-satellite stats: number of passes, longest pass duration, max elevation, % of samples eclipsed, count of data gaps. Group results by satellite into a \`Map\`.

**Concurrency (Lab 12)**
- Process each satellite on an \`ExecutorService\`, combine \`Future\` results, and compare wall-clock against a sequential run. No shared mutable state across tasks.

**Output**
- Print a readable report and/or write a JSON/CSV summary per satellite.`,
  milestones: [
    {
      title: 'Domain & ingestion',
      tasks: [
        'Define the `Sample` and `Satellite` records and the sealed `Event` interface',
        'Write a CSV reader that parses samples and accumulates malformed-row errors',
        'Unit-test parsing against a fixture with a few deliberately bad rows',
      ],
    },
    {
      title: 'Detection rules',
      tasks: [
        'Define the `DetectionRule` Strategy interface',
        'Implement the elevation-threshold, eclipse-transition, and gap/anomaly rules',
        'Emit events and consume them with an exhaustive `switch` over the sealed type',
      ],
    },
    {
      title: 'Analytics pipeline',
      tasks: [
        'Build the generic `Stage<I,O>` and compose the cleaning → detection pipeline',
        'Compute per-satellite stats with Streams + Collectors',
        'Verify analytics against hand-computed numbers on a small fixture',
      ],
    },
    {
      title: 'Concurrency & CLI',
      tasks: [
        'Run satellites in parallel with an `ExecutorService`, join `Future`s',
        'Assert parallel results equal the sequential baseline; measure the speedup',
        'Add a CLI (input dir, rules to enable, output format) and write reports',
      ],
    },
  ],
  acceptanceCriteria: [
    'Parses the sample dataset without crashing on malformed rows (errors are reported)',
    'Correctly detects passes and eclipse transitions on the provided fixtures',
    'Per-satellite analytics match hand-computed values for a small input',
    'Parallel run produces identical results to the sequential run',
    'Uses only the JDK — no third-party runtime dependencies',
    'Has unit tests for at least the rules and the analytics',
  ],
  stretchGoals: [
    'Add a `ServiceLoader`-based plugin SPI so rules can be dropped in as separate jars',
    'Parse real TLE data and propagate orbits (SGP4) instead of replaying samples',
    'Process telemetry as an online stream (bounded memory) rather than batch',
    'Add a tiny DSL/config for rule thresholds',
    'Benchmark the concurrency speedup and write up the scaling curve',
  ],
  interviewAngle: `This is your "I can write real Java, not just syntax" story. It shows architecture
(open-closed rules, a composable pipeline), modern language features (records, sealed
types, pattern matching), and correct concurrency.

**Questions you should be ready for:**
- Why records here? What do sealed types buy you over an enum or plain interface?
- How is your aggregation thread-safe? What would break if two tasks shared a collector?
- How would you add a brand-new event type or rule without breaking existing callers?
- How do you test the detection rules in isolation?
- Where would this fall over at 10× the data, and what would you change?`,
  techStack: ['JDK 21+ (you have 24)', 'JUnit 5', 'Maven or plain javac', 'no frameworks'],
  relatedLabs: ['lab-04', 'lab-06', 'lab-07', 'lab-08', 'lab-09', 'lab-10', 'lab-11', 'lab-12'],
  startingPoint: `Generate or hand-write a sample CSV with a header like:

~~~text
satelliteId,name,timestamp,latitude,longitude,altitude,azimuth,elevation,eclipsed
25544,ISS,1718450000,45.1,12.3,420.5,180.2,34.7,false
~~~

Suggested package layout: \`domain\` (records + sealed events), \`ingest\` (readers +
errors), \`rules\` (the Strategy implementations), \`pipeline\` (the generic stages),
\`analytics\` (collectors), \`cli\` (entry point). Start with the domain + one rule end to
end on a tiny file, then widen. You can crib the field set from the Starwalker platform's
\`Position\` DTO (\`satlatitude\`, \`satlongitude\`, \`sataltitude\`, \`azimuth\`, \`elevation\`,
\`eclipsed\`, \`timestamp\`).`,
}

const springGateway: Project = {
  id: 'proj-spring-gateway',
  track: 'spring',
  title: 'Satellite Tracking Gateway',
  subtitle: 'A resilient, cached integration service in front of an external tracking API — not a CRUD app',
  difficulty: 'capstone',
  estimate: '1–2 weeks',
  tags: ['Spring Boot 4', 'RestClient', 'caching', 'resilience4j', '@Scheduled', '@ConfigurationProperties', 'Actuator'],
  overview: `The Starwalker platform already calls the **N2YO satellite API** to fetch "satellites
above an observer", a single satellite's track, and the closest ones. That existing
service is a thin pass-through. This project rebuilds it as a **production-grade gateway**
where the interesting work is everything *around* the call.

The upstream API is rate-limited and occasionally slow or down. Your gateway must protect
it (and your users) with **caching**, **scheduled refresh**, **timeouts + retries + a
circuit breaker with a stale fallback**, **type-safe configuration and profiles**, and
**Actuator metrics/health**. There is intentionally almost no database and no CRUD — the
skill on display is integration, resilience, and observability, which is what separates a
"can use Spring annotations" candidate from a "can run a service in production" one.`,
  learningGoals: [
    'Integrate an external HTTP API with RestClient and your own response model (never leak upstream DTOs)',
    'Design a caching layer with sensible TTL/size + a scheduled warm-up to respect a rate limit',
    'Add resilience: connect/read timeouts, retry-with-backoff, and a circuit breaker with a fallback',
    'Externalise everything with @ConfigurationProperties, profiles, and env-based secrets',
    'Expose health and metrics (cache hit ratio, upstream latency) via Actuator + Micrometer',
    'Test code that calls a third party without ever touching the network',
  ],
  requirements: `**Client & model (Lab 15)**
- Call the upstream with \`RestClient\` (Spring 6+/Boot 4 — not \`RestTemplate\`). Map responses to **your own** records; do not expose upstream DTOs to your callers.
- Expose a small read API: satellites above the observer, a single satellite track, and the closest N. Return \`ProblemDetail\` on errors and validate query params (lat/long ranges).

**Configuration (Lab 14)**
- Base URL, API key, observer location, cache TTLs, timeouts, and retry policy all bound via \`@ConfigurationProperties\` (\`@Validated\`). Separate \`dev\` and \`prod\` profiles. The API key comes from an environment variable — never commit it.

**Caching**
- Cache upstream responses (Caffeine via Spring's cache abstraction) with TTL + max size. A \`@Scheduled\` job warms the "satellites above" cache so ordinary user traffic doesn't burn the API-key budget.

**Resilience (Lab 7)**
- Connect/read timeouts on the client. Retry transient failures with exponential backoff. A **circuit breaker** (Resilience4j) that opens after repeated upstream failures and serves the last good (stale) cached value as a fallback; surface a clear \`503\` only when there's nothing to serve.

**Observability (Lab 17)**
- A custom Actuator \`HealthIndicator\` that pings the upstream. Micrometer metrics for cache hit ratio and upstream latency. A correlation id on every request (filter/interceptor) flowing into logs.`,
  milestones: [
    {
      title: 'Config & client',
      tasks: [
        'Bind config with `@ConfigurationProperties` + `@Validated`, dev/prod profiles, key from env',
        'Build the `RestClient`, map upstream JSON to your own records',
        'Expose one read endpoint returning your model',
      ],
    },
    {
      title: 'Caching & scheduled warm-up',
      tasks: [
        'Add Spring cache + Caffeine with TTL/size',
        'Add a `@Scheduled` warm-up for the "above" query',
        'Expose a cache-hit metric and confirm hits via Actuator',
      ],
    },
    {
      title: 'Resilience',
      tasks: [
        'Set connect/read timeouts',
        'Add retry-with-backoff for transient errors',
        'Add a Resilience4j circuit breaker with a stale-cache fallback and a degraded 503',
      ],
    },
    {
      title: 'Errors, validation & observability',
      tasks: [
        '`@RestControllerAdvice` → `ProblemDetail`; validate query params',
        'Custom Actuator health indicator + Micrometer latency metric',
        'Tests: `MockRestServiceServer`/WireMock for the upstream, a `@WebMvcTest` for the controller',
      ],
    },
  ],
  acceptanceCriteria: [
    'Runs against the real API in `dev` and against a stubbed upstream in tests (no real network in tests)',
    'Demonstrably respects the upstream rate limit (cache-hit metric proves traffic is absorbed)',
    'When the upstream is down the circuit opens, a stale/fallback value is served, and health goes DOWN',
    'No secrets in the repository; the API key is read from the environment',
    'Tests cover the happy path, an upstream failure, and a validation error',
  ],
  stretchGoals: [
    'Rate-limit your own API (bucket4j) and return 429 with Retry-After',
    'ETag / conditional GET on your endpoints',
    'OpenAPI docs via springdoc',
    'Push fresh positions to the WebSocket hub (project below) when the cache refreshes',
    'A Testcontainers + WireMock integration test',
  ],
  interviewAngle: `This is the "senior backend" project. Anyone can scaffold a CRUD controller; far fewer
can talk credibly about caching strategy, resilience, and config/secrets.

**Questions you should be ready for:**
- Cache TTL vs invalidation — how did you pick, and what about a cache stampede?
- Retry vs circuit breaker — when does each help, and how do they interact with timeouts?
- How do you test code that calls a third-party API? Why not hit the real one?
- Where do secrets live across environments?
- How do \`@Scheduled\` warm-ups and per-request caching cooperate?
- The upstream is down — what does a user see, and what does your health endpoint say?`,
  techStack: ['Spring Boot 4', 'spring-boot-starter-webmvc', 'RestClient', 'Caffeine + Spring Cache', 'Resilience4j', 'Actuator + Micrometer', 'validation', 'tests: spring-boot-starter-webmvc-test, MockRestServiceServer / WireMock'],
  relatedLabs: ['lab-07', 'lab-12', 'lab-13', 'lab-14', 'lab-15', 'lab-17'],
  startingPoint: `Use the existing \`starwalkerplatform\` service as the seed — it already has
\`N2YOConfig\`, a \`SatelliteService\` (currently using \`RestTemplate\`), the \`Position\` DTO,
and a \`SatelliteController\`. Your first move is to swap \`RestTemplate\` → \`RestClient\` and
move the hard-coded URL/key into \`@ConfigurationProperties\`, then layer caching →
resilience → observability on top. Grab a free N2YO API key for \`dev\`; in tests, stub the
upstream so nothing hits the network.`,
}

const springWebSocket: Project = {
  id: 'proj-spring-websocket',
  track: 'spring',
  title: 'Mission Control Telemetry Hub',
  subtitle: 'Real-time satellite positions streamed to clients over STOMP — extends your starwalker-websocket-service',
  difficulty: 'capstone',
  estimate: '1–2 weeks',
  tags: ['Spring Boot 4', 'WebSocket', 'STOMP', 'SockJS', '@Scheduled', 'SimpMessagingTemplate', 'real-time'],
  overview: `Your \`starwalker-websocket-service\` is already scaffolded with a STOMP message broker —
it has \`@EnableWebSocketMessageBroker\`, a simple broker on \`/topic\`, an application
destination prefix \`/app\`, and a SockJS endpoint at \`/ws\`. What it doesn't have yet is
any telemetry actually flowing.

This project turns it into a **real-time mission-control hub**: a scheduled publisher
broadcasts live satellite positions to per-satellite topics, browser clients subscribe to
the satellites they care about and send commands (track this satellite, set my observer
location), and the server tracks subscriptions so it only does work for satellites that
someone is actually watching. Real-time/WebSocket experience is a genuine differentiator
in interviews, and this one is grounded in code you already started.`,
  learningGoals: [
    'Design a STOMP messaging app: broker, destinations, and the /app vs /topic split',
    'Broadcast from a server-side @Scheduled publisher with SimpMessagingTemplate',
    'Handle client→server messages with @MessageMapping and reply to a single session',
    'React to session lifecycle (connect / subscribe / disconnect) events',
    'Avoid unbounded fan-out: only publish satellites that have subscribers; throttle updates',
    'Test asynchronous STOMP messaging with the Spring WebSocket test client',
  ],
  requirements: `**Start from the existing config**
- Keep the \`WebSocketConfig\` you already have (simple broker \`/topic\`, prefix \`/app\`, endpoint \`/ws\` with SockJS) and build on it. Set allowed origins for the webapp (e.g. \`http://localhost:5173\`).

**Telemetry source (Lab 14)**
- Feed positions either from the Gateway project above or a simple orbit simulator. A \`@Scheduled\` publisher emits each *tracked* satellite's position at a fixed rate.

**Broadcast**
- Publish each satellite to \`/topic/satellites/{id}\` and a rolled-up summary to \`/topic/overview\`, using \`SimpMessagingTemplate.convertAndSend\`.

**Client commands (Lab 15)**
- \`@MessageMapping("/track")\` to start tracking a satellite id (validate it); \`@MessageMapping("/observer")\` to set the caller's observer location. Reply to the **calling session only** via a user destination, not the broadcast topic.

**Sessions & efficiency (Lab 13)**
- Listen for \`SessionConnect\` / \`SessionSubscribe\` / \`SessionDisconnect\` events. Maintain subscriber counts per satellite and **only publish satellites that have at least one subscriber** — don't poll or broadcast for things nobody is watching.

**Throttling**
- Cap the broadcast rate, coalesce rapid updates, and drop stale frames so a slow client can't build an unbounded backlog.`,
  milestones: [
    {
      title: 'First broadcast',
      tasks: [
        'Add a `@Scheduled` publisher that sends a dummy position to `/topic/satellites/25544`',
        'Connect a SockJS + stomp.js client (or the test client) and see frames arrive',
      ],
    },
    {
      title: 'Dynamic per-satellite tracking',
      tasks: [
        'Add `@MessageMapping("/track")` to register a satellite id (with validation)',
        'Publish each tracked satellite to its own `/topic/satellites/{id}`',
        'Wire in the real/simulated position source',
      ],
    },
    {
      title: 'Sessions & efficiency',
      tasks: [
        'Handle subscribe/disconnect events; keep per-satellite subscriber counts',
        'Stop publishing a satellite once its last subscriber leaves',
        'Broadcast a live summary (watchers, tracked count) to `/topic/overview`',
      ],
    },
    {
      title: 'Targeted replies, throttling & tests',
      tasks: [
        'Reply to the calling session only for `/app/observer` (user destination)',
        'Add rate-limiting / coalescing for the publisher',
        'Write an integration test with the Spring STOMP test client that subscribes and asserts a frame',
      ],
    },
  ],
  acceptanceCriteria: [
    'A client subscribing to `/topic/satellites/{id}` receives periodic position frames',
    'Sending `/app/track` for a new id starts its broadcast; ids are validated',
    'When the last subscriber for a satellite disconnects, its broadcast stops',
    'The server never polls or broadcasts satellites that nobody is watching',
    'An automated STOMP test connects, subscribes, and asserts a position frame arrives',
  ],
  stretchGoals: [
    'Swap the simple broker for an external broker relay (RabbitMQ/ActiveMQ) and discuss multi-instance scaling',
    'Authenticate the STOMP CONNECT and use per-user destinations',
    'Presence: broadcast "N people watching" per satellite',
    'Replay the last-known position to a client the moment it subscribes',
    'Wire the existing Three.js `starwalker-webapp` up as the live client',
  ],
  interviewAngle: `WebSocket/real-time work is rarer on résumés than REST, so it stands out — and it
forces you to reason about state, lifecycle, and scaling.

**Questions you should be ready for:**
- WebSocket vs Server-Sent Events vs polling — when would you pick each?
- What does STOMP give you over raw WebSocket frames?
- Simple broker vs an external broker relay — why and when?
- How do WebSockets scale across multiple server instances? (sticky sessions / broker relay)
- How do you stop a slow consumer or an unwatched satellite from causing unbounded work?
- How do you even test asynchronous messaging deterministically?`,
  techStack: ['Spring Boot 4', 'spring-boot-starter-webmvc', 'spring-boot-starter-websocket', 'STOMP + SockJS', 'SimpMessagingTemplate', '@Scheduled', 'tests: spring-boot-starter-websocket-test (STOMP client)', 'client: stomp.js / the starwalker-webapp'],
  relatedLabs: ['lab-12', 'lab-13', 'lab-14', 'lab-15', 'lab-17'],
  startingPoint: `You already have the foundation in \`starwalker-websocket-service\`:

~~~java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").withSockJS();
    }
}
~~~

Keep this. The next commit is a \`@Scheduled\` component that calls
\`SimpMessagingTemplate.convertAndSend("/topic/satellites/25544", position)\` — get one
frame flowing to a test client first, then add \`@MessageMapping\` handlers and
session bookkeeping. Pull positions from the Gateway project, or simulate a slowly-moving
point to start.`,
}

export const projects: Project[] = [javaTelemetry, springGateway, springWebSocket]

export const projectById = (id: string): Project | undefined =>
  projects.find((p) => p.id === id)
