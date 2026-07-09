import { ApiProperty } from '@nestjs/swagger';

export class UpdateTodoListDto {
  @ApiProperty({
    example: 'Weekend groceries',
    description: 'New name for the list',
  })
  name: string;
}
