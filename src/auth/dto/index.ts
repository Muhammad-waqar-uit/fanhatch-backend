import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'
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

/** SIWE (EIP-4361) verification payload — the signed message + its signature. */
export class SiweVerifyDto {
  @ApiProperty({ description: 'The EIP-4361 message that was signed (SiweMessage.prepareMessage()).' })
  @IsString()
  @IsNotEmpty()
  message: string

  @ApiProperty({ description: 'The personal_sign signature over `message`.' })
  @IsString()
  @IsNotEmpty()
  signature: string
}
