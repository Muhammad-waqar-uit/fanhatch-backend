import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { CreateUserDto } from '@app/src/users/dto'

/** Registration reuses the user create DTO. */
export class RegisterDto extends CreateUserDto {}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string
}
