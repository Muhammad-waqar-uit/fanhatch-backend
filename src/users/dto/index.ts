import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsEmail, IsEthereumAddress, IsOptional, IsString, Matches, MinLength } from 'class-validator'
import { PaginateDto } from '@app/shared/dto'

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string

  @ApiProperty()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, { message: 'username must be 3-30 chars, alphanumeric or _' })
  username: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bio?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatarUrl?: string
}

class UpdatableUserFields {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  username?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bio?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatarUrl?: string
}

/** All fields optional; password excluded (handled by a dedicated endpoint). */
export class UpdateUserDto extends PartialType(UpdatableUserFields) {}

export class QueryUsersDto extends PaginateDto {}

export class SetWalletDto {
  @ApiProperty({ description: 'Smart-account / wallet address (EIP-55 or lowercase)' })
  @IsEthereumAddress()
  walletAddress: string

  @ApiPropertyOptional({
    description: 'Ownership-proof message signed by the underlying Web3Auth EOA',
  })
  @IsString()
  @IsOptional()
  message?: string

  @ApiPropertyOptional({
    description: 'EOA signature over `message` (proves control of the Web3Auth key)',
  })
  @IsString()
  @IsOptional()
  signature?: string
}
