import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Echo')
@Controller('echo')
export class EchoController {
  @Post()
  reflect(@Body() body: any) {
    return { received: body };
  }
}
