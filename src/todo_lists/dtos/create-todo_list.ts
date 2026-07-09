import { ApiProperty } from '@nestjs/swagger';

export class CreateTodoListDto {
  @ApiProperty({
    example: 'Groceries',
    description: 'Display name for the list',
  })
  name: string;
}
