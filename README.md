# Week 9 — Assignment 2: RBAC & Authorization

## Overview

Assignment 2 extends the Week 9 authentication system with role-based access control, authorization guards, authenticated-user handling, resource ownership checks, cross-project isolation, and role caching.

The implementation uses the existing `project_members` table to determine a user's role within each project.

### Supported Roles

* `owner`
* `admin`
* `member`
* `viewer`

---

## Features Implemented

### 1. JWT Authentication Guard

All protected routes require a valid JWT access token using:

```http
Authorization: Bearer <access_token>
```

The application uses `JwtAuthGuard` with Passport JWT.

Unauthenticated requests to protected routes return:

```http
401 Unauthorized
```

The JWT guard runs before role authorization so unauthenticated requests are rejected before `RolesGuard`.

---

### 2. Current User Decorator

Added:

```ts
@CurrentUser()
```

The decorator retrieves the authenticated user from the validated JWT payload.

Authenticated identity is trusted over user-controlled request body fields.

For example, when creating a project:

```json
{
  "name": "Example Project",
  "ownerId": 999
}
```

the application uses the `sub` value from the access token as the actual owner.

The same approach is used for comment authorship and task creation.

---

### 3. Role-Based Access Control

Added:

```ts
@Roles(...)
```

and:

```ts
RolesGuard
```

The guard looks up the authenticated user's membership in `project_members` and checks the user's role against the roles required by the route.

Example:

```ts
@Roles(
  ProjectMemberRole.OWNER,
  ProjectMemberRole.ADMIN,
)
```

Authorization is evaluated using the project associated with the request.

---

## Authorization Rules

### Projects

| Operation           | Owner   | Admin   | Member  | Viewer  |
| ------------------- | ------- | ------- | ------- | ------- |
| View public project | Allowed | Allowed | Allowed | Allowed |
| Update project      | Allowed | Allowed | Denied  | Denied  |
| Delete project      | Allowed | Allowed | Denied  | Denied  |

Only project owners and admins can update or delete a project.

---

### Tasks

Task creation is allowed for:

* Owner
* Admin
* Member

Viewers receive:

```http
403 Forbidden
```

for task creation.

For task updates/deletes, the optional resource ownership rule is also implemented:

* Owner → allowed
* Admin → allowed
* Task creator → allowed
* Task assignee → allowed
* Unrelated member → denied
* Viewer → denied

---

### Comments

Authenticated project members with the required role can create comments.

Comment authorship is taken from the authenticated JWT user rather than a user-supplied `authorId`.

---

## Cross-Project Isolation

Project membership is evaluated per project.

Having a role in Project A does not grant access to Project B.

For example:

```text
User → Member of Project A
```

does not automatically provide permission to modify:

```text
Project B
```

Cross-project task and comment access is rejected with:

```http
403 Forbidden
```

This prevents users from using permissions from one project to access resources belonging to another project.

---

## Public Routes

JWT authentication is applied globally through `JwtAuthGuard`.

Routes that should remain public are explicitly marked with:

```ts
@Public()
```

### Authentication routes

The following routes are public:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
```

Logout remains protected because it operates on an authenticated user's refresh token.

### Documented public GET routes

The read-only GET routes for projects, tasks, and comments are explicitly marked public.

Write operations remain protected.

---

## Role Cache

Assignment 2 also includes role lookup caching.

`RoleCacheService` stores project membership roles temporarily to avoid querying `project_members` on every authorization check.

### Cache configuration

```text
TTL: 30 seconds
```

The cache key is based on:

```text
userId:projectId
```

Repeated authorization requests for the same user/project can therefore reuse the cached role.

### Cache Invalidation

The cache is cleared when a `ProjectMember` is:

* Inserted
* Updated
* Removed

This allows membership role changes to take effect without restarting the application.

The cache is process-local. In a multi-instance deployment, an instance that does not receive the invalidation event can have a worst-case stale-role window of up to 30 seconds.

---

## Task Creator Tracking

A `creator_id` column was added to the `tasks` table to support resource ownership checks.

Migration:

```text
1789481000000-AddTaskCreator
```

The column references:

```text
users.id
```

with:

```text
ON DELETE SET NULL
```

An index was also added for efficient creator lookups.

---

## Database Configuration

TypeORM continues to use:

```ts
synchronize: false
```

Database schema changes are handled through migrations.

The standalone TypeORM data source includes all domain entities required for migration execution:

```text
User
RefreshToken
Project
ProjectMember
Task
Tag
Comment
```

---

## Testing

### Unit Tests

```text
4 test suites
21 tests passed
```

### E2E Tests

```text
1 test suite
34 tests passed
```

The E2E suite covers:

* JWT authentication
* Public routes
* Protected write routes
* `@CurrentUser()`
* Spoofed `ownerId` protection
* Spoofed `authorId` protection
* Viewer restrictions
* Owner permissions
* Admin permissions
* Project deletion authorization
* Task ownership
* Task assignee permissions
* Cross-project isolation
* Guard ordering
* Runtime membership changes
* Role caching
* Cache invalidation