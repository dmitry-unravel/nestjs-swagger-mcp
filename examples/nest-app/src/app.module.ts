import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { EchoController } from './echo.controller.js';
import { McpAdapterModule } from '@reliqio/nestjs-swagger-mcp';

@Module({
  imports: [McpAdapterModule.forRoot()],
  controllers: [UsersController, EchoController],
})
export class AppModule {}
