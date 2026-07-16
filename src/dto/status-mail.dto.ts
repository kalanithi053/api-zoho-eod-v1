import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class StatusLogDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "2026-06-06",
  })
  date!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "api doc",
  })
  task!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "02:00",
  })
  duration!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "Kalanithi Balachandran",
  })
  name!: string;
}

export class StatusMailPayloadDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "2026-06-06",
  })
  reportDate!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "SaaSify",
  })
  projectName!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "Kalanithi",
  })
  resourceName!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: "8:00",
  })
  totalHours!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusLogDto)
  @ApiProperty({
    example: [
      {
        date: "2026-06-06",
        name: "Kalanithi Balachandran",
        duration: "02:00",
        task: "MS Co-sell",
      },
    ],
  })
  logs!: StatusLogDto[];
}
