# Contributing to ReferralOS

Thank you for your interest in contributing to **ReferralOS**! Whether you are a core hackathon team member, a clinician testing workflows, or an open-source contributor, your involvement helps build a faster, capability-aware healthcare referral coordination network.

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Contributors are expected to:
- Treat fellow contributors and community members with empathy and respect.
- Provide constructive, actionable feedback during code and design reviews.
- Prioritize patient safety, clinical accuracy, and data security in all architectural discussions.

---

## 2. Getting Started & Local Setup

### Prerequisites
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) and Docker Compose v2+
- [Node.js](https://nodejs.org/) v20+ or [Go](https://golang.org/) 1.22+

### Step-by-Step Setup
1. **Fork and Clone the Repository:**
   ```bash
   git clone https://github.com/divinefavourak/referralos.git
   cd referralos
   ```

2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```

3. **Start Local Dependencies:**
   ```bash
   docker compose up -d postgres redis rabbitmq
   ```

4. **Run Database Migrations & Seeds:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Development Servers:**
   ```bash
   npm run dev
   ```

6. **Verify the PPH Emergency Demo:**
   ```bash
   npm run demo:pph-scenario
   ```

---

## 3. Branching & Commit Conventions

### Branch Naming
Create feature branches from `main` using descriptive prefixes:
- `feat/matching-engine-weights` ? New functionality
- `fix/lock-ttl-renewal` ? Bug fixes
- `docs/api-specification-update` ? Documentation edits
- `test/pph-reroute-simulation` ? Test additions or benchmarks
- `chore/docker-compose-redis` ? Maintenance or config changes

### Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```text
<type>(<optional scope>): <short summary>

[optional body]
[optional footer(s)]
```

#### Allowed Types:
- `feat`: A new user-facing or architectural feature.
- `fix`: A bug fix.
- `docs`: Documentation-only changes.
- `refactor`: Code changes that neither fix a bug nor add a feature.
- `test`: Adding missing tests or correcting existing tests.
- `perf`: A code change that improves performance or latency.
- `chore`: Updates to build scripts, dependencies, or tooling.

*Example:*
```bash
git commit -m "feat(matching): add congestion penalty to facility ranking score"
```

---

## 4. Coding & Architecture Guidelines

1. **Safety & Atomicity First:** Never perform unreserved referrals. All capacity claims must pass through the atomic lock coordinator (`Redis Redlock` or PostgreSQL serializable state).
2. **Deterministic Failovers:** Every matching and rerouting logic must handle edge cases where intermediate network connectivity drops or receiving resources fail mid-transit.
3. **Structured Clinical Data:** Adhere to HL7 FHIR standards when defining clinical objects (vitals, observations, encounters).
4. **Clean Code & Formatting:**
   - Run `npm run lint` or `golangci-lint run` prior to pushing.
   - Maintain clear inline documentation for non-obvious algorithms and scoring heuristics.

---

## 5. Pull Request Process

1. Ensure all unit and integration tests pass:
   ```bash
   npm run test
   ```
2. Keep pull requests focused on a single logical change.
3. Update relevant documentation in [`docs/`](./docs/INDEX.md) if your changes modify data models, API endpoints, or routing logic.
4. Open your Pull Request against the `main` branch with:
   - A concise title following Conventional Commits.
   - A clear description of the problem solved and technical approach taken.
   - Steps to reproduce or verify (e.g., CLI commands or UI steps).
5. Address review feedback promptly. Merges require at least one approving review and a green CI pipeline.

---

## 6. Reporting Issues & Proposing Features

- **Bug Reports:** Open an issue on GitHub detailing the expected vs. actual behavior, steps to reproduce, and relevant logs.
- **Feature Proposals:** Open an issue tagged `enhancement` with a clear clinical or technical rationale explaining the problem and proposed solution.




