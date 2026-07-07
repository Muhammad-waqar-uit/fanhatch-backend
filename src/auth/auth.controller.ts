import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, JwtAuthGuard, Public } from '@app/shared/auth'
import { IAuthUser } from '@app/shared/interfaces'
import { AuthService } from './auth.service'
import { LoginDto, RegisterDto, SiweVerifyDto } from './dto'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user and receive a JWT' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email + password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('siwe/nonce')
  @Public()
  @ApiOperation({ summary: 'Get a single-use nonce for a Sign-In With Ethereum challenge' })
  siweNonce() {
    return { nonce: this.authService.createSiweNonce() }
  }

  @Post('siwe/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a signed SIWE message and receive a JWT' })
  siweVerify(@Body() dto: SiweVerifyDto) {
    return this.authService.verifySiwe(dto)
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Echo the authenticated principal from the JWT' })
  me(@CurrentUser() user: IAuthUser) {
    return user
  }
}
