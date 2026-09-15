# Week 9 — Assignment 1: Auth with Refresh Rotation

## Overview

This assignment implements a real authentication flow using NestJS, PostgreSQL, TypeORM, Argon2, JWT access tokens, and database-backed refresh tokens.

The implementation focuses on secure password storage, short-lived access tokens, refresh-token rotation, token revocation, refresh-token reuse detection, and configurable password-hashing costs.

## Tech Stack

* NestJS
* TypeScript
* PostgreSQL
* TypeORM
* JWT
* Argon2id
* Jest
* Supertest
* Joi
* Node.js

---

## Assignment Requirements

### Warm-up

* Add `password_hash` to the `users` table.
* Add a `refresh_tokens` table.
* Keep TypeORM `synchronize` disabled.
* Store only refresh-token hashes in the database.
* Hash user passwords with Argon2id.
* Never return passwords or password hashes in API responses.

### Core

* `POST /auth/register`
* `POST /auth/login`
* `POST /auth/refresh`
* `POST /auth/logout`
* Password verification with consistent `401` responses.
* Short-lived JWT access tokens.
* Long-lived refresh tokens.
* Refresh-token rotation.
* Refresh-token revocation.
* Transactional refresh rotation.
* Unit and end-to-end tests.

### Optional Challenges

* **X1:** Refresh-token family reuse detection.
* **X2:** Expired refresh-token rejection.
* **X3:** Configurable Argon2 cost parameters.

---

## Authentication Flow

### 1. Registration

The client sends:

```http
POST /auth/register
```

with a name, email, and password.

The password is hashed using Argon2id before being stored.

The API response contains only safe user fields:

```json
{
  "id": 1,
  "name": "Example User",
  "email": "example@example.com"
}
```

The password and password hash are never returned.

---

### 2. Login

The client sends:

```http
POST /auth/login
```

with valid credentials.

On success, the server returns:

* a short-lived access JWT
* a long-lived refresh token

The access JWT contains only:

```json
{
  "sub": 1,
  "email": "example@example.com"
}
```

The refresh token itself is never stored in the database.

Instead, a SHA-256 hash of the refresh token is stored in `refresh_tokens`.

Invalid credentials return:

```http
401 Unauthorized
```

with the same authentication message for both an unknown email and an incorrect password.

---

## Refresh Token Rotation

The client sends:

```http
POST /auth/refresh
```

with the current refresh token.

The server:

1. Hashes the presented token.
2. Finds the matching database row.
3. Checks that the token has not been revoked.
4. Checks that the token has not expired.
5. Revokes the existing refresh-token row.
6. Creates a new refresh token.
7. Stores the new token hash.
8. Returns a new access/refresh token pair.

The rotation happens inside a database transaction.

The old refresh token cannot be used again.

---

## Refresh Token Reuse Detection — X1

Each refresh-token session has a `family_id`.

The same family ID is carried through every rotation.

If an already-revoked refresh token is presented again, the entire token family is revoked.

This prevents a previously stolen refresh token from continuing to be used after reuse is detected.

Example:

```text
Login
  ↓
Refresh Token A
  ↓
Refresh
  ↓
Token A = revoked
Token B = active
  ↓
Token A reused
  ↓
401 Unauthorized
  ↓
Entire family revoked
```

---

## Expired Refresh Tokens — X2

Refresh tokens are checked against their database `expires_at` value.

An expired refresh token is rejected with:

```http
401 Unauthorized
```

No new token pair is issued and the expired token is not rotated.

---

## Configurable Argon2 Cost — X3

Argon2id cost parameters are loaded from configuration rather than being hardcoded.

Production/default configuration:

```env
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4
```

The test environment uses lower values so the test suite remains fast while the production configuration remains stronger.

Test configuration:

```text
memoryCost: 16384
timeCost: 1
parallelism: 1
```

The generated password hash is tested to ensure the configured parameters are actually being used.

---

## Database Design

### `users`

The authentication migration adds:

```text
password_hash
```

The existing users table is preserved for compatibility with the previous project phases.

### `refresh_tokens`

The table contains:

| Column       | Purpose                       |
| ------------ | ----------------------------- |
| `id`         | Primary key                   |
| `user_id`    | Related user                  |
| `family_id`  | Refresh-token family          |
| `token_hash` | SHA-256 hash of refresh token |
| `expires_at` | Refresh-token expiry          |
| `revoked_at` | Revocation timestamp          |
| `created_at` | Creation timestamp            |

A foreign key connects:

```text
refresh_tokens.user_id
        ↓
users.id
```

Refresh-token rows are revoked instead of deleted so the security history remains available.

---

## Security Configuration

Authentication configuration is loaded from environment variables.

Example:

```env
JWT_SECRET=replace_with_a_random_secret_at_least_32_characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4
```

Secrets are kept in `.env` and excluded from Git.

`.env.example` contains placeholder values only.

TypeORM synchronization remains disabled:

```ts
synchronize: false
```

Database changes are managed through migrations.

---

## Testing

### Unit Tests

The authentication service tests cover:

* Configured Argon2 password hashing
* Correct password verification
* Incorrect password rejection
* Refresh-token rotation
* Expired refresh-token rejection

Current result:

```text
Test Suites: 1 passed
Tests: 5 passed
```

### End-to-End Tests

The E2E suite covers:

* Successful login
* Incorrect password rejection
* Refresh-token rotation
* Refresh-token family reuse detection

Current result:

```text
Test Suites: 1 passed
Tests: 4 passed
```