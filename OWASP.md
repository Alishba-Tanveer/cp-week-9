# OWASP Top 10 Security Checklist

This document maps the OWASP Top 10 risks to concrete security controls implemented in Week 9.

## A01: Broken Access Control

**Mitigation:**

* JWT authentication is enforced globally through `JwtAuthGuard`.
* Public endpoints are explicitly marked with the `@Public()` decorator.
* Role-based authorization is enforced through `RolesGuard`.
* Project membership roles are checked before protected project/task/comment operations.
* Ownership is derived from the authenticated JWT user rather than trusted client-supplied owner identifiers.

**Implemented in:**

* `src/auth/guards/jwt-auth.guard.ts`
* `src/auth/guards/roles.guard.ts`
* `src/auth/decorators/public.decorator.ts`
* `src/auth/decorators/roles.decorator.ts`
* `src/projects/projects.controller.ts`
* `src/tasks/tasks.controller.ts`
* `src/comments/comments.controller.ts`

---

## A02: Cryptographic Failures

**Mitigation:**

* User passwords are never stored in plaintext.
* Passwords are hashed with Argon2.
* Argon2 parameters are configurable through environment variables.
* JWT signing uses a configurable secret.
* Refresh tokens are stored as hashes rather than plaintext tokens.
* Refresh tokens support expiration and revocation.

**Implemented in:**

* `src/auth/auth.service.ts`
* `src/entities/RefreshToken.ts`
* `src/database/migrations/`
* `.env.example`

---

## A03: Injection

**Mitigation:**

* TypeORM is used for database access instead of manually concatenating SQL queries.
* DTO validation restricts accepted request data.
* `ValidationPipe` uses `whitelist: true`.
* `ValidationPipe` uses `forbidNonWhitelisted: true`.

**Implemented in:**

* `src/main.ts`
* `src/users/dto/`
* `src/projects/dto/`
* `src/tasks/dto/`
* `src/comments/dto/`
* TypeORM repositories/services throughout `src/`

---

## A04: Insecure Design

**Mitigation:**

* Authentication and authorization are separated into guards.
* JWT access and refresh tokens use separate expiration configuration.
* Refresh token rotation revokes the previous refresh token.
* Reuse of a revoked refresh token is rejected.
* Authentication endpoints have stricter rate limiting.
* Security-sensitive configuration is supplied through environment variables.

**Implemented in:**

* `src/auth/auth.service.ts`
* `src/auth/guards/jwt-auth.guard.ts`
* `src/auth/auth.controller.ts`
* `src/config/throttler.config.ts`
* `src/config/env.validation.ts`

---

## A05: Security Misconfiguration

**Mitigation:**

* Helmet is enabled globally.
* CORS is restricted to the configured frontend origin.
* CORS configuration is loaded from `CORS_ORIGIN`.
* Environment variables are validated during application startup.
* TypeORM uses `synchronize: false`.
* Global request validation rejects unexpected properties.
* A global exception filter prevents internal exception details from being returned.

**Implemented in:**

* `src/config/security.ts`
* `src/config/env.validation.ts`
* `src/main.ts`
* `src/app.module.ts`
* `src/common/filters/http-exception.filter.ts`

---

## A06: Vulnerable and Outdated Components

**Mitigation:**

* Dependencies are managed through `package.json` and `package-lock.json`.
* Dependency security can be checked with `npm audit`.
* Security-sensitive packages such as Helmet and the NestJS throttler are explicitly declared dependencies.

**Implemented in:**

* `package.json`
* `package-lock.json`
* `.github/workflows/security.yml`

**Remaining exposure:**

* Dependency advisories reported by `npm audit` should be reviewed and addressed according to compatibility and severity.
* The CI workflow runs `npm audit --audit-level=high` to make high-severity dependency exposure visible during repository checks.

---

## A07: Identification and Authentication Failures

**Mitigation:**

* Passwords are hashed using Argon2.
* Login failures return the same unauthorized status rather than revealing whether an account exists.
* JWT access tokens are used for authenticated requests.
* Refresh tokens are rotated after successful refresh.
* Previously revoked refresh tokens cannot be reused.
* Authentication routes are rate limited.

**Implemented in:**

* `src/auth/auth.service.ts`
* `src/auth/auth.controller.ts`
* `src/auth/guards/jwt-auth.guard.ts`

---

## A08: Software and Data Integrity Failures

**Mitigation:**

* Database schema changes are applied through migrations.
* TypeORM automatic schema synchronization is disabled.
* Refresh token state is persisted in the database.
* Tests verify authentication, authorization, validation, and security behavior.

**Implemented in:**

* `src/database/migrations/`
* `src/app.module.ts`
* `test/app.e2e-spec.ts`
* `test/security.e2e-spec.ts`

---

## A09: Security Logging and Monitoring Failures

**Mitigation:**

* Unexpected server-side exceptions are logged by the global exception filter.
* HTTP responses do not expose server-side stack traces.
* Authentication and authorization failures are returned through controlled HTTP errors.
* Sensitive values are redacted by the centralized `RedactingLogger`.

**Implemented in:**

* `src/common/filters/http-exception.filter.ts`
* `src/common/logging/redacting-logger.ts`
* `src/common/logging/redacting-logger.spec.ts`

**Remaining exposure:**

* Centralized security event monitoring and structured audit logging are not yet implemented.

---

## A10: Server-Side Request Forgery (SSRF)

**Mitigation / N/A:**

* The current API does not provide a user-controlled server-side URL fetching feature.
* No endpoint accepts an arbitrary URL and makes outbound server-side HTTP requests on behalf of the user.

**Status:** Not applicable to the current application functionality.

---

# Most Exposed OWASP Risk

The API remains most exposed to **A06: Vulnerable and Outdated Components** because the current dependency tree contains known advisories.

At the time of this assignment, `npm audit --audit-level=high` reports 5 vulnerabilities: 2 high, 1 moderate, and 2 low. The high-severity findings include transitive dependencies involving `tmp` and `undici`.

The available automatic fix requires `npm audit fix --force`, which would introduce a breaking dependency change. Therefore, the vulnerable dependency chain has been documented rather than applying an unreviewed breaking upgrade.

This exposure should be managed by regularly reviewing `npm audit` results and updating affected dependencies when compatible versions are available and have been tested.

---

# Assignment 3 Optional Challenges

## X1: Additional Security Hardening

### Content Security Policy

Helmet is configured with an explicit Content Security Policy in:

* `src/config/security.ts`

The policy includes restrictive directives such as:

* `default-src 'self'`
* `script-src 'self'`
* `object-src 'none'`
* `frame-ancestors 'self'`
* `base-uri 'self'`
* `form-action 'self'`

The E2E security test verifies that the CSP header is returned with the expected directives.

Implemented in:

* `src/config/security.ts`
* `test/security.e2e-spec.ts`

### Dependency Audit

A GitHub Actions security workflow runs:

```text
npm audit --audit-level=high
```

The workflow is defined in:

* `.github/workflows/security.yml`

The workflow runs on pushes to `main` and `Assign3`, and on pull requests targeting `main`.

The audit is configured to fail when high-severity or critical dependency vulnerabilities are reported.

At the time of this assignment, the local dependency tree reports known vulnerabilities through `npm audit`. These findings are documented rather than applying an unreviewed `npm audit fix --force`, because the forced fix may introduce breaking dependency changes.

---

## X2: Secret Redaction

Security-sensitive values are centrally redacted by:

* `src/common/logging/redacting-logger.ts`

The logger redacts sensitive fields including:

* passwords
* access tokens
* refresh tokens
* authorization headers
* cookies

Authentication debug logging therefore does not expose the submitted password or token values.

Automated tests verify both object-based and string-based redaction.

Implemented in:

* `src/common/logging/redacting-logger.ts`
* `src/common/logging/redacting-logger.spec.ts`
* `src/auth/auth.service.ts`

Unexpected server errors are logged server-side while the HTTP response remains generic in production.

---

## X3: Environment-Specific Error Handling

The global exception filter reads `NODE_ENV` when handling an unexpected exception.

In development:

* unexpected exception messages are returned to support debugging.

In production:

* unexpected exception messages are replaced with the generic `Internal server error` message.

HTTP exceptions continue to preserve their intended client-facing messages.

In both environments:

* server-side exceptions are logged.
* stack traces are not returned in HTTP responses.
* the response contains only the standardized error fields.

Implemented in:

* `src/common/filters/http-exception.filter.ts`
* `src/common/filters/http-exception.filter.spec.ts`
* `test/setup-e2e.ts`

The E2E test environment explicitly uses:

```text
NODE_ENV=production
```

and verifies that a deliberate server error does not expose database, password, or stack-trace information.

---

# Security Verification Summary

The Assignment 3 security controls are verified through unit and E2E tests.

Verified controls include:

* Authentication route rate limiting with HTTP 429 responses.
* Helmet security headers.
* Content Security Policy.
* Configured CORS origin.
* Rejection of disallowed CORS origins.
* Strict DTO validation.
* Positive integer route parameter validation.
* Standardized 400, 404, and 500 error responses.
* Generic production error responses.
* Password and token log redaction.
* Environment-specific exception handling.

Current verification results:

```text
Unit tests: 25 passed
E2E tests: 44 passed
```

Both unit-test runs completed successfully with the same result.
