import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60_000,
      limit: 100,
    },
  ],
};
