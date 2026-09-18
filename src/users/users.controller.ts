import { Controller, Get, Param } from '@nestjs/common';

import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findById(@Param('id', PositiveIntPipe) id: number) {
    return this.usersService.findById(id);
  }
}
