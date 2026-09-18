import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;
}
