# ☕ Java Path

A local, single-page web app for getting **interview-ready in Java** over ~4 months.
Pitched at developers who already know the basics — the content focuses on the nuance,
gotchas, idioms, and design depth that come up in mid-level interviews and code reviews.

It follows the 12-lab structure of the
[POO Java curriculum](https://ocw.cs.pub.ro/courses/poo-ca-cd/laboratoare/poo-java),
re-pitched to an intermediate level.

## What's inside

- **17 labs across two tracks:**
  - **Core Java (12)** — the sharp edges of the language, collections, I/O, design
    patterns, generics, streams, and modern Java (records, sealed types, pattern
    matching, concurrency).
  - **Spring Boot (5)** — IoC/DI, Boot essentials & configuration, web APIs, Spring Data
    JPA, and testing. Written against **Spring Boot 4** conventions (split starters like
    `spring-boot-starter-webmvc`, `@MockitoBean`, `RestClient`, `ProblemDetail`).
- **3 capstone projects to build yourself** (space-themed to compose into one portfolio):
  - **Orbital Telemetry Engine** (pure Java) — records/sealed events, a generic pipeline,
    Strategy rules, streams analytics, concurrent processing.
  - **Satellite Tracking Gateway** (Spring Boot) — *not* a CRUD API: external integration
    with RestClient, caching, scheduled refresh, retries + circuit breaker, Actuator.
  - **Mission Control Telemetry Hub** (Spring Boot + WebSocket/STOMP) — a real-time fan-out
    service that directly extends the `starwalker-websocket-service` you already have.
- **Theory** per lab — collapsible, markable-as-read, written as a sharp refresher.
- **48 exercises** (mostly *core* / *challenge*) with a built-in Java editor, progressive
  hints, reference solutions, and explanations. No "Hello World".
- A **~20-week study plan** that paces both tracks plus the three capstones, with
  consolidation and mock-interview weeks.
- **Progress tracking** in the browser (localStorage). No account, no backend.

## Running exercises

The app is **editor + solutions** by design — there's no in-browser Java execution.
Write your attempt in the CodeMirror editor, hit **Copy code**, and run it with your own
JDK:

```bash
# JDK 11+ can run a single file directly:
java Solution.java

# or compile then run:
javac Solution.java && java Solution
```

You have a JDK installed already (`java --version` to check).

## Quick start

```bash
npm install
npm run dev
```

Then open **http://localhost:5180**.

```bash
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

## Tech stack

- **Vite + React 19 + TypeScript** (strict)
- **React Router** for navigation
- **CodeMirror 6** (`@uiw/react-codemirror` + `@codemirror/lang-java`) — local Java editor
- **react-markdown** + **rehype-highlight** for theory rendering
- Hand-rolled CSS design system (no UI framework)

## Project structure

```
src/
  content/
    types.ts        # Lab / Exercise / Project / PlanWeek types (+ Track)
    lab01.ts … lab12.ts   # Core Java labs
    lab13.ts … lab17.ts   # Spring Boot labs (track: 'spring')
    projects.ts     # the 3 capstone project briefs
    studyPlan.ts    # the ~20-week plan
    index.ts        # assembles labs (by track) + projects
  components/       # Layout, Sidebar, Markdown, CodeEditor, ExerciseCard, TheoryBlock
  pages/            # Dashboard, PlanPage, LabPage, ProjectsPage, ProjectPage, NotFound
  state/            # ProgressContext (localStorage-backed)
  lib/              # progress / id helpers
  styles/index.css  # design system
```

## Editing or adding content

Each lab is a plain TypeScript object in `src/content/labNN.ts` typed against
`Lab` in `types.ts`. To add a lab, create the file and add it to the array in
`src/content/index.ts`.

**Markdown convention:** content strings are JS template literals, so code blocks use
**tilde fences** (`~~~java … ~~~`) instead of backtick fences, and any inline code escapes
its backticks (`` \` ``). This keeps the markdown safe inside the template literals.

## The capstone projects

These are **briefs to implement yourself** (the learning is in the building), not
reference solutions — each has goals, staged milestones, acceptance criteria, stretch
goals, and the interview angle. They're space-themed to mirror your existing **Starwalker**
repos:

- The **Gateway** project seeds from `starwalkerplatform` (the N2YO API integration) and
  elevates it with caching/resilience/observability.
- The **Mission Control Hub** picks up directly from `starwalker-websocket-service` — it
  already has the STOMP broker (`/topic`), app prefix (`/app`), and SockJS endpoint
  (`/ws`); the brief is the telemetry flow you build on top.

Build them in their own repos / your IDE — they're not part of this React app.

## Notes

- Spring labs target **Spring Boot 4** to match your environment (the split starter
  artifact names, `@MockitoBean`, `RestClient`, `ProblemDetail`).
- The JS bundle is large (~1.8 MB, mostly CodeMirror) — irrelevant for local use.
```
