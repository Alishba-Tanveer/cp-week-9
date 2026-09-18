import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  function createHost() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    const response = {
      status,
    };

    const request = {
      method: 'GET',
      url: '/test/error',
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    return {
      host,
      status,
      json,
    };
  }

  it('returns detailed unexpected errors in development', () => {
    const configService = {
      get: jest.fn().mockReturnValue('development'),
    } as unknown as ConfigService;

    const filter = new HttpExceptionFilter(configService);
    const { host, status, json } = createHost();

    filter.catch(
      new Error('development-only diagnostic'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'development-only diagnostic',
        error: 'Internal Server Error',
        path: '/test/error',
      }),
    );
  });

  it('returns generic unexpected errors in production', () => {
    const configService = {
      get: jest.fn().mockReturnValue('production'),
    } as unknown as ConfigService;

    const filter = new HttpExceptionFilter(configService);
    const { host, status, json } = createHost();

    filter.catch(
      new Error('database password should never be exposed'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
        path: '/test/error',
      }),
    );

    const body = json.mock.calls[0][0];

    expect(JSON.stringify(body)).not.toContain('database password');
  });

  it('preserves HttpException messages in production', () => {
    const configService = {
      get: jest.fn().mockReturnValue('production'),
    } as unknown as ConfigService;

    const filter = new HttpExceptionFilter(configService);
    const { host, status, json } = createHost();

    filter.catch(
      new HttpException(
        'Invalid request',
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Invalid request',
        error: 'Bad Request',
        path: '/test/error',
      }),
    );
  });
});
