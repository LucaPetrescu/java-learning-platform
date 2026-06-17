import type { PlanWeek } from './types'

// A ~20-week (~5 month) plan: 12 core-Java labs, a Java capstone, 5 Spring Boot
// labs, and two Spring capstones, with consolidation and mock-interview weeks.
// Compress or stretch to fit your schedule — the order matters more than timing.

export const studyPlan: PlanWeek[] = [
  // ---- Phase 1: Core Java Foundations ----
  {
    week: 1,
    phase: 'Core Java · Foundations',
    focus: 'Language sharp-edges: numerics, overload resolution, pass-by-value, arrays',
    labIds: ['lab-01'],
    goals: [
      'Run a single file with `java File.java`',
      'Explain pass-by-value and the Integer cache from memory',
      'Finish all Lab 1 exercises (incl. the spiral matrix)',
    ],
  },
  {
    week: 2,
    phase: 'Core Java · Foundations',
    focus: 'Objects, equality, immutability & defensive copying',
    labIds: ['lab-02'],
    goals: [
      'Implement equals()/hashCode() correctly and know what breaks a HashSet',
      'Build an immutable value type with defensive copies',
    ],
  },
  {
    week: 3,
    phase: 'Core Java · Foundations',
    focus: 'Inheritance, polymorphism & the Object contract traps',
    labIds: ['lab-03'],
    goals: [
      'Explain dynamic dispatch and the equals-symmetry/Liskov problem',
      'Know the "overridable method in a constructor" pitfall',
    ],
  },
  {
    week: 4,
    phase: 'Core Java · Foundations',
    focus: 'Abstraction: interfaces, default-method conflicts, enums, access control',
    labIds: ['lab-04'],
    goals: [
      'Choose interface vs abstract class deliberately',
      'Use a behaviour-carrying enum and resolve a default-method diamond',
    ],
    milestone: 'OOP fundamentals solid',
  },
  // ---- Phase 2: Standard Library ----
  {
    week: 5,
    phase: 'Core Java · Standard Library',
    focus: 'Inner/anonymous classes & the String API',
    labIds: ['lab-05'],
    goals: ['Sliding-window string algorithms', 'Know String pooling/interning cold'],
  },
  {
    week: 6,
    phase: 'Core Java · Standard Library',
    focus: 'Collections, ordering & Big-O',
    labIds: ['lab-06'],
    goals: [
      'Pick the right collection and justify the Big-O',
      'Build an LRU cache and a top-K with a heap',
    ],
  },
  {
    week: 7,
    phase: 'Core Java · Standard Library',
    focus: 'Exceptions & I/O done right',
    labIds: ['lab-07'],
    goals: [
      'Design a checked-vs-unchecked strategy',
      'Use try-with-resources and understand suppressed exceptions',
    ],
    milestone: 'Comfortable across the standard library',
  },
  // ---- Phase 3: Design & Type System ----
  {
    week: 8,
    phase: 'Core Java · Design & Types',
    focus: 'Creational & structural patterns',
    labIds: ['lab-08'],
    goals: ['Implement a thread-safe singleton, a validating Builder, a Decorator chain'],
  },
  {
    week: 9,
    phase: 'Core Java · Design & Types',
    focus: 'Behavioural patterns',
    labIds: ['lab-09'],
    goals: ['Strategy with lambdas, an Observer bus, Command with undo/redo'],
  },
  {
    week: 10,
    phase: 'Core Java · Design & Types',
    focus: 'Generics: bounds, wildcards, PECS, erasure',
    labIds: ['lab-10'],
    goals: ['Explain PECS and type erasure', 'Build a type-safe heterogeneous container'],
  },
  // ---- Phase 4: Modern Java + Java capstone ----
  {
    week: 11,
    phase: 'Core Java · Modern',
    focus: 'Lambdas, streams & collectors',
    labIds: ['lab-11'],
    goals: ['Replace loops with stream pipelines', 'Use groupingBy with downstream collectors'],
  },
  {
    week: 12,
    phase: 'Core Java · Modern',
    focus: 'Records, sealed types, pattern matching & concurrency',
    labIds: ['lab-12'],
    goals: ['Exhaustive pattern-matching switches', 'Aggregate concurrently with an ExecutorService'],
    milestone: 'Core Java complete',
  },
  {
    week: 13,
    phase: 'Java Capstone',
    focus: 'Build the Orbital Telemetry Engine (pure Java)',
    labIds: [],
    projectIds: ['proj-java-telemetry'],
    goals: [
      'Domain (records + sealed events), ingestion with error handling',
      'Detection rules (Strategy) + streams analytics',
      'Parallelise across satellites and match the sequential baseline',
    ],
    milestone: 'A non-trivial pure-Java project to talk about',
  },
  // ---- Phase 5: Spring Boot ----
  {
    week: 14,
    phase: 'Spring Boot',
    focus: 'IoC & dependency injection',
    labIds: ['lab-13'],
    goals: ['Explain the container, scopes and why constructor injection', 'Fix a prototype-in-singleton bug'],
  },
  {
    week: 15,
    phase: 'Spring Boot',
    focus: 'Boot essentials, auto-configuration & typed config',
    labIds: ['lab-14'],
    goals: ['Trace auto-configuration', 'Bind validated @ConfigurationProperties + profiles'],
  },
  {
    week: 16,
    phase: 'Spring Boot',
    focus: 'Web APIs: MVC, validation & ProblemDetail',
    labIds: ['lab-15'],
    goals: ['Centralise errors with @RestControllerAdvice + ProblemDetail', 'Validate request DTOs'],
  },
  {
    week: 17,
    phase: 'Spring Boot',
    focus: 'Data access with Spring Data JPA',
    labIds: ['lab-16'],
    goals: ['Fix an N+1', 'Explain @Transactional propagation and the self-invocation trap'],
  },
  {
    week: 18,
    phase: 'Spring Boot',
    focus: 'Testing & production-readiness',
    labIds: ['lab-17'],
    goals: ['Slice tests (@WebMvcTest/@DataJpaTest)', 'Mock outbound HTTP; know when to integration-test'],
    milestone: 'Spring Boot interview-ready',
  },
  // ---- Phase 6: Spring capstones + interviews ----
  {
    week: 19,
    phase: 'Spring Capstones',
    focus: 'Build the Satellite Tracking Gateway',
    labIds: [],
    projectIds: ['proj-spring-gateway'],
    goals: [
      'External API integration with RestClient + your own model',
      'Caching + scheduled warm-up, resilience (retry + circuit breaker)',
      'Actuator health/metrics; tests with a stubbed upstream',
    ],
  },
  {
    week: 20,
    phase: 'Spring Capstones',
    focus: 'Build the Mission Control Telemetry Hub + mock interviews',
    labIds: [],
    projectIds: ['proj-spring-websocket'],
    goals: [
      'STOMP broadcast from a scheduled publisher; per-satellite topics',
      'Session lifecycle + only publish watched satellites; STOMP test',
      'Two timed mock interviews (one coding, one system/Spring design)',
    ],
    milestone: 'Portfolio + interview-ready 🎯',
  },
]
