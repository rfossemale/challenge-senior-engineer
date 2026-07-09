import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTodoItemDto {
  @ApiProperty({
    example: 'Buy milk',
    description: 'Human-readable item text',
  })
  description: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Whether the item is already completed on creation',
  })
  completed?: boolean;
}
