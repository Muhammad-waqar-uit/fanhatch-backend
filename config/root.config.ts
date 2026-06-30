export default () => ({
  app: {
    name: process.env.APP_NAME || 'FansTech',
    host: process.env.APP_HOST || 'localhost',
    port: parseInt(process.env.APP_PORT, 10) || 3000,
    debug: !(process.env.NODE_ENV === 'production'),
    prefix: process.env.API_PREFIX || 'api/v1',
    url: process.env.APP_URL || 'http://localhost:3000',
  },
})
