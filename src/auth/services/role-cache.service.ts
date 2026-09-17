import { ProjectMemberRole } from '../../entities/ProjectMember';

interface RoleCacheEntry {
  role: ProjectMemberRole | null;
  expiresAt: number;
}

export class RoleCacheService {
  private static readonly ttlMs = 30_000;

  private static readonly cache = new Map<
    string,
    RoleCacheEntry
  >();

  static get(
    userId: number,
    projectId: number,
  ): ProjectMemberRole | null | undefined {
    const key = this.getKey(userId, projectId);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.role;
  }

  static set(
    userId: number,
    projectId: number,
    role: ProjectMemberRole | null,
  ): void {
    const key = this.getKey(userId, projectId);

    this.cache.set(key, {
      role,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  static clear(): void {
    this.cache.clear();
  }

  static getTtlMs(): number {
    return this.ttlMs;
  }

  private static getKey(
    userId: number,
    projectId: number,
  ): string {
    return `${userId}:${projectId}`;
  }
}
