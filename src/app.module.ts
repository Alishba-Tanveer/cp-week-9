import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CommentsModule } from './comments/comments.module';
import { envValidationSchema } from './config/env.validation';
import { throttlerConfig } from './config/throttler.config';
import { ProjectMemberSubscriber } from './database/subscribers/project-member.subscriber';
import { Comment } from './entities/Comment';
import { Project } from './entities/Project';
import { ProjectMember } from './entities/ProjectMember';
import { RefreshToken } from './entities/RefreshToken';
import { Tag } from './entities/Tag';
import { Task } from './entities/Task';
import { User } from './entities/User';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    ThrottlerModule.forRoot(throttlerConfig),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          User,
          RefreshToken,
          Project,
          ProjectMember,
          Task,
          Tag,
          Comment,
        ],
        subscribers: [ProjectMemberSubscriber],
        synchronize: false,
      }),
    }),

    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
