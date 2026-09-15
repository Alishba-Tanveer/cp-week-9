# CMIT Internship — Week 9

## Authentication & Security

This repository contains my Week 9 work for the **CMIT Full-Stack Internship Program**, delivered by Coding Pixel.

Week 9 focuses on securing the NestJS REST API by implementing authentication with password hashing, JWT access tokens, refresh tokens with rotation and revocation, and automated tests.

### Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT
- Argon2
- Jest
- Git & GitHub

### Assignment 1

**Auth with Refresh Token Rotation**

The assignment covers:

- Password hashing with Argon2
- User registration
- Login authentication
- Short-lived access JWTs
- Hashed refresh tokens
- Refresh token rotation
- Refresh token revocation
- Logout
- Unit tests
- E2E authentication tests

The project uses database migrations for schema changes and keeps TypeORM `synchronize` disabled.