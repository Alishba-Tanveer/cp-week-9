# CMIT Internship — Week 9

## Authentication, Authorization & API Security

This repository contains my **Week 9 work** for the **CMIT Full-Stack Internship Program**, delivered by Coding Pixel.

Week 9 focuses on securing the NestJS REST API developed during the previous backend weeks. The week covers authentication, authorization, role-based access control, token security, refresh-token rotation, API hardening, validation, rate limiting, security headers, and automated security testing.

---

## Week 9 Objectives

The main objectives of Week 9 are:

* Secure user passwords using Argon2 hashing
* Implement user registration and login
* Implement short-lived JWT access tokens
* Implement long-lived refresh tokens
* Store refresh tokens securely as hashes
* Rotate refresh tokens after every successful refresh
* Revoke refresh tokens during logout
* Protect API write operations with authentication
* Implement project-based role-based access control
* Enforce `owner`, `admin`, `member`, and `viewer` permissions
* Prevent users from accessing resources belonging to other projects
* Add API rate limiting
* Add secure HTTP headers using Helmet
* Configure restrictive CORS
* Implement consistent global error responses
* Enforce strict request validation
* Validate route parameters
* Document security controls using an OWASP checklist
* Add unit and end-to-end security tests

---

## Tech Stack

* **NestJS**
* **TypeScript**
* **PostgreSQL**
* **TypeORM**
* **JWT**
* **Passport / Passport JWT**
* **Argon2**
* **Jest**
* **Helmet**
* **NestJS Throttler**
* **Git & GitHub**

---

# Week 9 Assignments

Week 9 is divided into three graded assignments.

| Assignment   | Focus                                      |
| ------------ | ------------------------------------------ |
| Assignment 1 | Authentication with Refresh Token Rotation |
| Assignment 2 | Role-Based Access Control and Guards       |
| Assignment 3 | Security Hardening and OWASP Checklist     |

Each assignment is developed and submitted through its own Git branch and pull request.

---

# Assignment 1 — Auth with Refresh Rotation

Assignment 1 introduces authentication to the existing Task Management API.

### Database Changes

A migration adds:

### `users.password_hash`

The existing `users` table receives a `password_hash` column.

Passwords are never stored as plaintext.

### `refresh_tokens`

A new table stores refresh-token information:

```text
refresh_tokens
├── id
├── user_id
├── token_hash
├── expires_at
├── revoked_at
└── created_at
```

Only the hash of the refresh token is stored in the database.

### Authentication Endpoints

The following endpoints are implemented:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Registration

Passwords are hashed with Argon2 before being stored.

The API response does not expose:

```text
password
password_hash
```

### Login

Successful authentication returns:

* Short-lived access JWT
* Refresh token

The JWT contains only the required identity information, such as:

```json
{
  "sub": 1,
  "email": "user@example.com"
}
```

JWT secrets and expiry values are provided through environment configuration.

### Refresh Token Rotation

Every successful refresh:

1. Validates the presented refresh token
2. Checks expiration
3. Checks revocation status
4. Revokes the existing refresh token
5. Creates a new refresh token
6. Creates a new access token
7. Returns the new token pair

A previously rotated refresh token cannot be reused.

### Logout

Logout revokes the refresh token presented by the caller instead of deleting its database record.

### Testing

Assignment 1 includes:

* Auth service unit tests
* Password verification tests
* Wrong-password tests
* Refresh-token rotation tests
* Login E2E tests
* Refresh E2E tests
* Reuse of revoked refresh token tests

---

# Assignment 2 — RBAC and Guards

Assignment 2 adds authorization to the authenticated API.

Authentication answers:

> **Who are you?**

Authorization answers:

> **Are you allowed to perform this action?**

The API distinguishes between:

```text
401 Unauthorized
403 Forbidden
```

---

## Authentication Guard

Protected write routes use a JWT authentication guard based on Passport JWT.

The guard reads:

```text
Authorization: Bearer <token>
```

and attaches the authenticated user to the request.

---

## Current User Decorator

A custom:

```text
@CurrentUser()
```

parameter decorator retrieves the authenticated user from the request.

The authenticated user's identity comes from the verified JWT rather than from a client-controlled `userId`.

---

## Project Roles

Authorization is based on the existing `project_members` table.

The supported roles are:

| Role     | Permissions                               |
| -------- | ----------------------------------------- |
| `owner`  | Full project access                       |
| `admin`  | Manage project content and delete project |
| `member` | Create and modify tasks/comments          |
| `viewer` | Read-only access                          |

Roles are **project-specific**.

For example:

```text
User → Owner → Project A
User → Viewer → Project B
```

Being an owner of Project A does not grant permissions on Project B.

---

## Roles Decorator and Guard

A custom:

```text
@Roles()
```

decorator is used with a `RolesGuard`.

The guard reads the user's membership from:

```text
project_members
```

and verifies the role for the specific project involved in the request.

---

## Destructive Operations

Deleting a project is restricted to:

```text
owner
admin
```

A:

```text
member
viewer
```

receives:

```text
403 Forbidden
```

---

## RBAC Testing

The authorization tests prove both:

* Allowed requests
* Denied requests

The E2E tests verify that users with different project roles receive the correct response.

---

# Assignment 3 — Security Hardening

Assignment 3 hardens the API against common security risks.

---

## Rate Limiting

Authentication endpoints are protected with NestJS Throttler.

The following endpoints receive rate limiting:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
```

Repeated requests beyond the configured limit return:

```text
429 Too Many Requests
```

---

## Helmet

Helmet is enabled to provide security-related HTTP headers.

---

## CORS

CORS is restricted to the configured frontend origin.

The development frontend origin is:

```text
http://localhost:3000
```

The allowed origin is read from environment configuration rather than being hardcoded into the application.

---

## Global Exception Filter

A global exception filter provides a consistent error response.

The standard response contains:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "path": "/tasks"
}
```

Unexpected internal errors do not expose:

* Stack traces
* Database details
* Internal implementation details
* Secrets

---

## Strict Validation

Global validation is configured to prevent unwanted fields from reaching the application.

Unexpected request properties such as:

```text
role
isAdmin
password_hash
```

cannot be used for mass assignment.

DTOs explicitly define the fields accepted from clients.

---

## Route Parameter Validation

Route IDs are validated before reaching the database.

For example:

```text
GET /tasks/abc
```

returns:

```text
400 Bad Request
```

instead of allowing an invalid ID to reach the database layer.

---

# OWASP Security Checklist

Assignment 3 also documents the application's security posture in:

```text
OWASP.md
```

The checklist maps OWASP Top 10 categories to concrete controls implemented in the project or explains why a category is not applicable.

Examples include:

* Broken Access Control → JWT guards and project-based `RolesGuard`
* Cryptographic Failures → Argon2 password hashing and hashed refresh tokens
* Injection → DTO validation and TypeORM
* Identification and Authentication Failures → JWT authentication and refresh-token rotation
* Security Misconfiguration → Helmet, restrictive CORS, environment configuration
* Vulnerable Components → dependency management and security review
* Logging and Monitoring → controlled error handling

---

# Security Principles Applied

The implementation follows several important security principles:

### Passwords are never stored directly

```text
Plain Password
      ↓
    Argon2
      ↓
Password Hash
      ↓
Database
```

### Refresh tokens are stored as hashes

```text
Raw Refresh Token
      ↓
      Hash
      ↓
Database
```

### Access tokens are short-lived

Access tokens are intended for frequent API requests and expire relatively quickly.

### Refresh tokens are rotated

Every successful refresh invalidates the previous refresh token.

### Authentication happens before authorization

The security flow is:

```text
Request
   ↓
JWT Authentication
   ↓
Authenticated User
   ↓
Project Role Lookup
   ↓
Authorization
   ↓
Controller
```

### Authorization is project-specific

A user's role on one project does not automatically grant access to another project.

---

# Testing

The project uses Jest for automated testing.

Testing covers:

* Authentication
* Password verification
* JWT authentication
* Refresh-token rotation
* Refresh-token revocation
* Logout
* Role-based authorization
* Forbidden access
* Cross-project access restrictions
* Rate limiting
* Error response format
* Validation

---

# Database

PostgreSQL is used as the primary database with TypeORM as the data-access layer.

Database schema changes are handled through migrations.

TypeORM schema synchronization remains disabled:

```text
synchronize: false
```

No production schema changes are made through automatic synchronization.

---

# Week 9 Learning Outcomes

By completing Week 9, the project demonstrates practical understanding of:

* Authentication vs authorization
* Password hashing
* JWT authentication
* Access and refresh tokens
* Refresh-token rotation
* Token revocation
* Session security
* Project-based RBAC
* NestJS guards
* Custom decorators
* API security
* Rate limiting
* CORS
* Security headers
* Exception handling
* Strict validation
* OWASP security principles
* Security-focused unit testing
* Security-focused E2E testing
