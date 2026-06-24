import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

export default {
  path: __dirname + '/../',
  title: 'EnjoyBackEnd External API',
  version: '1.0.0',
  description: 'Documentation Swagger dediee aux routes External API',
  tagIndex: 2,
  openapi: '2.0.0',
  info: {
    title: 'EnjoyBackEnd External API',
    version: '1.0.0',
    description: 'API externe protegee par pos_api_key pour les integrations clientes',
    contact: {
      name: 'Support API',
      email: 'support@enjoybackend.com',
    },
  },
  snakeCase: true,
  debug: false,
  ignore: ['/swagger*', '/docs*'],
  preferredPutPatch: 'PUT',
  common: {
    parameters: {
      hotelId: {
        in: 'path',
        name: 'hotelId',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64',
        },
        description: "ID de l'hotel",
      },
      reservationId: {
        in: 'path',
        name: 'reservationId',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64',
        },
        description: 'ID de la reservation',
      },
      roomTypeId: {
        in: 'path',
        name: 'roomTypeId',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64',
        },
        description: 'ID du type de chambre',
      },
      folioId: {
        in: 'path',
        name: 'folioId',
        required: true,
        schema: {
          type: 'integer',
          format: 'int64',
        },
        description: 'ID du folio',
      },
    },
    headers: {
      'x-pos-api-key': {
        description: "Cle API externe de l'hotel",
        required: true,
        schema: {
          type: 'string',
          example: 'pos_xxxxx',
        },
      },
      'x-user-id': {
        description: 'Utilisateur systeme a utiliser pour les ecritures et logs',
        required: false,
        schema: {
          type: 'integer',
          example: 87,
        },
      },
    },
  },
  securitySchemes: {
    PosApiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'x-pos-api-key',
      description: "Cle API externe de l'hotel",
    },
  },
  authMiddlewares: ['apiKey'],
  defaultSecurityScheme: 'PosApiKeyAuth',
  persistAuthorization: true,
  showFullPath: true,
  tags: [
    {
      name: 'External',
      description: 'Routes dediees aux integrations externes',
    },
    {
      name: 'Configuration',
      description: "Configuration hotel, chambres, tarifs et disponibilites",
    },
    {
      name: 'Guests',
      description: 'Clients / guests',
    },
    {
      name: 'Reservations',
      description: 'Reservations externes',
    },
    {
      name: 'Folios',
      description: 'Folios et transactions',
    },
    {
      name: 'Documents',
      description: 'PDF, emails et exports',
    },
    {
      name: 'Reports',
      description: 'Rapports exposes a l externe',
    },
  ],
}
