# Week 9 — Assignment 3

## Security Hardening and OWASP Top 10 Checklist

This assignment focuses on hardening the NestJS REST API against common web security risks.

The implementation adds rate limiting, security headers, restricted CORS, strict request validation, route parameter validation, centralized exception handling, and an OWASP Top 10 security checklist.

---

## Project Overview

This project is a NestJS REST API backed by PostgreSQL and TypeORM.

The Week 9 work builds on the authentication and authorization implementation from the previous assignments and adds additional security controls at the application and API levels.

### Technology Stack

* **Backend:** NestJS
* **Language:** TypeScript
* **Database:** PostgreSQL
* **ORM:** TypeORM
* **Authentication:** JWT
* **Password Hashing:** Argon2
* **Validation:** `class-validator` / NestJS `ValidationPipe`
* **Rate Limiting:** `@nestjs/throttler`
* **Security Headers:** Helmet
* **Testing:** Jest + Supertest
* **Package Manager:** npm

---

# Assignment 3 Objectives

The main objectives of Assignment 3 are:

1. Add rate limiting to authentication routes.
2. Configure global throttling.
3. Add Helmet security headers.
4. Restrict CORS to the configured frontend origin.
5. Move security configuration into environment variables.
6. Implement a consistent global exception response.
7. Prevent internal server errors from leaking sensitive information.
8. Enable strict DTO validation.
9. Validate all route parameters as positive integers where IDs are expected.
10. Document the OWASP Top 10 security controls.
11. Add automated security-focused E2E tests.
12. Verify the application through linting, building, unit tests, and E2E tests.

---

# 1. Rate Limiting

## Global Throttling

The application uses `@nestjs/throttler` to provide global IP-based rate limiting.

The global configuration is:

```text
Limit: 100 requests
Time window: 60 seconds
Tracking: IP address
```

Configuration is located at:

```text
src/config/throttler.config.ts
```

### Global Configuration

```ts
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60_000,
      limit: 100,
    },
  ],
};
```

The throttler is registered globally in:

```text
src/app.module.ts
```

using:

```ts
ThrottlerModule.forRoot(throttlerConfig)
```

and:

```ts
{
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
}
```

---

## Authentication Route Throttling

Authentication endpoints use a stricter limit than the global API limit.

The following routes are limited to:

```text
20 requests per 60 seconds
```

### Protected Authentication Routes

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
```

The stricter limits are configured with the `@Throttle()` decorator in:

```text
src/auth/auth.controller.ts
```

### Example

```ts
@Throttle({
  default: {
    limit: 20,
    ttl: 60_000,
  },
})
```

### Why IP-Based Throttling?

IP-based throttling was selected because it is simple to apply consistently across authentication endpoints and does not require storing additional rate-limit state against user accounts.

A limitation is that users behind the same public IP address, such as employees in an office or users behind a shared NAT, can share the same rate-limit bucket.

---

# 2. Helmet Security Headers

Helmet is enabled to add common HTTP security headers to API responses.

Security configuration is centralized in:

```text
src/config/security.ts
```

Helmet is enabled with:

```ts
app.use(helmet());
```

The configuration is applied during application startup.

### Security Headers

The E2E security tests verify headers including:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security
```

Helmet provides additional security-related response headers according to its configuration.

---

# 3. CORS Configuration

Cross-Origin Resource Sharing is restricted to the configured frontend origin.

The origin is not hard-coded inside `main.ts`.

Instead, it is loaded from:

```text
CORS_ORIGIN
```

in the environment configuration.

### `.env`

```text
CORS_ORIGIN=http://localhost:3000
```

The application reads this value using NestJS `ConfigService`.

The security configuration contains:

```ts
app.enableCors({
  origin: configService.getOrThrow<string>('CORS_ORIGIN'),
  credentials: true,
});
```

### Allowed Origin

The configured development frontend:

```text
http://localhost:3000
```

is allowed.

### Disallowed Origins

An unconfigured origin such as:

```text
http://malicious.example
```

does not receive the configured CORS permission header.

CORS behavior is covered by the security E2E tests.

---

# 4. Environment Validation

Security-sensitive configuration is validated when the application starts.

The validation schema is located at:

```text
src/config/env.validation.ts
```

The following configuration values are validated:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME

JWT_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN

ARGON2_MEMORY_COST
ARGON2_TIME_COST
ARGON2_PARALLELISM

CORS_ORIGIN
```

The JWT secret is required to contain at least 32 characters.

The CORS origin must also be a valid URI.

This prevents the application from silently starting with invalid security configuration.

---

# 5. Strict Request Validation

The application uses a global NestJS `ValidationPipe`.

Configuration:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

### `whitelist`

Only properties defined by the DTO are accepted.

### `forbidNonWhitelisted`

Unexpected properties cause a `400 Bad Request` instead of being silently accepted.

For example, a registration request containing:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "StrongPassword123!",
  "role": "admin",
  "isAdmin": true
}
```

is rejected because `role` and `isAdmin` are not accepted registration DTO properties.

This prevents clients from attempting to control server-managed fields through unexpected request properties.

---

# 6. Positive Integer Route Parameter Validation

The API contains routes that receive database IDs through URL parameters.

A reusable custom pipe was added:

```text
src/common/pipes/positive-int.pipe.ts
```

The pipe validates that the parameter:

* contains only digits,
* represents a positive integer,
* is a safe JavaScript integer,
* is greater than zero.

### Valid Example

```text
GET /tasks/1
```

### Invalid Examples

```text
GET /tasks/abc
GET /tasks/0
GET /tasks/-1
```

Invalid values return:

```text
400 Bad Request
```

before the request reaches the database query.

The pipe is used for route parameters in:

```text
src/users/users.controller.ts
src/projects/projects.controller.ts
src/tasks/tasks.controller.ts
src/comments/comments.controller.ts
```

---

# 7. Global Exception Filter

A global exception filter was implemented at:

```text
src/common/filters/http-exception.filter.ts
```

It is registered globally through:

```ts
{
  provide: APP_FILTER,
  useClass: HttpExceptionFilter,
}
```

The filter provides a consistent error response.

Every HTTP error contains exactly these five fields:

```text
statusCode
message
error
timestamp
path
```

### Example 400 Response

```json
{
  "statusCode": 400,
  "message": "Validation failed (positive integer is expected)",
  "error": "Bad Request",
  "timestamp": "2026-09-18T00:00:00.000Z",
  "path": "/tasks/abc"
}
```

The exact timestamp varies for every request.

---

# 8. Unexpected 500 Error Handling

Unexpected application errors are handled differently from known HTTP exceptions.

For an unexpected server error, the client receives a generic response:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "timestamp": "2026-09-18T00:00:00.000Z",
  "path": "/test/security/unexpected-error"
}
```

Internal details such as:

* stack traces,
* database credentials,
* database error messages,
* sensitive implementation details

are not returned to the client.

Unexpected errors are logged server-side by the exception filter for debugging purposes.

---

# 9. OWASP Top 10

The file:

```text
OWASP.md
```

contains the security checklist for all ten OWASP Top 10 categories.

The documented controls include:

### A01 — Broken Access Control

Mitigations include:

* global JWT authentication,
* explicit public endpoints,
* role-based authorization,
* project membership checks,
* ownership and authorization checks.

Implemented through authentication and authorization guards, decorators, controllers, and services.

---

### A02 — Cryptographic Failures

Mitigations include:

* Argon2 password hashing,
* configurable Argon2 parameters,
* JWT-based authentication,
* hashed refresh tokens,
* refresh-token expiration,
* refresh-token revocation.

---

### A03 — Injection

Mitigations include:

* TypeORM database access,
* DTO validation,
* whitelist validation,
* rejection of unexpected request properties.

---

### A04 — Insecure Design

Mitigations include:

* separate authentication and authorization guards,
* access and refresh token separation,
* refresh token rotation,
* revoked refresh-token rejection,
* authentication rate limiting,
* environment-based security configuration.

---

### A05 — Security Misconfiguration

Mitigations include:

* Helmet,
* restricted CORS,
* validated environment variables,
* disabled TypeORM synchronization,
* strict request validation,
* global exception handling.

---

### A06 — Vulnerable and Outdated Components

Dependency security is checked using:

```bash
npm audit
```

The current audit reports dependency advisories that remain to be addressed.

At the time of Assignment 3 verification:

```text
5 vulnerabilities
2 high
1 moderate
2 low
```

The high-severity findings include transitive dependencies involving:

```text
tmp
undici
```

The available automatic fix requires:

```bash
npm audit fix --force
```

which would introduce a breaking dependency change.

Therefore, the breaking fix was not applied blindly. The remaining dependency exposure is documented and should be addressed through reviewed and tested dependency updates.

---

### A07 — Identification and Authentication Failures

Mitigations include:

* Argon2 password hashing,
* consistent unauthorized responses for failed login,
* JWT access tokens,
* refresh token rotation,
* refresh token revocation,
* authentication route throttling.

---

### A08 — Software and Data Integrity Failures

Mitigations include:

* database migrations,
* `synchronize: false`,
* persistent refresh-token state,
* automated authentication and security tests.

---

### A09 — Security Logging and Monitoring Failures

Mitigations include:

* server-side logging of unexpected exceptions,
* sanitized HTTP error responses,
* controlled authentication and authorization errors.

Remaining exposure includes the absence of a centralized security-event monitoring and structured audit logging system.

---

### A10 — Server-Side Request Forgery

The current API does not provide a user-controlled server-side URL fetching feature.

There is no endpoint that accepts an arbitrary URL and performs outbound server-side HTTP requests on behalf of a user.

Therefore, SSRF is currently not applicable to the implemented functionality.

---

# 10. Security Testing

Assignment 3 adds:

```text
test/security.e2e-spec.ts
```

The security E2E test suite verifies the following:

### Rate Limiting

Repeated rapid login attempts are tested.

Expected behavior:

```text
First 20 requests → 401
21st request → 429
```

This confirms that the authentication route has a stricter rate limit.

---

### Error Shape

The test verifies that invalid route parameters return exactly:

```text
statusCode
message
error
timestamp
path
```

---

### Strict Validation

Unexpected DTO fields such as:

```text
role
isAdmin
```

are rejected with:

```text
400 Bad Request
```

---

### Route Parameter Validation

Invalid route parameters such as:

```text
/tasks/abc
/tasks/0
```

are rejected before reaching the service/database layer.

---

### CORS

The tests verify:

```text
http://localhost:3000
```

is allowed.

They also verify that an unconfigured origin does not receive the allowed-origin response header.

---

### Helmet

The tests verify security headers including:

```text
X-Content-Type-Options
X-Frame-Options
Strict-Transport-Security
```

---

### 404 Error Handling

A request to a non-existent route is verified to return:

```text
404
```

with the standard five-field error structure.

---

### 500 Error Handling

A deliberate unexpected exception is generated to verify that:

* the response status is 500,
* the response uses the generic error message,
* stack traces are not returned,
* database/password-related internal details are not returned.

---

# 11. Test Results

All final verification checks passed.

## Lint

```bash
npm run lint
```

Result:

```text
Found 0 warnings and 0 errors.
```

---

## Build

```bash
npm run build
```

Result:

```text
Build passed successfully.
```

---

## Unit Tests — First Run

```bash
npm test -- --runInBand
```

Result:

```text
Test Suites: 4 passed, 4 total
Tests:       21 passed, 21 total
```

---

## Unit Tests — Second Run

```bash
npm test -- --runInBand
```

Result:

```text
Test Suites: 4 passed, 4 total
Tests:       21 passed, 21 total
```

The second run produced the same result, confirming consistent test execution.

---

## E2E Tests

```bash
npm run test:e2e
```

Result:

```text
Test Suites: 2 passed, 2 total
Tests:       43 passed, 43 total
```