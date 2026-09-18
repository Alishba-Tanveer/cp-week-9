import { Logger } from '@nestjs/common';

import { RedactingLogger } from './redacting-logger';

describe('RedactingLogger', () => {
  it('redacts sensitive values including nested values', () => {
    const logger = new RedactingLogger('SecurityTest');

    const debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation();

    logger.debug({
      email: 'user@example.com',
      password: 'Secret123!',
      token: 'access-token-value',
      refreshToken: 'refresh-token-value',
      authorization: 'Bearer secret-token',
      nested: {
        password: 'NestedSecret123!',
      },
    });

    expect(debugSpy).toHaveBeenCalledTimes(1);

    const loggedValue = debugSpy.mock.calls[0][0] as Record<
      string,
      unknown
    >;

    expect(loggedValue).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      token: '[REDACTED]',
      refreshToken: '[REDACTED]',
      authorization: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
      },
    });

    debugSpy.mockRestore();
  });
});
