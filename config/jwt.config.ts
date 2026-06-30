export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-env',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
})
