import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';

import { ProjectMember } from '../../entities/ProjectMember';
import { RoleCacheService } from '../../auth/services/role-cache.service';

@EventSubscriber()
export class ProjectMemberSubscriber
  implements EntitySubscriberInterface<ProjectMember>
{
  listenTo() {
    return ProjectMember;
  }

  afterInsert(_event: InsertEvent<ProjectMember>): void {
    RoleCacheService.clear();
  }

  afterUpdate(_event: UpdateEvent<ProjectMember>): void {
    RoleCacheService.clear();
  }

  afterRemove(_event: RemoveEvent<ProjectMember>): void {
    RoleCacheService.clear();
  }
}
