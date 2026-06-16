import { Controller, Get, Param } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly users = [
    { id: '1', name: 'Ada Lovelace' },
    { id: '2', name: 'Grace Hopper' },
  ];

  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  getUser(@Param('id') id: string) {
    return this.users.find(u => u.id === id) ?? null;
  }
}
