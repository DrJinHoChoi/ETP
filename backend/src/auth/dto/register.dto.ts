import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: '홍길동' })
  @IsString()
  @IsNotEmpty({ message: '이름을 입력해주세요' })
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요' })
  email: string;

  @ApiProperty({ example: 'StrongP@ss1', description: '최소 8자, 대문자·소문자·숫자·특수문자 각 1개 이상' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  @Matches(/(?=.*[a-z])/, { message: '비밀번호에 소문자가 최소 1개 포함되어야 합니다' })
  @Matches(/(?=.*[A-Z])/, { message: '비밀번호에 대문자가 최소 1개 포함되어야 합니다' })
  @Matches(/(?=.*\d)/, { message: '비밀번호에 숫자가 최소 1개 포함되어야 합니다' })
  @Matches(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, { message: '비밀번호에 특수문자가 최소 1개 포함되어야 합니다' })
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CONSUMER })
  @IsEnum(UserRole, { message: '유효한 역할을 선택해주세요 (SUPPLIER, CONSUMER, ADMIN)' })
  role: UserRole;

  @ApiProperty({ example: '한국전력공사' })
  @IsString()
  @IsNotEmpty({ message: '조직명을 입력해주세요' })
  organization: string;
}
