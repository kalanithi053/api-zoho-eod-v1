import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class GetTimeLogDto {
  @ApiProperty({
    example: "60012562414",
  })
  @IsString()
  portalId!: string;

  @ApiProperty({
    example: "105855000004264414",
  })
  @IsString()
  projectId!: string;

  @ApiProperty({
    example: "105855000000885613",
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    example: "2026-06-01",
  })
  @IsString()
  startDate!: string;
}

export class TaskLogDto {
  @ApiProperty({
    example: "Task 93571: MS Co-sell Create - Zoho",
  })
  @IsString()
  task!: string;

  @ApiProperty({
    example: 4.5,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({
    description: "Start time",
    example: "01:02 AM",
    required: false,
  })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiProperty({
    description: "End time",
    example: "01:03 AM",
    required: false,
  })
  @IsOptional()
  @IsString()
  endTime?: string;
}

export class CreateEodDto {
  @ApiProperty({
    example: "105855000004264414",
  })
  @IsString()
  projectID!: string;

  @ApiProperty({
    example: "kalanithi@amwhiz.com",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "2026-06-11",
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    type: [TaskLogDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskLogDto)
  body!: TaskLogDto[];
}
