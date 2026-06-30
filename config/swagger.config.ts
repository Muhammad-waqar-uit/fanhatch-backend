export default () => ({
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    title: process.env.SWAGGER_TITLE || 'Fans.tech API',
    description: process.env.SWAGGER_DESCRIPTION || 'Fans.tech backend API documentation',
    version: process.env.SWAGGER_VERSION || '1.0',
    path: process.env.SWAGGER_PATH || 'docs',
  },
})
