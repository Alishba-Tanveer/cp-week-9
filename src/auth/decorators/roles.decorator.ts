import { SetMetadata } from '@nestjs/common';

import { ProjectMemberRole } from '../../entities/ProjectMember';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: ProjectMemberRole[]) =>
  SetMetadata(ROLES_KEY, roles);
