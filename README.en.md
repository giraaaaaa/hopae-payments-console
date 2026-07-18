# Hopae Software Engineer — Take-Home

## 1. Background

You are an engineer building the admin dashboard for a payment platform. You will
implement part of the console screen where merchants review their own payment history.

## 2. What this assignment provides

This assignment gives you a **mock server** (acting as the backend) and **wireframes**
that capture the overall layout of the result.

### Mock server (backend)

- **Provided**: the data schema (`mock-server/db.json`), the **authentication (auth)
  API**, and a **background engine** that evolves the data over time. (Written in
  TypeScript and run directly with `tsx` — no build step.)
- This assignment deliberately **does not hand you a finished backend API.** The
  transaction **list / refund APIs** you'll need to implement the
  requirements are **yours to design and build end to end — from the routes and DTOs
  to the implementation.** (They're marked as `501` stubs in `routes/transactions.ts`.)
- In other words, this is not a "consume the given API" exercise — it's a **"design
  the API surface yourself, then build the frontend on top of it"** exercise.
- **Provided files (reading them is enough)**: `lib/auth.ts`, `lib/store.ts`,
  `server.ts`, `types.ts`. **The file you build**: `routes/transactions.ts` — open it
  and you'll find a **`START YOUR CODE HERE`** marker. See `mock-server/README.md` for
  details.
- That said, "don't touch the provided files" is **not** the rule — you may freely
  modify or extend **any file, including the provided ones, if you decide it makes for
  a better implementation.** (Just note what you changed and why in your README.)

### Wireframes

The wireframes (`wireframes.html`) are **only a reference for the overall shape — not a
design guide.** As long as you meet the requirements below, how you present things on
top is up to you:

- A piece of UI drawn in the wireframe can be **left out** if you decide it isn't part
  of the core flow.
- If you think there's a better approach than the UI/UX the wireframe suggests, **build
  it the way you think is better.**
- Even UI that **isn't in the wireframe** can be **added freely** if you decide it's
  needed for a better user experience.

In short, treat the wireframe as "roughly these screens exist," not "it must look like
this," and show us your judgment in **building a better product.** The requirements
below, however, must be met.

## 3. Implementation requirements

**Tech stack**: **React + TypeScript** (you may use a React-based framework such as
Next.js if you need one). The bundler/routing setup and other libraries (state
management, data fetching, styling, UI kits like shadcn) are all your choice. (Record
the reasons for your choices in the README — see §4.)

### Login

- An email + password form that calls `POST /api/auth/login`
- On success, store the token and move to the dashboard; on failure, give the user
  clear feedback
- Test account: `demo@hopae.com / password123`

### Sandbox / Production switching

- Expose a Sandbox ↔ Production switcher; switching updates the data accordingly.
- **Sandbox** is a test environment (no real money moves); **Production** is the live
  environment (real revenue, customers, refunds).
- Keep the difference between the two environments firmly in mind and design the UI/UX
  around it. How far and how you differentiate is your call — **write the decision and
  your reasoning in the README.**

### Transaction List

- The transaction list (ID, amount, currency, status, customer name, created date)
- **Near real-time updates**: the mock server automatically creates new transactions
  and changes the status of existing ones (`pending` → `succeeded`/`failed`). These
  changes should be reflected in the admin console UI in a reasonable way, **without
  interrupting the user's flow.** *When and how you refresh the list is entirely your
  choice.* Put yourself in the shoes of someone actually using this console and design
  the most natural UX you can.
- **Status filter**: narrow by status (`succeeded`/`pending`/`failed`/`refunded`)
- **Search**: by transaction ID and customer email
- Where and how you handle filtering/search is your choice — **write your reasoning in
  the README.**
- Implement the list API with **pagination.** How the frontend calls the API and
  renders it is also your call.
- **Refund**: the list must let you refund a transaction (e.g. a per-row action with a
  confirmation step). **How you model the refund** — in the data, the list, and the
  API — is your design, and so is how the list reflects a refund before/after it lands.
  How you handle the row being updated in the background mid-refund is also up to you.

## 4. What to consider when submitting (what we value)

Submit via a GitHub repository (public or invited), and include **how to run it (app +
mock server)** in the README. Because some things only show up when actually used, use
a **demo (video or screenshots)** to show especially the **environment switching** and
**near real-time updates** *actually working.* (Static screenshots alone don't reveal
the core features.)

> **AI use is actively encouraged.** Use AI tools freely to produce a better result —
> don't spend time wondering "is it okay to use AI." (Whatever tools you used, in the
> end we evaluate the result.)

Beyond that, here's what we weigh:

### We weigh the README as heavily as the implementation

- **Your tech choices and why** — which libraries/approaches you chose and why. In
  particular, be explicit about **where you store the environment (env) state** and
  **how you implemented the near real-time updates.**
- **The decisions you made** — this assignment deliberately leaves many decision points
  open, and the nature of a time-boxed take-home means even more decisions are needed
  beyond the spec. Write **concretely where you made which decisions and why.** (e.g.,
  the shape of the API/DTOs you designed and your reasoning, how the env is passed,
  refund modeling, how new transactions are surfaced in the
  UI, and what you'd improve with more time or intentionally simplified/omitted.)
- It's fine not to finish every screen. **For the parts you didn't get to, weave into
  the README what you were thinking and how you'd have approached them.**

### Overall usability

- We'd love to see careful thought about how each state — loading / error / empty /
  success / updated — is communicated to the user.
- It's good to see guarding for abnormal access or exceptional cases, with appropriate
  feedback.
- The usability we mean here is **not visual polish (a pretty design).** Even if the
  design is a bit rough, **how you designed the actual customer experience — how you
  made the user interact with this console — matters far more.**

### Code quality

- Rather than mere code tidiness or skill, please focus on the more structural aspects —
  an extensible structure / bug risk / readability / type safety.

---

> **Time**: this assignment is designed to take roughly **8 hours**. The exact time
> varies from person to person, so focus on the **clarity of your decisions** rather
> than the clock — that matters more than completeness. Please submit within **5 days**
> of the start date.
