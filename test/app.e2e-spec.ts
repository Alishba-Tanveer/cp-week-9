import { createHash } from 'crypto';
import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { Public } from '../src/auth/decorators/public.decorator';
import { RoleCacheService } from '../src/auth/services/role-cache.service';
import { Comment } from '../src/entities/Comment';
import {
  ProjectMember,
  ProjectMemberRole,
} from '../src/entities/ProjectMember';
import { Project } from '../src/entities/Project';
import { RefreshToken } from '../src/entities/RefreshToken';
import { Task } from '../src/entities/Task';
import { User } from '../src/entities/User';

@Controller('x2-test')
class X2TestController {
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }

  @Get('public')
  @Public()
  publicRoute() {
    return { ok: true };
  }
}

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;

  const email = `c5-${Date.now()}@example.com`;
  const password = 'C5TestPassword123!';
  const name = 'C5 E2E User';

  let firstRefreshToken: string;
  let rotatedRefreshToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [X2TestController],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    userRepository = app.get<Repository<User>>(
      getRepositoryToken(User),
    );

    refreshTokenRepository = app.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name,
        email,
        password,
      })
      .expect(201);
  });

  afterAll(async () => {
    const user = await userRepository.findOne({
      where: { email },
    });

    if (user) {
      await refreshTokenRepository.delete({
        userId: user.id,
      });

      await userRepository.delete(user.id);
    }

    await app.close();
  });

  it('requires authentication for an undecorated route', async () => {
    await request(app.getHttpServer())
      .get('/x2-test/protected')
      .expect(401);
  });

  it('allows an explicitly public route without authentication', async () => {
    await request(app.getHttpServer())
      .get('/x2-test/public')
      .expect(200)
      .expect({ ok: true });
  });

  it('logs in successfully with valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    firstRefreshToken = response.body.refreshToken;
  });

  it('rejects an incorrect password with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rotates the refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    rotatedRefreshToken = response.body.refreshToken;

    expect(rotatedRefreshToken).not.toBe(firstRefreshToken);
  });

  it('revokes the entire refresh-token family when a revoked token is reused', async () => {
    const firstRefreshTokenHash = createHash('sha256')
      .update(firstRefreshToken)
      .digest('hex');

    const rotatedRefreshTokenHash = createHash('sha256')
      .update(rotatedRefreshToken)
      .digest('hex');

    const firstTokenRow = await refreshTokenRepository.findOne({
      where: {
        tokenHash: firstRefreshTokenHash,
      },
    });

    const rotatedTokenRow = await refreshTokenRepository.findOne({
      where: {
        tokenHash: rotatedRefreshTokenHash,
      },
    });

    expect(firstTokenRow).not.toBeNull();
    expect(rotatedTokenRow).not.toBeNull();

    if (!firstTokenRow || !rotatedTokenRow) {
      throw new Error('Expected refresh-token rows were not found');
    }

    expect(firstTokenRow.familyId).toBe(rotatedTokenRow.familyId);

    expect(firstTokenRow.revokedAt).not.toBeNull();
    expect(rotatedTokenRow.revokedAt).toBeNull();

    const familyId = firstTokenRow.familyId;

    const familyBeforeReuse = await refreshTokenRepository.find({
      where: {
        familyId,
      },
    });

    expect(familyBeforeReuse.length).toBeGreaterThanOrEqual(2);

    const activeTokensBeforeReuse = familyBeforeReuse.filter(
      (token) => token.revokedAt === null,
    );

    expect(activeTokensBeforeReuse.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
      })
      .expect(401);

    const familyAfterReuse = await refreshTokenRepository.find({
      where: {
        familyId,
      },
    });

    expect(familyAfterReuse.length).toBeGreaterThanOrEqual(2);

    const revokedTokensAfterReuse = familyAfterReuse.filter(
      (token) => token.revokedAt !== null,
    );

    expect(revokedTokensAfterReuse.length).toBe(
      familyAfterReuse.length,
    );

    expect(
      familyAfterReuse.every(
        (token) => token.revokedAt !== null,
      ),
    ).toBe(true);
  });

  it('rejects an unknown email with the same 401 response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `unknown-${Date.now()}@example.com`,
        password,
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('logs out by revoking the presented refresh token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const logoutRefreshToken = loginResponse.body.refreshToken;

    const refreshTokenHash = createHash('sha256')
      .update(logoutRefreshToken)
      .digest('hex');

    const beforeLogout = await refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    expect(beforeLogout).not.toBeNull();

    if (!beforeLogout) {
      throw new Error('Expected refresh-token row was not found');
    }

    expect(beforeLogout.revokedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({
        refreshToken: logoutRefreshToken,
      })
      .expect(200);

    const afterLogout = await refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    expect(afterLogout).not.toBeNull();

    if (!afterLogout) {
      throw new Error('Expected refresh-token row to remain after logout');
    }

    expect(afterLogout.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: logoutRefreshToken,
      })
      .expect(401);
  });

  it('rejects an expired refresh token with 401', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const expiredRefreshToken = loginResponse.body.refreshToken;

    const refreshTokenHash = createHash('sha256')
      .update(expiredRefreshToken)
      .digest('hex');

    const tokenRow = await refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    expect(tokenRow).not.toBeNull();

    if (!tokenRow) {
      throw new Error('Expected refresh-token row was not found');
    }

    await refreshTokenRepository.update(
      { id: tokenRow.id },
      {
        expiresAt: new Date(Date.now() - 60_000),
      },
    );

    const expiredRow = await refreshTokenRepository.findOne({
      where: {
        id: tokenRow.id,
      },
    });

    expect(expiredRow).not.toBeNull();

    if (!expiredRow) {
      throw new Error('Expected expired refresh-token row was not found');
    }

    expect(expiredRow.expiresAt.getTime()).toBeLessThan(Date.now());
    expect(expiredRow.revokedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: expiredRefreshToken,
      })
      .expect(401);

    const afterAttempt = await refreshTokenRepository.findOne({
      where: {
        id: tokenRow.id,
      },
    });

    expect(afterAttempt).not.toBeNull();

    if (!afterAttempt) {
      throw new Error('Expected refresh-token row after rejection');
    }

    expect(afterAttempt.revokedAt).toBeNull();
  });
});

describe('RBAC API (e2e)', () => {
  let app: INestApplication;

  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let projectRepository: Repository<Project>;
  let projectMemberRepository: Repository<ProjectMember>;
  let taskRepository: Repository<Task>;
  let commentRepository: Repository<Comment>;

  const password = 'RbacTestPassword123!';

  const users = {
    owner: {
      name: 'RBAC Owner',
      email: `rbac-owner-${Date.now()}@example.com`,
    },
    admin: {
      name: 'RBAC Admin',
      email: `rbac-admin-${Date.now()}@example.com`,
    },
    member: {
      name: 'RBAC Member',
      email: `rbac-member-${Date.now()}@example.com`,
    },
    otherMember: {
      name: 'RBAC Other Member',
      email: `rbac-other-member-${Date.now()}@example.com`,
    },
    viewer: {
      name: 'RBAC Viewer',
      email: `rbac-viewer-${Date.now()}@example.com`,
    },
    outsider: {
      name: 'RBAC Outsider',
      email: `rbac-outsider-${Date.now()}@example.com`,
    },
  };

  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let otherMemberToken: string;
  let viewerToken: string;
  let outsiderToken: string;

  let owner: User;
  let admin: User;
  let member: User;
  let otherMember: User;
  let viewer: User;
  let outsider: User;

  let projectA: Project;
  let projectB: Project;
  let taskA: Task;
  let taskB: Task;

  async function registerAndLogin(user: {
    name: string;
    email: string;
  }): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: user.name,
        email: user.email,
        password,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password,
      })
      .expect(200);

    return response.body.accessToken;
  }

  async function setRole(
    userId: number,
    projectId: number,
    role: ProjectMemberRole,
  ) {
    await projectMemberRepository.save(
      projectMemberRepository.create({
        userId,
        projectId,
        role,
      }),
    );
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    userRepository = app.get<Repository<User>>(
      getRepositoryToken(User),
    );

    refreshTokenRepository = app.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );

    projectRepository = app.get<Repository<Project>>(
      getRepositoryToken(Project),
    );

    projectMemberRepository = app.get<Repository<ProjectMember>>(
      getRepositoryToken(ProjectMember),
    );

    taskRepository = app.get<Repository<Task>>(
      getRepositoryToken(Task),
    );

    commentRepository = app.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );

    ownerToken = await registerAndLogin(users.owner);
    adminToken = await registerAndLogin(users.admin);
    memberToken = await registerAndLogin(users.member);
    otherMemberToken = await registerAndLogin(users.otherMember);
    viewerToken = await registerAndLogin(users.viewer);
    outsiderToken = await registerAndLogin(users.outsider);

    owner = (await userRepository.findOneOrFail({
      where: { email: users.owner.email },
    }));

    admin = (await userRepository.findOneOrFail({
      where: { email: users.admin.email },
    }));

    member = (await userRepository.findOneOrFail({
      where: { email: users.member.email },
    }));

    otherMember = (await userRepository.findOneOrFail({
      where: { email: users.otherMember.email },
    }));

    viewer = (await userRepository.findOneOrFail({
      where: { email: users.viewer.email },
    }));

    outsider = (await userRepository.findOneOrFail({
      where: { email: users.outsider.email },
    }));

    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `RBAC Project A ${Date.now()}`,
        ownerId: outsider.id,
      })
      .expect(201);

    projectA = projectResponse.body;

    const projectBResponse = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        name: `RBAC Project B ${Date.now()}`,
      })
      .expect(201);

    projectB = projectBResponse.body;

    await setRole(admin.id, projectA.id, ProjectMemberRole.ADMIN);
    await setRole(member.id, projectA.id, ProjectMemberRole.MEMBER);
    await setRole(
      otherMember.id,
      projectA.id,
      ProjectMemberRole.MEMBER,
    );
    await setRole(viewer.id, projectA.id, ProjectMemberRole.VIEWER);


    const taskAResponse = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: `RBAC Task A ${Date.now()}`,
        description: 'Project A task',
        projectId: projectA.id,
        priority: 3,
        assigneeId: member.id,
      })
      .expect(201);

    taskA = taskAResponse.body;

    const taskBResponse = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        title: `RBAC Task B ${Date.now()}`,
        description: 'Project B task',
        projectId: projectB.id,
        priority: 3,
      })
      .expect(201);

    taskB = taskBResponse.body;
  });

  afterAll(async () => {
    const createdUserIds = [
      owner?.id,
      admin?.id,
      member?.id,
      otherMember?.id,
      viewer?.id,
      outsider?.id,
    ].filter((id): id is number => id !== undefined);

    if (createdUserIds.length > 0) {
      await refreshTokenRepository.delete(createdUserIds.map((userId) => ({
        userId,
      })));
    }

    if (taskA?.id) {
      await commentRepository.delete({ taskId: taskA.id });
    }

    if (taskB?.id) {
      await commentRepository.delete({ taskId: taskB.id });
    }

    if (taskA?.id) {
      await taskRepository.delete(taskA.id);
    }

    if (taskB?.id) {
      await taskRepository.delete(taskB.id);
    }

    if (projectA?.id) {
      await projectMemberRepository.delete({
        projectId: projectA.id,
      });
    }

    if (projectB?.id) {
      await projectMemberRepository.delete({
        projectId: projectB.id,
      });
    }

    if (projectA?.id) {
      await projectRepository.delete(projectA.id);
    }

    if (projectB?.id) {
      await projectRepository.delete(projectB.id);
    }

    for (const userId of createdUserIds) {
      await userRepository.delete(userId);
    }

    await app.close();
  });

  it('rejects write routes without an access token', async () => {
    await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: 'Unauthenticated Project',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Unauthenticated Task',
        projectId: projectA.id,
        priority: 3,
      })
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .send({
        title: 'Unauthenticated Update',
      })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/tasks/${taskA.id}`)
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .send({
        name: 'Unauthenticated Update',
      })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/projects/${projectA.id}`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/tasks/${taskA.id}/comments`)
      .send({
        body: 'Unauthenticated comment',
      })
      .expect(401);
  });

  it('keeps documented GET routes public', async () => {
    await request(app.getHttpServer())
      .get('/projects')
      .expect(200);

    await request(app.getHttpServer())
      .get(`/projects/${projectA.id}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/tasks')
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tasks/${taskA.id}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tasks/${taskA.id}/comments`)
      .expect(200);
  });

  it('uses the JWT user for project ownership instead of a spoofed ownerId', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `CurrentUser Project ${Date.now()}`,
        ownerId: outsider.id,
      })
      .expect(201);

    expect(response.body.ownerId).toBe(owner.id);

    await projectMemberRepository.delete({
      projectId: response.body.id,
    });

    await projectRepository.delete(response.body.id);
  });

  it('denies a viewer from creating a task', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Viewer Task',
        projectId: projectA.id,
        priority: 3,
      })
      .expect(403);
  });

  it('allows an owner to create a task', async () => {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: `Owner Task ${Date.now()}`,
        projectId: projectA.id,
        priority: 3,
      })
      .expect(201);

    expect(response.body.projectId).toBe(projectA.id);

    await taskRepository.delete(response.body.id);
  });

  it('allows an admin to create a task', async () => {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Admin Task ${Date.now()}`,
        projectId: projectA.id,
        priority: 3,
      })
      .expect(201);

    expect(response.body.projectId).toBe(projectA.id);

    await taskRepository.delete(response.body.id);
  });

  it('uses the JWT user for comment authorship instead of a spoofed authorId', async () => {
    const response = await request(app.getHttpServer())
      .post(`/tasks/${taskA.id}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        body: 'Current user comment',
        authorId: outsider.id,
      })
      .expect(201);

    expect(response.body.authorId).toBe(member.id);

    await commentRepository.delete(response.body.id);
  });

  it('denies member and viewer from deleting a project', async () => {
    await request(app.getHttpServer())
      .delete(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('allows an admin to update a project', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Admin Updated Project ${Date.now()}`,
      })
      .expect(200);
  });

  it('allows an owner to update a project', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Owner Updated Project ${Date.now()}`,
      })
      .expect(200);
  });

  it('allows an owner to delete a project', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Delete Project ${Date.now()}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/projects/${response.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
  });

  it('denies a viewer from updating or deleting a task', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Viewer cannot update',
      })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('allows an owner and member to update a task', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: `Member Updated Task ${Date.now()}`,
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: `Owner Updated Task ${Date.now()}`,
      })
      .expect(200);
  });

  it('denies an unrelated member from updating or deleting a task', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${otherMemberToken}`)
      .send({
        title: 'Unrelated member cannot update',
      })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${otherMemberToken}`)
      .expect(403);
  });

  it('allows the owner to override task ownership restrictions', async () => {
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: `Owner Override Task ${Date.now()}`,
        description: 'Owner override test',
        projectId: projectA.id,
        priority: 3,
        assigneeId: member.id,
      })
      .expect(201);

    const taskId = response.body.id;

    await request(app.getHttpServer())
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
  });

  it('allows an assignee to update a task', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: `Assignee Updated Task ${Date.now()}`,
      })
      .expect(200);
  });

  it('prevents a project A member from changing a task into project B', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/tasks/${taskA.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        projectId: projectB.id,
      })
      .expect(400);

    expect(response.body.message).toContain(
      'property projectId should not exist',
    );
  });

  it('blocks cross-project task access', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskB.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Owner of A cannot update B',
      })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tasks/${taskB.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/tasks/${taskB.id}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        body: 'Owner of A cannot comment on B',
      })
      .expect(403);
  });

  it('blocks cross-project comment access for a project A member', async () => {
    await request(app.getHttpServer())
      .post(`/tasks/${taskB.id}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        body: 'Member of A cannot comment on B',
      })
      .expect(403);
  });

  it('returns 401 before RolesGuard authorization when no token is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .send({
        name: 'Unauthenticated role check',
      })
      .expect(401);
  });

  it('applies membership role changes without restarting the app', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Viewer should initially be denied',
        projectId: projectA.id,
        priority: 3,
      })
      .expect(403);

    await projectMemberRepository.update(
      {
        userId: viewer.id,
        projectId: projectA.id,
      },
      {
        role: ProjectMemberRole.MEMBER,
      },
    );

    const response = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: `Viewer Promoted Task ${Date.now()}`,
        projectId: projectA.id,
        priority: 3,
      })
      .expect(201);

    expect(response.body.projectId).toBe(projectA.id);

    await taskRepository.delete(response.body.id);

    await projectMemberRepository.update(
      {
        userId: viewer.id,
        projectId: projectA.id,
      },
      {
        role: ProjectMemberRole.VIEWER,
      },
    );
  });

  it('uses the role cache for repeated authorization checks', async () => {
    RoleCacheService.clear();

    const findOneSpy = jest.spyOn(
      projectMemberRepository,
      'findOne',
    );

    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Cache Prime ${Date.now()}`,
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Cache Hit ${Date.now()}`,
      })
      .expect(200);

    expect(findOneSpy).toHaveBeenCalledTimes(1);

    findOneSpy.mockRestore();
    RoleCacheService.clear();
  });

  it('invalidates the role cache immediately after membership changes', async () => {
    RoleCacheService.clear();

    const findOneSpy = jest.spyOn(
      projectMemberRepository,
      'findOne',
    );

    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Before Invalidation ${Date.now()}`,
      })
      .expect(200);

    expect(findOneSpy).toHaveBeenCalledTimes(1);

    await projectMemberRepository.update(
      {
        userId: owner.id,
        projectId: projectA.id,
      },
      {
        role: ProjectMemberRole.VIEWER,
      },
    );

    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Should Be Rejected After Invalidation',
      })
      .expect(403);

    expect(findOneSpy).toHaveBeenCalledTimes(2);

    await projectMemberRepository.update(
      {
        userId: owner.id,
        projectId: projectA.id,
      },
      {
        role: ProjectMemberRole.OWNER,
      },
    );

    findOneSpy.mockRestore();
    RoleCacheService.clear();
  });

  it('allows an admin to delete a project', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Admin Delete Project ${Date.now()}`,
      })
      .expect(201);

    const projectId = response.body.id;

    await projectMemberRepository.save(
      projectMemberRepository.create({
        userId: admin.id,
        projectId,
        role: ProjectMemberRole.ADMIN,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('uses the same protected route to deny viewer and allow owner', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'Viewer denied',
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/projects/${projectA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Owner allowed ${Date.now()}`,
      })
      .expect(200);
  });
});
