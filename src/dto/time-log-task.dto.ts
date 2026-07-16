// dto/time-log-task.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class TimeLogTaskDto {
  @ApiProperty({
    example: "Task 93571: MS Co-sell Create - Zoho",
  })
  @IsString()
  task!: string;

  @ApiProperty({
    example: 4.5,
  })
  @IsNumber()
  @IsOptional()
  duration!: number;

  @ApiProperty({
    description: "Start time",
    example: "01:02 AM",
  })
  @IsOptional()
  @IsString()
  startTime!: string;

  @ApiProperty({
    description: "End time",
    example: "01:03 AM",
  })
  @IsOptional()
  @IsString()
  endTime!: string;
}
