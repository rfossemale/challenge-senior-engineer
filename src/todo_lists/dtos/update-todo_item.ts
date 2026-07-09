import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTodoItemDto {
  @ApiPropertyOptional({
    example: 'Buy oat milk instead',
    description: 'Replace the item text',
  })
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Mark the item completed / uncompleted',
  })
  completed?: boolean;
}
