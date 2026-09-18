import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),

  ARGON2_MEMORY_COST: Joi.number().integer().min(8192).default(65536),
  ARGON2_TIME_COST: Joi.number().integer().min(1).default(3),
  ARGON2_PARALLELISM: Joi.number().integer().min(1).default(4),

  CORS_ORIGIN: Joi.string().uri().required(),
});
