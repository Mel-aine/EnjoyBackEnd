// for AdonisJS v6
import path from 'node:path'
import url from 'node:url'
// ---

export default {
  // path: __dirname + "/../", for AdonisJS v5
  path: path.dirname(url.fileURLToPath(import.meta.url)) + '/../', // for AdonisJS v6
  title: 'EnjoyBackEnd API',
  version: '1.0.0',
  description: 'API complete pour la gestion des hotels et reservations',
  tagIndex: 2,
  openapi: '2.0.0',
  info: {
    title: 'EnjoyBackEnd API',
    version: '1.0.0',
    description: 'API complete pour la gestion des hotels, reservations et services',
    contact: {
      name: 'Support API',
      email: 'support@enjoybackend.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  snakeCase: true,
  debug: false,
  ignore: ['/swagger', '/docs'],
  preferredPutPatch: 'PUT',
  common: {
    parameters: {
      serviceId: {
        in: 'path',
        name: 'serviceId',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64'
        },
        description: 'ID du service'
      },
      id: {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64'
        },
        description: 'ID de la ressource'
      }
    },
    headers: {
      Authorization: {
        description: 'Token Bearer pour authentification',
        required: true,
        schema: {
          type: 'string',
          example: 'Bearer your-token-here'
        }
      }
    }
  },
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token JWT pour authentification'
    }
  },
  authMiddlewares: ['auth', 'auth:api'],
  defaultSecurityScheme: 'BearerAuth',
  persistAuthorization: true,
  showFullPath: false,
  tags: [
    {
      name: 'Authentication',
      description: 'Operations d\'authentification'
    },
    {
      name: 'Users',
      description: 'Gestion des utilisateurs'
    },
    {
      name: 'Roles',
      description: 'Gestion des roles'
    },
    {
      name: 'Services',
      description: 'Gestion des services'
    },
    {
      name: 'Products',
      description: 'Gestion des produits'
    },
    {
      name: 'Reservations',
      description: 'Gestion des reservations'
    },
    {
      name: 'Payments',
      description: 'Gestion des paiements'
    },
    {
      name: 'Dashboard',
      description: 'Statistiques et tableaux de bord'
    }
  ]
}