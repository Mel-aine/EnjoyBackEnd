import router from '@adonisjs/core/services/router'
import UsersController from '#controllers/users_controller'
import RolesController from '#controllers/roles_controller'
import ReservationsController from '#controllers/reservations_controller'
import StockCategoriesController from '#controllers/stock_categories_controller'
import SuppliersController from '#controllers/suppliers_controller'
import MouvementsController from '#controllers/mouvements_controller'
import DepartmentsController from '#controllers/departments_controller'
import ExpensesController from '#controllers/expenses_controller'
import AssigmentUsersController from '#controllers/assigment_users_controller'
import PermissionsController from '#controllers/permissions_controller'
import TasksController from '#controllers/tasks_controller'
import RolePermissionsController from '#controllers/role_permissions_controller'
import CancellationPoliciesController from '#controllers/cancellation_policies_controller'
import HotelsController from '#controllers/hotels_controller'
import CurrenciesController from '#controllers/currencies_controller'
import GuestsController from '#controllers/guests_controller'
import RoomTypesController from '#controllers/room_types_controller'
import BedTypesController from '#controllers/bed_types_controller'
import UnitsController from '#controllers/units_controller'
import RoomsController from '#controllers/rooms_controller'
import FoliosController from '#controllers/folios_controller'
import FolioPrintController from '#controllers/folio_print_controller'
import FolioTransactionsController from '#controllers/folio_transactions_controller'
import PaymentMethodsController from '#controllers/payment_methods_controller'
import IdentityTypesController from '#controllers/identity_types_controller'
import ReservationRoomsController from '#controllers/reservation_rooms_controller'
import RoomOwnersController from '#controllers/room_owners_controller'
import RoomRatesController from '#controllers/room_rates_controller'
import MealPlansController from '#controllers/meal_plans_controller'
import RateTypesController from '#controllers/rate_types_controller'
import SeasonsController from '#controllers/seasons_controller'
import ReasonsController from '#controllers/reasons_controller'
import DiscountsController from '#controllers/discounts_controller'
import TransportationModesController from '#controllers/transportation_modes_controller'
import TemplateCategoriesController from '#controllers/template_categories_controller'
import BlackListReasonsController from '#controllers/black_list_reasons_controller'
import MarketCodesController from '#controllers/market_codes_controller'
import ReservationTypesController from '#controllers/reservation_types_controller'
import PreferenceTypesController from '#controllers/preference_types_controller'
import PreferencesController from '#controllers/preferences_controller'
import BusinessSourcesController from '#controllers/business_sources_controller'
import BookingSourcesController from '#controllers/booking_sources_controller'
import PayoutReasonsController from '#controllers/payout_reasons_controller'
import ExtraChargesController from '#controllers/extra_charges_controller'
import TaxRatesController from '#controllers/tax_rates_controller'
import LostFoundController from '#controllers/lost_found_controller'
import RoomBlocksController from '#controllers/room_blocks_controller'
import VipStatusController from '#controllers/vip_status_controller'
import IncidentalInvoiceController from '#controllers/incidental_invoice_controller'
import CityLedgerController from '#controllers/city_ledger_controller'
import CompanyFolioController from '#controllers/company_folio_controller'
import NightAuditController from '#controllers/night_audit_controller'
import ChannexMigrationController from '#controllers/channex_migration_controller'
import ConfigurationController from '#controllers/configuration_controller'
import AuditTrailController from '#controllers/audit_trail_controller'
import EmailAccountsController from '#controllers/email_accounts_controller'
import EmailTemplateController from '#controllers/email_template_controller'
import TransportRequestsController from '#controllers/transport_requests_controller'
import WorkOrdersController from '#controllers/work_orders_controller'
import HouseKeepersController from '#controllers/house_keepers_controller'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// Root route that presents Enjoys API documentation and test examples
router.get('/', async ({ request, response }) => {
  const baseUrl = `${request.protocol()}://${request.host()}`
  const filePath = join(process.cwd(), 'resources', 'views', 'api_home.html')
  let html = readFileSync(filePath, 'utf-8')
  html = html.replace(/\{\{BASE_URL\}\}/g, baseUrl)
  response.type('html')
  return response.send(html)
})
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'
import { middleware } from '#start/kernel'

// import { middleware } from '#start/kernel'
import ActivityLogsController from '#controllers/activity_logs_controller'
// import { middleware } from '#start/kernel'

// Import dynamique
const AuthController = () => import('#controllers/auth_controller')
import DashboardController from '#controllers/dasboard_controller'
import EmploymentContractsController from '#controllers/employment_contracts_controller'
import PayrollsController from '#controllers/payrolls_controller'
// Import dynamique
const dashboardController = new DashboardController()
const StaffDashboardsController = () => import('#controllers/staff_dashboards_controller')

const usersController = new UsersController()
const employmentContractController = new EmploymentContractsController()
const payrollController = new PayrollsController()
const rolesController = new RolesController()
const stockCategoriesController = new StockCategoriesController()
const suppliersController = new SuppliersController()
const mouvementsController = new MouvementsController()
const departmentsController = new DepartmentsController()
const expensesController = new ExpensesController()
const assigmentUsersController = new AssigmentUsersController()
const permissionsController = new PermissionsController()
const tasksController = new TasksController()
const rolePermissionsController = new RolePermissionsController()
const activityLogsController = new ActivityLogsController()
const cancellationPoliciesController = new CancellationPoliciesController()
const hotelsController = new HotelsController()
const currenciesController = new CurrenciesController()
const guestsController = new GuestsController()
const roomTypesController = new RoomTypesController()
const bedTypesController = new BedTypesController()
const unitsController = new UnitsController()
const roomsController = new RoomsController()
const foliosController = new FoliosController()
const folioPrintController = new FolioPrintController()
const folioTransactionsController = new FolioTransactionsController()
const paymentMethodsController = new PaymentMethodsController()
const identityTypesController = new IdentityTypesController()
const reservationRoomsController = new ReservationRoomsController()
const roomOwnersController = new RoomOwnersController()
const roomRatesController = new RoomRatesController()
const mealPlansController = new MealPlansController()
const rateTypesController = new RateTypesController()
const seasonsController = new SeasonsController()
const reasonsController = new ReasonsController()
const discountsController = new DiscountsController()
const transportationModesController = new TransportationModesController()
const templateCategoriesController = new TemplateCategoriesController()
const blackListReasonsController = new BlackListReasonsController()
const marketCodesController = new MarketCodesController()
const reservationTypesController = new ReservationTypesController()
const preferenceTypesController = new PreferenceTypesController()
const preferencesController = new PreferencesController()
const businessSourcesController = new BusinessSourcesController()
const bookingSourcesController = new BookingSourcesController()
const payoutReasonsController = new PayoutReasonsController()
const extraChargesController = new ExtraChargesController()
const taxRatesController = new TaxRatesController()
const lostFoundController = new LostFoundController()
const reservationsController = new ReservationsController()
const roomBlocksController = new RoomBlocksController()
const vipStatusController = new VipStatusController()
const incidentalInvoiceController = new IncidentalInvoiceController()
const cityLedgerController = new CityLedgerController()
const companyFolioController = new CompanyFolioController()
const nightAuditController = new NightAuditController()
const channexMigrationController = new ChannexMigrationController()
const configurationController = new ConfigurationController()
const auditTrailController = new AuditTrailController()
const emailAccountsController = new EmailAccountsController()
const emailTemplateController = new EmailTemplateController()
const transportRequestsController = new TransportRequestsController()
const workOrdersController = new WorkOrdersController()
const houseKeepersController = new HouseKeepersController()


router.get('/swagger', async () => {
  return AutoSwagger.default.ui('/swagger/json', swagger)
})
router.get('/swagger/json', async ({ response }) => {
  const basicSpec = {
    swagger: '2.0',
    info: swagger.info,
    host: 'enjoybackend-4udk.onrender.com',
    basePath: '/',
    schemes: ['http','https'],
    securityDefinitions: {
      Bearer: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Token JWT - Format: Bearer {token}',
      },
    },
    paths: {
      '/ping': {
        get: {
          summary: 'Test de connectivité',
          responses: {
            200: {
              description: 'Serveur actif',
            },
          },
        },
      },
      '/api/authLogin': {
        post: {
          summary: 'Connexion utilisateur',
          consumes: ['application/json'],
          parameters: [
            {
              in: 'body',
              name: 'credentials',
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          ],
          responses: {
            200: { description: 'Connexion réussie' },
            401: { description: 'Identifiants invalides' }
          }
        }
      },
      '/api/users': {
        post: {
          summary: 'Créer un nouvel utilisateur (nécessite authentification)',
          security: [{ Bearer: [] }],
          consumes: ['application/json'],
          parameters: [{
            in: 'body',
            name: 'user',
            schema: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { type: 'string', example: 'Jean Dupont' },
                email: { type: 'string', example: 'jean.dupont@example.com' },
                password: { type: 'string', example: 'Password123' },
                phone: { type: 'string', example: '+33123456789' },
                address: { type: 'string', example: '123 Rue de la Paix' },
                role_id: { type: 'integer', example: 1 }
              }
            }
          }],
          responses: {
            201: { description: 'Utilisateur créé avec succès' },
            400: { description: 'Données invalides' },
            401: { description: 'Non autorisé' },
            422: { description: 'Email déjà utilisé' }
          }
        },
        get: {
          summary: 'Lister tous les utilisateurs (nécessite authentification)',
          security: [{ Bearer: [] }],
          responses: {
            200: { description: 'Liste des utilisateurs' },
            401: { description: 'Non autorisé' }
          }
        }
      },
      '/api/servicesWithUser': {
        post: {
          summary: 'Créer un service avec un utilisateur (inscription publique)',
          consumes: ['application/json'],
          parameters: [{
            in: 'body',
            name: 'serviceWithUser',
            schema: {
              type: 'object',
              required: ['user', 'service'],
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Jean Dupont' },
                    email: { type: 'string', example: 'read@gmail.com' },
                    password: { type: 'string', example: 'Password123' },
                    phone: { type: 'string', example: '+33123456789' }
                  }
                },
                service: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Mon Hôtel' },
                    description: { type: 'string', example: 'Un bel hôtel' },
                    category_id: { type: 'integer', example: 1 }
                  }
                }
              }
            }
          }],
          responses: {
            201: { description: 'Service et utilisateur créés avec succès' },
            400: { description: 'Données invalides' },
            422: { description: 'Email déjà utilisé' }
          }
        }
      },
      '/api/hotels': {
        post: {
          summary: 'Créer un nouvel hôtel avec utilisateur admin (nécessite authentification)',
          security: [{ Bearer: [] }],
          consumes: ['application/json'],
          parameters: [{
            in: 'body',
            name: 'hotelWithAdmin',
            schema: {
              type: 'object',
              required: ['hotel', 'admin'],
              properties: {
                hotel: {
                  type: 'object',
                  required: ['name', 'address', 'city', 'country'],
                  properties: {
                    name: { type: 'string', example: 'Grand Hôtel Paris' },
                    description: { type: 'string', example: 'Un magnifique hôtel au cœur de Paris' },
                    address: { type: 'string', example: '123 Avenue des Champs-Élysées' },
                    city: { type: 'string', example: 'Paris' },
                    state: { type: 'string', example: 'Île-de-France' },
                    country: { type: 'string', example: 'France' },
                    postalCode: { type: 'string', example: '75008' },
                    phone: { type: 'string', example: '+33142563789' },
                    email: { type: 'string', example: 'contact@grandhotel.com' },
                    website: { type: 'string', example: 'https://www.grandhotel.com' },
                    starRating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                    checkInTime: { type: 'string', example: '15:00' },
                    checkOutTime: { type: 'string', example: '11:00' },
                    currency: { type: 'string', example: 'EUR' },
                    timezone: { type: 'string', example: 'Europe/Paris' },
                    taxRate: { type: 'number', example: 10.5 },
                    serviceFeeRate: { type: 'number', example: 5.0 },
                    cancellationPolicy: { type: 'string', example: 'Annulation gratuite jusqu\'à 24h avant l\'arrivée' },
                    policies: { type: 'string', example: 'Politique de l\'hôtel concernant les animaux, fumeurs, etc.' },
                    amenities: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['WiFi gratuit', 'Piscine', 'Spa', 'Restaurant', 'Bar']
                    },
                    facilities: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Parking', 'Salle de sport', 'Centre d\'affaires']
                    },
                    languages: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Français', 'Anglais', 'Espagnol']
                    },
                    coordinates: {
                      type: 'object',
                      properties: {
                        latitude: { type: 'number', example: 48.8566 },
                        longitude: { type: 'number', example: 2.3522 }
                      }
                    },
                    socialMedia: {
                      type: 'object',
                      properties: {
                        facebook: { type: 'string', example: 'https://facebook.com/grandhotel' },
                        instagram: { type: 'string', example: 'https://instagram.com/grandhotel' },
                        twitter: { type: 'string', example: 'https://twitter.com/grandhotel' }
                      }
                    }
                  }
                },
                admin: {
                  type: 'object',
                  required: ['name', 'email', 'password'],
                  properties: {
                    name: { type: 'string', example: 'Marie Dubois' },
                    email: { type: 'string', example: 'marie.dubois@grandhotel.com' },
                    password: { type: 'string', example: 'AdminPassword123' },
                    phone: { type: 'string', example: '+33123456789' },
                    address: { type: 'string', example: '456 Rue de Rivoli' },
                    title: { type: 'string', example: 'Directrice Générale' }
                  }
                }
              }
            }
          }],
          responses: {
            201: { description: 'Hôtel et administrateur créés avec succès' },
            400: { description: 'Données invalides' },
            401: { description: 'Non autorisé' },
            422: { description: 'Email déjà utilisé ou données en conflit' }
          }
        },
        get: {
          summary: 'Lister tous les hôtels (nécessite authentification)',
          security: [{ Bearer: [] }],
          responses: {
            200: { description: 'Liste des hôtels' },
            401: { description: 'Non autorisé' }
          }
        }
      }
    },
  }
  return response.json(basicSpec)
})
router
  .group(() => {
    // Basic CRUD operations for hotels
    router.post('/', hotelsController.store.bind(hotelsController)) // Create a new hotel
  })
  .prefix('api/hotels')
router.post('api/auth', [AuthController, 'login'])
router.post('api/authLogin', [AuthController, 'signin'])
router.post('api/initSpace', [AuthController, 'initSpace'])
router.post('api/authLogout', [AuthController, 'logout'])
router.get('api/auth', [AuthController, 'user'])
router.put('api/auth/:id', [AuthController, 'update_user'])
router.post('api/validateEmail', [AuthController, 'validateEmail'])
router.post('api/validatePassword', [AuthController, 'validatePassword'])
router.get('api/staff_management/dashboard/:serviceId', [StaffDashboardsController, 'index'])
router.get('/ping', async ({ response }) => {
  return response.ok({ status: 'alive', timestamp: new Date().toISOString() })
})
// router.get('/services', servicesController.list.bind(servicesController)).prefix('/api')
// router.get('/services/search', servicesController.searchByName.bind(servicesController)).prefix('/api')
// router.post( '/servicesWithUser', servicesController.createWithUserAndService.bind(servicesController)).prefix('/api')


router
  .group(() => {
    router.group(() => {
      router.get('/users', usersController.list.bind(usersController))
      router.post('/customers', usersController.storeClient.bind(usersController))
      router.get('/users/:id', usersController.getUserById.bind(usersController))
      router.put('/users_update/:id', usersController.updateUserWithService.bind(usersController))
      router.put('/update_customer/:id', usersController.update.bind(usersController))
      router.get('/users/:id/details', usersController.getUserDetails.bind(usersController))
      router.delete('/users/:id', usersController.destroy.bind(usersController))
      router.get('/users/:id/profile', usersController.getCustomerProfile.bind(usersController))
      router.get(
        '/services/:serviceId/clients',
        usersController.getClientsByService.bind(usersController)
      )
    })

   /* router.group(() => {
      router.get(
        '/employment_contracts',
        employmentContractController.getMultiple.bind(employmentContractController)
      )
      router.get(
        '/employment_contracts/:id',
        employmentContractController.getOne.bind(employmentContractController)
      )
      router.post(
        '/employment_contracts',
        employmentContractController.save.bind(employmentContractController)
      )
      router.put(
        '/employment_contracts/:id',
        employmentContractController.update.bind(employmentContractController)
      )
      router.put(
        '/employment_contracts/:id/terminate',
        employmentContractController.terminate.bind(employmentContractController)
      )
    })*/
    router.group(() => {
      router.get('/payroll', payrollController.getMultiple.bind(payrollController))
      router.get('/payroll/:id', payrollController.getOne.bind(payrollController))
      router.post('/payroll', payrollController.save.bind(payrollController))
      router.put('/payroll/:id', payrollController.update.bind(payrollController))
      router.get(
        '/payroll/by-employee/:employeeId',
        payrollController.getPayrollByEmployee.bind(payrollController)
      )
      router.get(
        '/payroll/by-contract/:contractId',
        payrollController.getPayrollsByContract.bind(payrollController)
      )
    })

    router.group(() => {
      router.get('/usersbyservice/:id', usersController.getUserByServices.bind(usersController))
    })

    router.group(() => {
      router.get(
        '/roles_permissions/:serviceId',
        rolesController.getRolesByServiceWithPermissions.bind(rolesController)
      )
      router.get(
        '/hotel/:hotelId/roles',
        rolesController.getRolesByHotel.bind(rolesController)
      )
      router.post('/roles', rolesController.store.bind(rolesController))
      router.put('/roles/:id', rolesController.update.bind(rolesController))
      router.delete('/roles/:id', rolesController.destroy.bind(rolesController))
    })

    router.group(() => {
      // HouseKeepers (Configuration) with hotel context
      router.get('/configuration/hotels/:hotelId/housekeepers', houseKeepersController.index.bind(houseKeepersController))
      router.get('/configuration/hotels/:hotelId/housekeepers/:id', houseKeepersController.show.bind(houseKeepersController))
      router.post('/configuration/hotels/:hotelId/housekeepers', houseKeepersController.store.bind(houseKeepersController))
      router.put('/configuration/hotels/:hotelId/housekeepers/:id', houseKeepersController.update.bind(houseKeepersController))
      router.delete('/configuration/hotels/:hotelId/housekeepers/:id', houseKeepersController.destroy.bind(houseKeepersController))
    })

    router.group(() => {
      router.get(
        '/stockCategory/:serviceId',
        stockCategoriesController.GetByServiceId.bind(stockCategoriesController)
      )
      router.post('/stockCategory', stockCategoriesController.store.bind(stockCategoriesController))
      router.put(
        '/stockCategory/:id',
        stockCategoriesController.update.bind(stockCategoriesController)
      )
      router.delete(
        '/stockCategory/:id',
        stockCategoriesController.destroy.bind(stockCategoriesController)
      )
    })

    router.group(() => {
      router.get(
        '/supplier/:serviceId',
        suppliersController.GetByServiceId.bind(suppliersController)
      )
      router.post('/supplier', suppliersController.store.bind(suppliersController))
      router.put('/supplier/:id', suppliersController.update.bind(suppliersController))
      router.delete('/supplier/:id', suppliersController.destroy.bind(suppliersController))
    })


    router.group(() => {
      router.get('/expenses/:serviceId', expensesController.GetByServiceId.bind(expensesController))
      router.post('/expenses', expensesController.store.bind(expensesController))
      router.put('/expenses/:id', expensesController.update.bind(expensesController))
      router.delete('/expenses/:id', expensesController.destroy.bind(expensesController))
    })

    router.group(() => {
      router.get(
        '/department',
        departmentsController.index.bind(departmentsController)
      )
      router.post('/department', departmentsController.store.bind(departmentsController))
      router.put('/department/:id', departmentsController.update.bind(departmentsController))
      router.delete('/department/:id', departmentsController.destroy.bind(departmentsController))
    })

    router.group(() => {
      router.get(
        '/movement/:serviceId',
        mouvementsController.GetByServiceId.bind(mouvementsController)
      )
      router.post('/movement', mouvementsController.storeMouvement.bind(mouvementsController))
      router.put('/movement/:id', mouvementsController.update.bind(mouvementsController))
      router.delete('/movement/:id', mouvementsController.destroy.bind(mouvementsController))
    })

    // TODO: Implement services controller routes
    // router.group(() => {
    //   router.post('/services', servicesController.store.bind(servicesController))
    //   router.get('/servicesByCategory/:categoryId', servicesController.showByCategorie.bind(servicesController))
    //   router.get('/services/:id', servicesController.show.bind(servicesController))
    //   router.patch('/services/:id', servicesController.update.bind(servicesController))
    //   router.delete('/services/:id', servicesController.destroy.bind(servicesController))
    //   router.get('/services/customer/:serviceId', servicesController.customers.bind(servicesController))
    //   router.get('/servicesWithServiceProduct', servicesController.getServicesWithProductsAndOptions.bind(servicesController))
    //   router.get('/services/:serviceId/departments/:departmentId/details', departmentsController.getDepartmentDetails.bind(departmentsController))
    // })

    // TODO: Implement TypeProductsController
    // Type product routes will be added once the controller is implemented

    // TODO: Implement ServiceProductsController
    // Service product routes will be added once the controller is implemented

    // TODO: Implement reservations routes
    // Reservations routes will be added once properly configured

    router.group(() => {
      router.get('/activity-logs', activityLogsController.index.bind(activityLogsController))
      router.post('/activity-logs', activityLogsController.store.bind(activityLogsController))
      router.get(
        '/activity-logs/user/:createdBy',
        activityLogsController.showByUser.bind(activityLogsController)
      )

      router.get('/activity-log/:hotelId/guests/:guestId/activity-logs', activityLogsController.getActivityLogs.bind(activityLogsController))

      // This route must be before /:id to avoid 'by-entity' being treated as an id
      router.get(
        '/activity-logs/by-entity',
        activityLogsController.showByEntity.bind(activityLogsController)
      )
      router.get('/activity-logs/:id', activityLogsController.show.bind(activityLogsController))
      router.put('/activity-logs/:id', activityLogsController.update.bind(activityLogsController))
    })

    // TODO: Implement ReservationServiceProductsController
    // Reservation service product routes will be added once the controller is implemented



    // TODO: Implement PaymentsController
    // Payment routes will be added once the controller is implemented


    // router.group(() => {
    //   router.post('/schedules', schedulesController.create.bind(SchedulesController))
    //   router.get('/schedules', schedulesController.lister.bind(SchedulesController))
    // })

    // router.group(() => {
    //   router.get(
    //     '/services/:serviceId/products/grouped',
    //     serviceProductsController.getGroupedByAccommodationType.bind(ServiceProductsController)
    //   )
    // })

    router.group(() => {
      router.get('/assigmentUser', assigmentUsersController.list.bind(assigmentUsersController))
      router.put('/assign-user/:id', assigmentUsersController.updateUser.bind(assigmentUsersController))
      router.delete('/assign-user/:id', assigmentUsersController.deleteUser.bind(assigmentUsersController))
      router.get(
        '/assigmentUser/:serviceId',
        assigmentUsersController.showByServiceId.bind(assigmentUsersController)
      )
      router.get(
        '/hotel/:hotelId/employees',
        assigmentUsersController.getEmployeesForService.bind(assigmentUsersController)
      )
    })

    router.group(() => {
      router.get('/permission', permissionsController.list.bind(permissionsController))
      router.get(
        '/permissions',
        permissionsController.getUserPermissions.bind(permissionsController)
      )
    })

    router.group(() => {
      router.post('/tasks', tasksController.store.bind(tasksController))
      router.get('/tasks/:serviceId', tasksController.showByServiceId.bind(tasksController))
      router.patch('/tasks/:id', tasksController.updateStatus.bind(tasksController))
      router.get('/tasks_search/filter', tasksController.filter.bind(tasksController))
    })

    router.group(() => {
      router.post(
        '/roles/assign-permissions',
        rolePermissionsController.assignPermissions.bind(rolePermissionsController)
      )
    })

    router.group(() => {
      router.post(
        '/assign-user',
        assigmentUsersController.createUser.bind(assigmentUsersController)
      )
    })
    // DASHBOARD
    router.group(() => {
      router.get(
        '/occupancy/:serviceId/stats',
        dashboardController.occupancyStats.bind(dashboardController)
      ) // Endpoint pour les taux d'occupation semaine, mois, année
      router.get(
        '/availability/:serviceId',
        dashboardController.getAvailability.bind(dashboardController)
      ) // Endpoint pour les disponibilités des chambres le taux d'ocupation, le nombre de chambres disponibles, le nombre de chambres occupées, le nombre de chambres réservées aujourd'hui et le taux de réservation aujourd'hui et la semaine dernière
      router.get(
        '/occupancy/:serviceId/average-stay',
        dashboardController.averageStay.bind(dashboardController)
      ) // Endpoint pour la durée moyenne de séjour
      router.get(
        '/revenue/:serviceId/stats',
        dashboardController.getRevenueStats.bind(dashboardController)
      ) // Endpoint pour les statistiques de revenus annuels, mensuels, trimestriels et semestriels
      router.get(
        '/revenue/:serviceId/monthly-comparison',
        dashboardController.getMonthlyRevenueComparison.bind(dashboardController)
      ) // Endpoint pour la comparaison des revenus mensuels
      router.get(
        '/occupancy/:serviceId/average-rate',
        dashboardController.averageOccupancyRate.bind(dashboardController)
      ) // Endpoint pour le taux d'occupation moyen sur une période donnée
      router.get(
        '/occupancy/:id/monthly',
        dashboardController.monthlyOccupancy.bind(dashboardController)
      ) // Endpoint pour les statistiques d'occupation mensuelles
      router.get(
        '/adr/:serviceId/:period',
        dashboardController.getAverageDailyRate.bind(dashboardController)
      ) // Endpoint pour le tarif journalier moyen
      router.get(
        '/clients/origin-stats/:serviceId',
        dashboardController.nationalityStats.bind(dashboardController)
      ) //Endpoint pour les statistiques de nationalité des clients
      router.get(
        '/stay-duration/:serviceId',
        dashboardController.stayDurationStats.bind(dashboardController)
      )
      // Endpoint pour les statistque de type de client
      router.get(
        '/customer-types/:serviceId',
        dashboardController.customerTypeStats.bind(dashboardController)
      )
      router.get(
        '/reservation/:serviceId',
        dashboardController.yearlyReservationTypes.bind(dashboardController)
      )
    })
    router
      .group(() => {
        router.get('/service/:serviceId/daily-occupancy', [
          DashboardController,
          'getDailyOccupancyAndReservations',
        ])
        router.get('/front-office/:serviceId', [
          DashboardController,
          'getFrontOfficeDashboard',
        ])
      })
      .prefix('/dashboard')

    // Hotel Management Routes
    // Comprehensive hotel management system with CRUD operations and analytics
    router
      .group(() => {
        // Basic CRUD operations for hotels
        router.get('/', hotelsController.index.bind(hotelsController)) // Get all hotels with pagination and search
        //router.post('/', hotelsController.store.bind(hotelsController)) // Create a new hotel
        router.get('/:id', hotelsController.show.bind(hotelsController)) // Get specific hotel details
        router.put('/:id', hotelsController.update.bind(hotelsController)) // Update hotel information
        router.put('/:id/information', hotelsController.updateHotelInformation.bind(hotelsController)) // Update complete hotel information
        router.put('/:id/notices', hotelsController.updateNotices.bind(hotelsController)) // Update hotel notices
        router.put('/:id/formula-setting', hotelsController.updateFormulaSetting.bind(hotelsController)) // Update hotel formula settings
        router.put('/:id/document-numbering-setting', hotelsController.updateDocumentNumberingSetting.bind(hotelsController)) // Update hotel document numbering settings
        router.put('/:id/print-email-settings', hotelsController.updatePrintEmailSettings.bind(hotelsController)) // Update hotel print and email settings
        router.put('/:id/checkin-reservation-settings', hotelsController.updateCheckinReservationSettings.bind(hotelsController)) // Update hotel check-in and reservation settings
        router.put('/:id/display-settings', hotelsController.updateDisplaySettings.bind(hotelsController)) // Update hotel display settings
        router.put('/:id/registration-settings', hotelsController.updateRegistrationSettings.bind(hotelsController)) // Update hotel registration settings
        router.put('/:id/housekeeping-status-colors', hotelsController.updateHousekeepingStatusColors.bind(hotelsController)) // Update hotel housekeeping status colors
        router.delete('/:id', hotelsController.destroy.bind(hotelsController)) // Delete hotel

        // Hotel analytics and statistics
        router.get('/:id/statistics', hotelsController.stats.bind(hotelsController)) // Get hotel statistics (rooms, occupancy, revenue)

        // Hotel status management
        router.patch('/:id/toggle-status', hotelsController.toggleStatus.bind(hotelsController)) // Activate/deactivate hotel
        router.patch('/:id/status-colors', hotelsController.updateStatusColors.bind(hotelsController)) // Update hotel status colors
      })
      .prefix('hotels')



    // Guest Management Routes
    // Complete guest profile management with search and analytics
    router
      .group(() => {
        // Basic CRUD operations for guests
        router.get('/', guestsController.index.bind(guestsController)) // Get all guests with pagination, search, and filtering
        router.post('/', guestsController.store.bind(guestsController)) // Create a new guest profile
        router.get('/:id/customer', [GuestsController, 'showbyHotelId'])//get guest
        router.get('/:id', guestsController.show.bind(guestsController)) // Get specific guest details with reservation history
        router.put('/:id', guestsController.update.bind(guestsController)) // Update guest information
        router.delete('/:id', guestsController.destroy.bind(guestsController)) // Delete guest profile

        // Guest analytics and history
        router.get('/:id/profile', guestsController.profile.bind(guestsController)) // Get guest profile with stay history

        // Guest status management
        router.patch('/:id/update-vip-status', guestsController.updateVipStatus.bind(guestsController)) // Update VIP status
        router.patch('/:id/toggle-blacklist', guestsController.toggleBlacklist.bind(guestsController)) // Toggle blacklist status
      })
      .prefix('guests')

    // Room Type Management Routes
    // Room type configuration and pricing management
    router
      .group(() => {
        // Basic CRUD operations for room types
        router.get('/', roomTypesController.showByHotel.bind(roomTypesController)) // Get all room types with filtering by hotel
        router.post('/', roomTypesController.store.bind(roomTypesController)) // Create a new room type
        router.get('/:id', roomTypesController.showByHotel.bind(roomTypesController)) // Get specific room type details
        router.put('/:id', roomTypesController.update.bind(roomTypesController)) // Update room type information
        router.delete('/:id', roomTypesController.destroy.bind(roomTypesController)) // Soft delete room type
        router.patch('/:id/restore', roomTypesController.restore.bind(roomTypesController)) // Restore soft-deleted room type
        router.patch('/:id/toggle-status', roomTypesController.toggleStatus.bind(roomTypesController)) // Toggle publish to website status

        // Room type analytics
        router.get('/:id/stats', roomTypesController.stats.bind(roomTypesController)) // Get room type statistics
        router.get('/:id/availability', roomTypesController.availability.bind(roomTypesController)) // Check availability for date range

        // Sort order management
        router.post('/sort/sort-order', roomTypesController.updateSortOrder.bind(roomTypesController)) // Update sort order for multiple room types
      })
      .prefix('configuration/hotels/:hotelId/room_types')

    // Bed Type Management Routes
    // Bed type configuration for room types
    router
      .group(() => {
        // Basic CRUD operations for bed types
        router.get('/', bedTypesController.index.bind(bedTypesController)) // Get all bed types with filtering by hotel
        router.post('/', bedTypesController.store.bind(bedTypesController)) // Create a new bed type
        router.get('/:id', bedTypesController.show.bind(bedTypesController)) // Get specific bed type details
        router.put('/:id', bedTypesController.update.bind(bedTypesController)) // Update bed type information
        router.delete('/:id', bedTypesController.destroy.bind(bedTypesController)) // Soft delete bed type
        router.patch('/:id/restore', bedTypesController.restore.bind(bedTypesController)) // Restore soft-deleted bed type
        router.patch('/:id/toggle-status', bedTypesController.toggleStatus.bind(bedTypesController)) // Toggle bed type status
      })
      .prefix('configuration/hotels/:hotelId/bed_types')

    // Unit Management Routes
    // Units configuration under hotel
    router
      .group(() => {
        // Basic CRUD operations for units
        router.get('/', unitsController.index.bind(unitsController)) // Get all units with filtering by hotel
        router.post('/', unitsController.store.bind(unitsController)) // Create a new unit
        router.get('/:id', unitsController.show.bind(unitsController)) // Get specific unit details
        router.put('/:id', unitsController.update.bind(unitsController)) // Update unit information
        router.delete('/:id', unitsController.destroy.bind(unitsController)) // Soft delete unit
        router.patch('/:id/restore', unitsController.restore.bind(unitsController)) // Restore soft-deleted unit
      })
      .prefix('configuration/hotels/:hotelId/units')

    // Rate Type Management Routes
    // Rate type configuration and pricing management
    router
      .group(() => {
        // Basic CRUD operations for rate types
        router.get('/', rateTypesController.index.bind(rateTypesController)) // Get all rate types with filtering by hotel
        router.post('/', rateTypesController.store.bind(rateTypesController)) // Create a new rate type
        router.get('/:id', rateTypesController.show.bind(rateTypesController)) // Get specific rate type details
        router.get('/hotel/:id', rateTypesController.showByHotel.bind(rateTypesController))
        router.get('/stay/view', rateTypesController.getRatesByHotelId.bind(rateTypesController))
        router.get('/:roomTypeId/rates', rateTypesController.getRatesByHotelIdAndRoomType.bind(rateTypesController))
        // Get rate type details for a specific hotel
        router.get('/roomType/:id', rateTypesController.getByRoomType.bind(rateTypesController)) // Get rate type details for a specific hotel
        router.put('/:id', rateTypesController.update.bind(rateTypesController)) // Update rate type information
        router.delete('/:id', rateTypesController.destroy.bind(rateTypesController)) // Soft delete rate type
        router.patch('/:id/restore', rateTypesController.restore.bind(rateTypesController)) // Restore soft-deleted rate type

        // Rate type analytics
        router.get('/stats', rateTypesController.stats.bind(rateTypesController)) // Get rate type statistics
      })
      .prefix('configuration/hotels/:hotelId/rate_types')

    // Season Management Routes
    // Define seasons for rate management based on time periods
    router
      .group(() => {
        // Basic CRUD operations for seasons
        router.get('/', seasonsController.index.bind(seasonsController)) // Get all seasons with filtering
        router.post('/', seasonsController.store.bind(seasonsController)) // Create a new season
        router.get('/:id', seasonsController.show.bind(seasonsController)) // Get specific season details
        router.put('/:id', seasonsController.update.bind(seasonsController)) // Update season information
        router.delete('/:id', seasonsController.destroy.bind(seasonsController)) // Soft delete season
        router.patch('/:id/restore', seasonsController.restore.bind(seasonsController)) // Restore soft-deleted season

        // Season analytics
        router.get('/stats', seasonsController.stats.bind(seasonsController)) // Get season statistics
      })
      .prefix('configuration/hotels/:hotelId/seasons')

    // Room Management Routes
    // Individual room management and status tracking
    router
      .group(() => {
        // Basic CRUD operations for rooms
        router.get('/', roomsController.index.bind(roomsController)) // Get all rooms with filtering and status
        router.post('/', roomsController.store.bind(roomsController)) // Create a new room
        router.post('/bulk-update', roomsController.bulkUpdate.bind(roomsController))
        router.get('/:id', roomsController.show.bind(roomsController)) // Get specific room details
        router.put('/:id', roomsController.update.bind(roomsController)) // Update room information
        router.delete('/:id', roomsController.destroy.bind(roomsController)) // Delete room
        router.get('/views/details', roomsController.getRoomsWithDetails.bind(roomsController)) // Delete room
        router.get('/house/view', roomsController.getHouseStatus.bind(roomsController))
        router.get('/recent/Booking', roomsController.getRecentBookings.bind(roomsController))


        // Room status management
        router.patch('/:id/status', roomsController.updateStatus.bind(roomsController)) // Update room status (available, occupied, maintenance, etc.)
        router.patch('/:id/housekeeping', roomsController.updateHousekeepingStatus.bind(roomsController)) // Update housekeeping status
        router.patch('/:id/maintenance', roomsController.updateMaintenanceStatus.bind(roomsController)) // Update maintenance status

        // Room analytics and reports
        router.get('/stats', roomsController.stats.bind(roomsController)) // Get room statistics
        router.get('/:id/availability', roomsController.availability.bind(roomsController)) // Get room availability for date range
        router.get('/available-by-room-type/:roomTypeId', roomsController.getAvailableRoomsByRoomTypeId.bind(roomsController)) // Get available rooms by room type ID
        router.get('/roomByType/:roomTypeId', roomsController.getRoomByRoomTypeId.bind(roomsController)) // Get available rooms by room type ID
      })
      .prefix('configuration/hotels/:hotelId/rooms')

    // Room Rate Management Routes
    // Room rate configuration and pricing management
    router
      .group(() => {
        // Basic CRUD operations for room rates
        router.get('/', roomRatesController.index.bind(roomRatesController)) // Get all room rates with filtering
        router.post('/', roomRatesController.store.bind(roomRatesController)) // Create a new room rate
        router.get('/base-rate', roomRatesController.getBaseRateByRoomAndRateType.bind(roomRatesController)) // Get base rate
        router.get('/:id', roomRatesController.show.bind(roomRatesController)).where('id', /^[0-9]+$/) // Get specific room rate details (numeric ID only to avoid conflicts)
        router.put('/:id', roomRatesController.update.bind(roomRatesController)) // Update room rate information
        router.delete('/:id', roomRatesController.destroy.bind(roomRatesController)) // Delete room rate

        // Room rate operations
        router.get('/date-range', roomRatesController.getByDateRange.bind(roomRatesController)) // Get room rates by date range

        router.get('/statistics', roomRatesController.stats.bind(roomRatesController)) // Get room rate statistics
      })
      .prefix('configuration/hotels/:hotelId/room_rates')

    // Folio Management Routes
    // Guest billing and financial management
    router
      .group(() => {
        // Basic CRUD operations for folios
        router.get('/', foliosController.index.bind(foliosController)) // Get all folios with filtering
        router.post('/', foliosController.store.bind(foliosController)) // Create a new folio
        router.get('/:id', foliosController.show.bind(foliosController)) // Get specific folio details with transactions
        router.put('/:id', foliosController.update.bind(foliosController)) // Update folio information
        router.delete('/:id', foliosController.destroy.bind(foliosController)) // Delete folio

        // Folio operations
        router.post('/:id/close', foliosController.close.bind(foliosController)) // Close folio for checkout
        router.post('/:id/reopen', foliosController.reopen.bind(foliosController)) // Reopen closed folio
        router.post('/:id/transfer', foliosController.transfer.bind(foliosController)) // Transfer charges between folios
        router.post('/split', foliosController.split.bind(foliosController)) // Split folio by transferring transactions
        router.post('/split-by-type', foliosController.splitByType.bind(foliosController)) // Split folio by transaction types
        router.post('/cut', foliosController.cut.bind(foliosController)) // Cut folio by creating new folio and transferring transactions by type

        // New service-based operations
        router.post('/transactions', foliosController.postTransaction.bind(foliosController)) // Post transaction to folio
        router.put('/transactions/:id', foliosController.updateTransaction.bind(foliosController)) // Post transaction to folio
        router.post('/settle', foliosController.settle.bind(foliosController)) // Settle folio payment
        router.post('/transfer-charges', foliosController.transferCharges.bind(foliosController)) // Transfer charges between folios
        router.post('/:id/close-service', foliosController.closeWithService.bind(foliosController)) // Close folio using service
        router.post('/:id/reopen-service', foliosController.reopenWithService.bind(foliosController)) // Reopen folio using service
        router.get('/:id/statement-service', foliosController.statementWithService.bind(foliosController)) // Get folio statement using service

        // Reservation and walk-in folio creation
        router.post('/reservation', foliosController.createForReservation.bind(foliosController)) // Create folio for reservation
        router.post('/walk-in', foliosController.createForWalkIn.bind(foliosController)) // Create folio for walk-in guest
        router.post('/group', foliosController.createForGroup.bind(foliosController)) // Create folios for group reservation
        router.post('/post-room-charges', foliosController.postRoomCharges.bind(foliosController)) // Auto-post room charges
        router.post('/post-taxes-fees', foliosController.postTaxesAndFees.bind(foliosController)) // Auto-post taxes and fees
        router.post('/room-charge/add', foliosController.addRoomCharge.bind(foliosController)) // Add room charge to folio
        router.put('/room-charge/:id', foliosController.updateRoomCharge.bind(foliosController)) // Add room charge to folio
        router.post('/adjustment/add', foliosController.addAdjustment.bind(foliosController)) // Add folio adjustment
        router.put('/adjustment/:id', foliosController.updateAdjustment.bind(foliosController)) // Add folio adjustment
        router.post('/apply/discount', foliosController.applyDiscount.bind(foliosController)) // Apply discount to folio
        router.put('/update/discount/:id', foliosController.updateDiscount.bind(foliosController)) // Apply discount to folio
        router.get('/reservation/:reservationId', foliosController.getReservationFolios.bind(foliosController)) // Get all folios for reservation

        // Checkout and settlement
        router.get('/:id/settlement-summary', foliosController.getSettlementSummary.bind(foliosController)) // Get settlement summary
        router.get('/:id/checkout-summary', foliosController.getCheckoutSummary.bind(foliosController)) // Get checkout summary
        router.post('/checkout', foliosController.processCheckout.bind(foliosController)) // Process folio checkout
        router.post('/reservation-checkout', foliosController.processReservationCheckout.bind(foliosController)) // Process reservation checkout
        router.post('/force-close', foliosController.forceCloseFolio.bind(foliosController)) // Force close folio
        router.get('/:id/validate-checkout', foliosController.validateCheckout.bind(foliosController)) // Validate checkout eligibility

        // Folio inquiry and review
        router.get('/:id/guest-view', foliosController.getGuestView.bind(foliosController)) // Get guest folio view (limited)
        router.get('/:id/staff-view', foliosController.getStaffView.bind(foliosController)) // Get staff folio view (comprehensive)
        router.get('/search/details', foliosController.search.bind(foliosController)) // Search folios with filters
        router.get('/comprehensive/search', foliosController.comprehensiveSearch.bind(foliosController)) // Comprehensive folio search with text search
        router.get('/transactions/search', foliosController.searchTransactions.bind(foliosController)) // Search transactions
        router.get('/:id/timeline', foliosController.getTimeline.bind(foliosController)) // Get folio activity timeline
        router.get('/statistics-advanced', foliosController.getStatistics.bind(foliosController)) // Get advanced folio statistics

        // Folio reports
        router.get('/:id/balance', foliosController.balance.bind(foliosController)) // Get folio balance
        router.get('/:id/statement', foliosController.statement.bind(foliosController)) // Get folio statement
        router.get('/statistics', foliosController.stats.bind(foliosController)) // Get folio statistics
        router.get('/unsettled/:id', foliosController.unsettled.bind(foliosController)) // Get unsettled folios
      })
      .prefix('folios')

    // Folio Print Management Routes
    // Generate folio print data and PDF invoices
    router
      .group(() => {
        // Generate folio print data with tax invoices
        router.post('/print-data', folioPrintController.printFolio.bind(folioPrintController)) // Generate folio print data
        router.post('/print-pdf', folioPrintController.printFolioPdf.bind(folioPrintController)) // Generate folio PDF (future implementation)
        router.post('/print_confirm_booking-pdf', folioPrintController.printBookingPdf.bind(folioPrintController)) // Generate invoice PDF
        router.post('/print_hotel-pdf', folioPrintController.printHotelPdf.bind(folioPrintController))
      })
      .prefix('folio-print')

    // Folio Transaction Management Routes
    // Individual transaction management and tracking
    router
      .group(() => {
        // Basic CRUD operations for folio transactions
        router.get('/', folioTransactionsController.index.bind(folioTransactionsController)) // Get all transactions with filtering
        router.post('/', folioTransactionsController.store.bind(folioTransactionsController)) // Create a new transaction
        router.get('/:id', folioTransactionsController.show.bind(folioTransactionsController)) // Get specific transaction details
        router.put('/:id', folioTransactionsController.update.bind(folioTransactionsController)) // Update transaction
        router.delete('/:id', folioTransactionsController.destroy.bind(folioTransactionsController)) // Delete transaction

        // Transaction operations
        router.post('/:id/void', folioTransactionsController.void.bind(folioTransactionsController)) // Void a transaction
        router.post('/:id/refund', folioTransactionsController.refund.bind(folioTransactionsController)) // Refund a transaction

        // Transaction reports
        router.get('/statistics', folioTransactionsController.stats.bind(folioTransactionsController)) // Get transaction statistics
      })
      .prefix('folio-transactions')



    // Reservation Room Management Routes
    // Room assignment and reservation management
    router
      .group(() => {
        // Basic CRUD operations for reservation rooms
        router.get('/', reservationRoomsController.index.bind(reservationRoomsController)) // Get all reservation rooms
        router.post('/', reservationRoomsController.store.bind(reservationRoomsController)) // Create a new reservation room assignment
        router.get('/:id', reservationRoomsController.show.bind(reservationRoomsController)) // Get specific reservation room details
        router.put('/:id', reservationRoomsController.update.bind(reservationRoomsController)) // Update reservation room
        router.delete('/:id', reservationRoomsController.destroy.bind(reservationRoomsController)) // Delete reservation room

        // Room assignment operations
        router.post('/:id/check-in', reservationRoomsController.checkIn.bind(reservationRoomsController)) // Check in guest to room
        router.post('/:id/check-out', reservationRoomsController.checkOut.bind(reservationRoomsController)) // Check out guest from room

        // Room analytics
        router.get('/statistics', reservationRoomsController.stats.bind(reservationRoomsController)) // Get reservation room statistics
      })
      .prefix('reservation-rooms')

    // Lost and Found Management Routes
    // Lost and found items management
    router
      .group(() => {
        // Basic CRUD operations for lost and found items
        router.get('/', lostFoundController.index.bind(lostFoundController)) // Get all lost and found items with filtering
        router.post('/', lostFoundController.store.bind(lostFoundController)) // Create a new lost and found item
        router.get('/:id', lostFoundController.show.bind(lostFoundController)) // Get specific lost and found item details
        router.put('/:id', lostFoundController.update.bind(lostFoundController)) // Update lost and found item
        router.delete('/:id', lostFoundController.destroy.bind(lostFoundController)) // Delete lost and found item

        // Status management operations
        router.post('/:id/mark-found', lostFoundController.markAsFound.bind(lostFoundController)) // Mark item as found
        router.post('/:id/mark-returned', lostFoundController.markAsReturned.bind(lostFoundController)) // Mark item as returned

        // Filtering and search operations
        router.get('/status/:status', lostFoundController.getByStatus.bind(lostFoundController)) // Get items by status
        router.get('/room/:roomId', lostFoundController.getByRoom.bind(lostFoundController)) // Get items by room
        router.get('/search/complainant', lostFoundController.searchByComplainant.bind(lostFoundController)) // Search by complainant

        // Statistics and reports
        router.get('/statistics', lostFoundController.getStatistics.bind(lostFoundController)) // Get lost and found statistics
        router.get('/recent', lostFoundController.getRecentItems.bind(lostFoundController)) // Get recent items
      })
      .prefix('lost-found')


    //Reservation Routes
    router
      .group(() => {
        router.post('/create', [ReservationsController, 'saveReservation']) // Create a new reservation
        router.get('/:reservationId/details', [ReservationsController, 'getReservationDetails'])

        // Reservation Action Routes
        router.post('/:reservationId/checkin', [ReservationsController, 'checkIn'])
        router.post('/:reservationId/payment', [ReservationsController, 'addPayment'])
        router.put('/:reservationId/amend-stay', [ReservationsController, 'amendStay'])
        router.patch('/:id/update_status', [ReservationsController, 'update'])
        router.put('/:reservationId/booking-detail', [ReservationsController, 'updateBookingDetails'])
        router.post('/:reservationId/room-move', [ReservationsController, 'roomMove'])
        router.post('/:reservationId/exchange-room', [ReservationsController, 'exchangeRoom'])
        router.post('/:reservationId/stop-room-move', [ReservationsController, 'stopRoomMove'])
        router.get('/:reservationId/inclusion-list', [ReservationsController, 'getInclusionList'])
        router.post('/:reservationId/cancel', [ReservationsController, 'cancelReservation'])
        router.post('/:reservationId/no-show', [ReservationsController, 'markNoShow'])
        router.post('/:reservationId/void', [ReservationsController, 'voidReservation'])
        router.post('/:reservationId/unassign-room', [ReservationsController, 'unassignRoom'])
        router.post('/:reservationId/assign-room', [ReservationsController, 'assignRoom'])
        router.put('/:reservationId/stop-move', [ReservationsController, 'updateStopMove'])
        router.get('/:reservationId/room-charges', [ReservationsController, 'getRoomCharges'])
        router.post('/:reservationId/check-out', [ReservationsController, 'checkOut'])
        router.post('/print-guest-card', [ReservationsController, 'printGuestCard'])


        // Get released reservations by date for a hotel
        router.get('/hotel/:hotelId/released', [ReservationsController, 'getReleasedReservationsByDate'])

      })
      .prefix('reservation')
      router.get('configuration/hotels/:hotelId/reservation/filter_reservations', reservationsController.filterReservations.bind(reservationsController))

    // Configuration routes
    router
      .group(() => {
        // Configuration data endpoint
        router.get('/permissions', configurationController.getConfiguration.bind(configurationController)) // Get configuration data (privileges, reports, discounts)

        // Amenities routes
        router
          .group(() => {
            router.get('/', [() => import('#controllers/amenities_controller'), 'index'])
            router.post('/', [() => import('#controllers/amenities_controller'), 'store'])
            router.get('/:id', [() => import('#controllers/amenities_controller'), 'show'])
            router.put('/:id', [() => import('#controllers/amenities_controller'), 'update'])
            router.delete('/:id', [() => import('#controllers/amenities_controller'), 'destroy'])
            router.post('/:id/restore', [() => import('#controllers/amenities_controller'), 'restore'])
            router.delete('/:id/force', [() => import('#controllers/amenities_controller'), 'forceDelete'])
            router.get('/hotel/:hotel_id', [() => import('#controllers/amenities_controller'), 'getByHotel'])
            router.post('/sort-order', [() => import('#controllers/amenities_controller'), 'updateSortOrder'])
          })
          .prefix('amenities')

        // Room Owner Management Routes
        // Complete room owner management for condominiums and apartments
        router
          .group(() => {
            // Basic CRUD operations for room owners
            router.get('/', roomOwnersController.index.bind(roomOwnersController)) // Get all room owners with pagination, search, and filtering
            router.post('/', roomOwnersController.store.bind(roomOwnersController)) // Create a new room owner
            router.get('/:id', roomOwnersController.show.bind(roomOwnersController)) // Get specific room owner details with room assignments
            router.put('/:id', roomOwnersController.update.bind(roomOwnersController)) // Update room owner information
            router.delete('/:id', roomOwnersController.destroy.bind(roomOwnersController)) // Soft delete room owner
            router.patch('/:id/restore', roomOwnersController.restore.bind(roomOwnersController)) // Restore soft-deleted room owner

            // Room assignment operations
            router.post('/:id/assign-rooms', roomOwnersController.assignRooms.bind(roomOwnersController)) // Assign rooms to room owner
            router.delete('/:id/unassign-rooms', roomOwnersController.unassignRooms.bind(roomOwnersController)) // Remove room assignments
            router.get('/available-rooms', roomOwnersController.getAvailableRooms.bind(roomOwnersController)) // Get available rooms for assignment

            // Room owner analytics
            router.get('/statistics', roomOwnersController.stats.bind(roomOwnersController)) // Get room owner statistics
          })
          .prefix('room-owners')



        // Currency Management Routes
        // Currency configuration and exchange rate management
        router
          .group(() => {
            // Basic CRUD operations for currencies
            router.get('/', currenciesController.index.bind(currenciesController)) // Get all currencies with filtering by hotel
            router.post('/', currenciesController.store.bind(currenciesController)) // Create a new currency
            router.get('/:id', currenciesController.show.bind(currenciesController)) // Get specific currency details
            router.put('/:id', currenciesController.update.bind(currenciesController)) // Update currency information (only if editable)
            router.delete('/:id', currenciesController.destroy.bind(currenciesController)) // Soft delete currency (only if editable)
          })
          .prefix('currencies')

        // Payment Method Management Routes
        // Payment method configuration and processing
        router
          .group(() => {
            // Basic CRUD operations for payment methods
            router.get('/', paymentMethodsController.index.bind(paymentMethodsController)) // Get all payment methods
            router.post('/', paymentMethodsController.store.bind(paymentMethodsController)) // Create a new payment method
            router.get('/:id', paymentMethodsController.show.bind(paymentMethodsController)) // Get specific payment method details
            router.put('/:id', paymentMethodsController.update.bind(paymentMethodsController)) // Update payment method
            router.delete('/:id', paymentMethodsController.destroy.bind(paymentMethodsController)) // Delete payment method

            // Payment method operations
            router.patch('/:id/toggle-status', paymentMethodsController.toggleStatus.bind(paymentMethodsController)) // Enable/disable payment method

            // Payment method analytics
            router.get('/statistics', paymentMethodsController.stats.bind(paymentMethodsController)) // Get payment method statistics
          })
          .prefix('payment_methods')

        // Identity Type Management Routes
        // Identity type configuration for guest identification
        router
          .group(() => {
            // Basic CRUD operations for identity types
            router.get('/', identityTypesController.index.bind(identityTypesController)) // Get all identity types with filtering by hotel
            router.post('/', identityTypesController.store.bind(identityTypesController)) // Create a new identity type
            router.get('/:id', identityTypesController.show.bind(identityTypesController)) // Get specific identity type details
            router.put('/:id', identityTypesController.update.bind(identityTypesController)) // Update identity type information
            router.delete('/:id', identityTypesController.destroy.bind(identityTypesController)) // Delete identity type
          })
          .prefix('identity_types')

        // Email Account Management Routes
        // Email account configuration for hotel communications
        router
          .group(() => {
            // Basic CRUD operations for email accounts
            router.get('/', emailAccountsController.index.bind(emailAccountsController)) // Get all email accounts with pagination
            router.post('/', emailAccountsController.store.bind(emailAccountsController)) // Create a new email account
            router.get('/active', emailAccountsController.getActive.bind(emailAccountsController)) // Get active email accounts for hotel
            router.get('/:id', emailAccountsController.show.bind(emailAccountsController)) // Get specific email account details
            router.put('/:id', emailAccountsController.update.bind(emailAccountsController)) // Update email account information
            router.delete('/:id', emailAccountsController.destroy.bind(emailAccountsController)) // Delete email account
            router.patch('/:id/toggle-active', emailAccountsController.toggleActive.bind(emailAccountsController)) // Toggle active status
          })
          .prefix('email-accounts')

        // Email Template Management Routes
        // Email template configuration for automated hotel communications
        router
          .group(() => {
            // Basic CRUD operations for email templates
            router.get('/', emailTemplateController.list.bind(emailTemplateController)) // Get all email templates with pagination
            router.post('/', emailTemplateController.create.bind(emailTemplateController)) // Create a new email template
            router.get('/:id', emailTemplateController.fetch.bind(emailTemplateController)) // Get specific email template details
            router.put('/:id', emailTemplateController.update.bind(emailTemplateController)) // Update email template information
            router.delete('/:id', emailTemplateController.delete.bind(emailTemplateController)) // Soft delete email template
            router.patch('/:id/restore', emailTemplateController.restore.bind(emailTemplateController)) // Restore soft deleted email template

            // Filter operations for email templates
            router.get('/by-auto-send', emailTemplateController.getByAutoSendType.bind(emailTemplateController)) // Get templates by auto send type
            router.get('/by-category', emailTemplateController.getByTemplateCategory.bind(emailTemplateController)) // Get templates by category
            router.get('/by-email-account', emailTemplateController.getByEmailAccount.bind(emailTemplateController)) // Get templates by email account
          })
          .prefix('email-templates')
        // Reason Management Routes
        // Reason configuration for various hotel operations
        router
          .group(() => {
            // Basic CRUD operations for reasons
            router.get('/', reasonsController.index.bind(reasonsController)) // Get all reasons with filtering by hotel and category
            router.post('/', reasonsController.store.bind(reasonsController)) // Create a new reason
            router.get('/:id', reasonsController.show.bind(reasonsController)) // Get specific reason details
            router.put('/:id', reasonsController.update.bind(reasonsController)) // Update reason information
            router.delete('/:id', reasonsController.destroy.bind(reasonsController)) // Soft delete reason

            // Reason operations
            router.get('/category/:category', reasonsController.getByCategory.bind(reasonsController)) // Get reasons by category
            router.get('/:category', reasonsController.getReasonsByHotelAndCategory.bind(reasonsController)) // Get reasons by category
            router.get('/categories/list', reasonsController.getCategories.bind(reasonsController)) // Get all available categories
            router.get('/status/:status', reasonsController.getByStatus.bind(reasonsController)) // Get reasons by status
          })
          .prefix('reasons')

        // Discount Management Routes
        // Discount configuration for hotel pricing
        router
          .group(() => {
            // Basic CRUD operations for discounts
            router.get('/', discountsController.index.bind(discountsController)) // Get all discounts with filtering by hotel
            router.post('/', discountsController.store.bind(discountsController)) // Create a new discount
            router.get('/:id', discountsController.show.bind(discountsController)) // Get specific discount details
            router.put('/:id', discountsController.update.bind(discountsController)) // Update discount information
            router.delete('/:id', discountsController.destroy.bind(discountsController)) // Soft delete discount

            // Discount operations
            router.get('/type/:type', discountsController.getByType.bind(discountsController)) // Get discounts by type
            router.get('/status/:status', discountsController.getByStatus.bind(discountsController)) // Get discounts by status
            router.get('/types/list', discountsController.getTypes.bind(discountsController)) // Get all available discount types
            router.get('/apply-on/list', discountsController.getApplyOnOptions.bind(discountsController)) // Get all apply-on options
          })
          .prefix('discounts')

        // Transportation Modes management routes
        router
          .group(() => {
            // Basic CRUD operations for transportation modes
            router.get('/', transportationModesController.index.bind(transportationModesController)) // Get all transportation modes with filtering by hotel
            router.post('/', transportationModesController.store.bind(transportationModesController)) // Create a new transportation mode
            router.get('/:id', transportationModesController.show.bind(transportationModesController)) // Get specific transportation mode details
            router.put('/:id', transportationModesController.update.bind(transportationModesController)) // Update transportation mode information
            router.delete('/:id', transportationModesController.destroy.bind(transportationModesController)) // Soft delete transportation mode
          })
          .prefix('transportation_modes')


        // Template Categories management routes
        router
          .group(() => {
            // Basic CRUD operations for template categories
            router.get('/', templateCategoriesController.index.bind(templateCategoriesController)) // Get all template categories with filtering by hotel
            router.post('/', templateCategoriesController.store.bind(templateCategoriesController)) // Create a new template category
            router.get('/:id', templateCategoriesController.show.bind(templateCategoriesController)) // Get specific template category details
            router.put('/:id', templateCategoriesController.update.bind(templateCategoriesController)) // Update template category information
            router.delete('/:id', templateCategoriesController.destroy.bind(templateCategoriesController)) // Soft delete template category
          })
          .prefix('template_categories')

        // Black List Reasons management routes
        router
          .group(() => {
            // Basic CRUD operations for black list reasons
            router.get('/', blackListReasonsController.index.bind(blackListReasonsController)) // Get all black list reasons with filtering by hotel and category
            router.post('/', blackListReasonsController.store.bind(blackListReasonsController)) // Create a new black list reason
            router.get('/:id', blackListReasonsController.show.bind(blackListReasonsController)) // Get specific black list reason details
            router.put('/:id', blackListReasonsController.update.bind(blackListReasonsController)) // Update black list reason information
            router.delete('/:id', blackListReasonsController.destroy.bind(blackListReasonsController)) // Soft delete black list reason
          })
          .prefix('black_list_reasons')

        // VIP Status Management Routes
        // VIP status configuration for guest classification
        router
          .group(() => {
            // Basic CRUD operations for VIP statuses
            router.get('/', vipStatusController.index.bind(vipStatusController)) // Get all VIP statuses with filtering by hotel
            router.post('/', vipStatusController.store.bind(vipStatusController)) // Create a new VIP status
            router.get('/:id', vipStatusController.show.bind(vipStatusController)) // Get specific VIP status details
            router.put('/:id', vipStatusController.update.bind(vipStatusController)) // Update VIP status information
            router.delete('/:id', vipStatusController.destroy.bind(vipStatusController)) // Delete VIP status
          })
          .prefix('vip_statuses')

        // Market Codes management routes
        router
          .group(() => {
            // Basic CRUD operations for market codes
            router.get('/', marketCodesController.index.bind(marketCodesController)) // Get all market codes with filtering by hotel
            router.post('/', marketCodesController.store.bind(marketCodesController)) // Create a new market code
            router.get('/:id', marketCodesController.show.bind(marketCodesController)) // Get specific market code details
            router.put('/:id', marketCodesController.update.bind(marketCodesController)) // Update market code information
            router.delete('/:id', marketCodesController.destroy.bind(marketCodesController)) // Soft delete market code
          })
          .prefix('market_codes')

        // Reservation Types management routes
        router
          .group(() => {
            // Basic CRUD operations for reservation types
            router.get('/', reservationTypesController.index.bind(reservationTypesController)) // Get all reservation types with filtering by hotel
            router.post('/', reservationTypesController.store.bind(reservationTypesController)) // Create a new reservation type
            router.get('/:id', reservationTypesController.show.bind(reservationTypesController)) // Get specific reservation type details
            router.put('/:id', reservationTypesController.update.bind(reservationTypesController)) // Update reservation type information
            router.delete('/:id', reservationTypesController.destroy.bind(reservationTypesController)) // Soft delete reservation type
          })
          .prefix('reservation_types')

        // Preference Types management routes
        router
          .group(() => {
            // Basic CRUD operations for preference types
            router.get('/', preferenceTypesController.index.bind(preferenceTypesController)) // Get all preference types with filtering by hotel
            router.post('/', preferenceTypesController.store.bind(preferenceTypesController)) // Create a new preference type
            router.get('/:id', preferenceTypesController.show.bind(preferenceTypesController)) // Get specific preference type details
            router.put('/:id', preferenceTypesController.update.bind(preferenceTypesController)) // Update preference type information
            router.delete('/:id', preferenceTypesController.destroy.bind(preferenceTypesController)) // Soft delete preference type
          })
          .prefix('preference_types')

        // Preferences management routes
        router
          .group(() => {
            // Basic CRUD operations for preferences
            router.get('/', preferencesController.index.bind(preferencesController)) // Get all preferences with filtering by hotel and preference type
            router.post('/', preferencesController.store.bind(preferencesController)) // Create a new preference
            router.get('/:id', preferencesController.show.bind(preferencesController)) // Get specific preference details
            router.put('/:id', preferencesController.update.bind(preferencesController)) // Update preference information
            router.delete('/:id', preferencesController.destroy.bind(preferencesController)) // Soft delete preference
          })
          .prefix('preferences')

        // Business Sources management routes
        router
          .group(() => {
            // Basic CRUD operations for business sources
            router.get('/', businessSourcesController.index.bind(businessSourcesController)) // Get all business sources with filtering by hotel
            router.post('/', businessSourcesController.store.bind(businessSourcesController)) // Create a new business source
            router.get('/:id', businessSourcesController.show.bind(businessSourcesController)) // Get specific business source details
            router.put('/:id', businessSourcesController.update.bind(businessSourcesController)) // Update business source information
            router.delete('/:id', businessSourcesController.destroy.bind(businessSourcesController)) // Soft delete business source
          })
          .prefix('business_sources')

        // Booking Sources management routes
        router
          .group(() => {
            // Basic CRUD operations for booking sources
            router.get('/', bookingSourcesController.index.bind(bookingSourcesController)) // Get all booking sources with filtering by hotel
            router.post('/', bookingSourcesController.store.bind(bookingSourcesController)) // Create a new booking source
            router.get('/:id', bookingSourcesController.show.bind(bookingSourcesController)) // Get specific booking source details
            router.put('/:id', bookingSourcesController.update.bind(bookingSourcesController)) // Update booking source information
            router.delete('/:id', bookingSourcesController.destroy.bind(bookingSourcesController)) // Soft delete booking source

            // Additional booking source operations
            router.get('/list', bookingSourcesController.list.bind(bookingSourcesController)) // Get all booking sources without pagination
            router.get('/hotel', bookingSourcesController.getByHotelId.bind(bookingSourcesController)) // Get booking sources by hotel ID
          })
          .prefix('booking_sources')

        // Company Accounts management routes
        router
          .group(() => {
            // Basic CRUD operations for company accounts
            router.get('/', [() => import('#controllers/company_accounts_controller'), 'index']) // Get all company accounts with filtering
            router.post('/', [() => import('#controllers/company_accounts_controller'), 'store']) // Create a new company account
            router.get('/:id', [() => import('#controllers/company_accounts_controller'), 'show']) // Get specific company account details
            router.put('/:id', [() => import('#controllers/company_accounts_controller'), 'update']) // Update company account information
            router.delete('/:id', [() => import('#controllers/company_accounts_controller'), 'destroy']) // Delete company account

            // Additional company account operations
            router.get('/hotel', [() => import('#controllers/company_accounts_controller'), 'getByHotel']) // Get company accounts by hotel
            router.get('/active', [() => import('#controllers/company_accounts_controller'), 'getActive']) // Get active company accounts
            router.get('/city_ledger', [() => import('#controllers/company_accounts_controller'), 'getCityLedger']) // Get city ledger accounts for hotel (doNotCountAsCityLedger = false)
          })
          .prefix('company_accounts')

        // Payout Reason Management Routes
        // Payout reason configuration for expense tracking
        router
          .group(() => {
            // Basic CRUD operations for payout reasons
            router.get('/', payoutReasonsController.index.bind(payoutReasonsController)) // Get all payout reasons with filtering by hotel
            router.post('/', payoutReasonsController.store.bind(payoutReasonsController)) // Create a new payout reason
            router.get('/:id', payoutReasonsController.show.bind(payoutReasonsController)) // Get specific payout reason details
            router.put('/:id', payoutReasonsController.update.bind(payoutReasonsController)) // Update payout reason information
            router.delete('/:id', payoutReasonsController.destroy.bind(payoutReasonsController)) // Soft delete payout reason

            // Additional routes for payout reasons
            router.get('/status/:status', payoutReasonsController.getByStatus.bind(payoutReasonsController)) // Get payout reasons by status
          })
          .prefix('payout_reasons')

        // Extra Charges Management Routes
        // Extra charges configuration for additional services and fees
        router
          .group(() => {
            // Basic CRUD operations for extra charges
            router.get('/', extraChargesController.index.bind(extraChargesController)) // Get all extra charges with filtering by hotel
            router.post('/', extraChargesController.store.bind(extraChargesController)) // Create a new extra charge
            router.get('/:id', extraChargesController.show.bind(extraChargesController)) // Get specific extra charge details
            router.put('/:id', extraChargesController.update.bind(extraChargesController)) // Update extra charge information
            router.delete('/:id', extraChargesController.destroy.bind(extraChargesController)) // Soft delete extra charge

            // Additional routes for extra charges
            router.get('/hotel', extraChargesController.getByHotel.bind(extraChargesController)) // Get extra charges by hotel
            router.get('/web-published', extraChargesController.getWebPublished.bind(extraChargesController)) // Get web-published extra charges
          })
          .prefix('extra_charges')

        // Tax Rates management routes
        router
          .group(() => {
            // Basic CRUD operations for tax rates
            router.get('/', taxRatesController.index.bind(taxRatesController)) // Get all tax rates with filtering
            router.post('/', taxRatesController.store.bind(taxRatesController)) // Create a new tax rate
            router.get('/:id', taxRatesController.show.bind(taxRatesController)) // Get specific tax rate details
            router.put('/:id', taxRatesController.update.bind(taxRatesController)) // Update tax rate information
            router.delete('/:id', taxRatesController.destroy.bind(taxRatesController)) // Delete tax rate
          })
          .prefix('taxes')

        // Incidental Invoice Management Routes
        // Incidental invoice creation and management for extra charges
        router
          .group(() => {
            // Basic CRUD operations for incidental invoices
            router.get('/', incidentalInvoiceController.index.bind(incidentalInvoiceController)) // Get all incidental invoices with search and filtering
            router.post('/', incidentalInvoiceController.create.bind(incidentalInvoiceController)) // Create a new incidental invoice
            router.get('/statistics', incidentalInvoiceController.getStatistics.bind(incidentalInvoiceController)) // Get invoice statistics
            router.get('/:id', incidentalInvoiceController.show.bind(incidentalInvoiceController)) // Get specific incidental invoice details
            router.get('/invoice/:invoiceNumber', incidentalInvoiceController.getByInvoiceNumber.bind(incidentalInvoiceController)) // Get invoice by invoice number
            router.post('/:id/void', incidentalInvoiceController.void.bind(incidentalInvoiceController)) // Void an incidental invoice

            // PDF generation routes
            router.get('/:id/pdf/download', incidentalInvoiceController.downloadPdf.bind(incidentalInvoiceController)) // Download invoice PDF
            router.get('/:id/pdf/preview', incidentalInvoiceController.previewPdf.bind(incidentalInvoiceController)) // Preview invoice PDF
          })
          .prefix('incidental_invoices')

        // City Ledger Management Routes
        // City ledger payment transactions and totals for company accounts
        router
          .group(() => {
            router.get('/', cityLedgerController.index.bind(cityLedgerController)) // Get city ledger transactions with filtering
            router.get('/totals', cityLedgerController.totals.bind(cityLedgerController)) // Get city ledger totals only
          })
          .prefix('city_ledger')

        // Meal Plans Management Routes
        router
          .group(() => {
            // Basic CRUD operations for meal plans scoped to hotel
            router.get('/', mealPlansController.index.bind(mealPlansController))
            router.post('/', mealPlansController.store.bind(mealPlansController))
            router.get('/:id', mealPlansController.show.bind(mealPlansController))
            router.put('/:id', mealPlansController.update.bind(mealPlansController))
            router.delete('/:id', mealPlansController.destroy.bind(mealPlansController))
          })
          .prefix('meal_plans')

        // Company Folio Management Routes
        // Company folio creation, payment posting, and assignment management
        router
          .group(() => {
            router.get('/:companyId', companyFolioController.show.bind(companyFolioController)) // Get company folio with transactions
            router.post('/create', companyFolioController.createOrGet.bind(companyFolioController)) // Create or get company folio
            router.post('/payment', companyFolioController.postPayment.bind(companyFolioController)) // Post payment to company folio
            router.post('/payment-with-assignment', companyFolioController.postPaymentWithAssignment.bind(companyFolioController)) // Post payment with automatic assignment
            router.put('/assignment', companyFolioController.updateAssignment.bind(companyFolioController)) // Update payment assignment
            router.put('/bulk-assignment', companyFolioController.updateBulkAssignments.bind(companyFolioController)) // Update bulk payment assignments
            router.get('/:companyId/unassigned', companyFolioController.getUnassignedAmount.bind(companyFolioController)) // Get unassigned payment amount
          })
          .prefix('company_folios')
      })
      .prefix('configuration/hotels/:hotelId')

    //Demande de transport
    router.group(() => {
      router.post('/transportation-requests', transportRequestsController.store.bind(transportRequestsController))
      router.get('/transportation-requests', transportRequestsController.index.bind(transportRequestsController))
      router.get('/transportation-requests/:id', transportRequestsController.show.bind(transportRequestsController))
      router.put('/transportation-requests/:id', transportRequestsController.update.bind(transportRequestsController))
      router.patch('/transportation-requests/:id/status', transportRequestsController.updateStatus.bind(transportRequestsController))
      router.delete('/transportation-requests/:id', transportRequestsController.destroy.bind(transportRequestsController))
      router.get('/transportation-analytics', transportRequestsController.analytics.bind(transportRequestsController))
    })


    router
      .group(() => {
        // Custom route to get all policies for a specific hotel
        router.get(
          '/hotel/:hotelId',
          cancellationPoliciesController.showByHotel.bind(cancellationPoliciesController)
        )
        router.get('/:id', cancellationPoliciesController.show.bind(cancellationPoliciesController))
        router.post('/', cancellationPoliciesController.store.bind(cancellationPoliciesController))
        router.get('/', cancellationPoliciesController.index.bind(cancellationPoliciesController))
        router.put(
          '/:id',
          cancellationPoliciesController.update.bind(cancellationPoliciesController)
        )
        router.delete(
          '/:id',
          cancellationPoliciesController.destroy.bind(cancellationPoliciesController)
        )
      })
      .prefix('cancellation-policies')


    /// hotel router
    router.get(
      '/hotels/:id/reservation/search',
      reservationsController.searchReservations.bind(reservationsController)
    )
    router.get(
      '/reservations/:reservationId/details',
      reservationsController.getReservationDetails.bind(reservationsController)
    )

router.get('/reservations/:id', reservationsController.getReservationById.bind(reservationsController))
  router.put('/reservations/:id/update-details', reservationsController.updateReservationDetails.bind(reservationsController))
  router.post('/reservations/:id/apply-discount', reservationsController.applyRoomChargeDiscount.bind(reservationsController))

    //Payment Method routes
    router
      .group(() => {
        // get payment Method active for Hotel
        router.get('/:hotelId', [PaymentMethodsController, 'active'])
      })
      .prefix('/payment_method')

    // Room Blocks Routes
    router
      .group(() => {
        // Basic CRUD operations for room blocks
        router.get('/', roomBlocksController.index.bind(roomBlocksController)) // Get all room blocks with filtering
        router.get('/:hotelId', roomBlocksController.getByHotelId.bind(roomBlocksController)) // Get all room blocks with filtering
        router.post('/', roomBlocksController.store.bind(roomBlocksController)) // Create a new room block
        router.put('/:id', roomBlocksController.update.bind(roomBlocksController)) // Update room block information
        router.delete('/:id', roomBlocksController.destroy.bind(roomBlocksController)) // Delete room block
      })
      .prefix('room-blocks')

    // Night Audit Routes
    router
      .group(() => {
        // Calculate and store night audit data
        router.post('/', nightAuditController.calculateNightAudit.bind(nightAuditController)) // Calculate night audit for specific date

        // Get night audit details and history
        router.get('/:hotelId/:auditDate', nightAuditController.getNightAuditDetails.bind(nightAuditController)) // Get night audit details for specific date
        router.get('/:hotelId/history', nightAuditController.getNightAuditHistory.bind(nightAuditController)) // Get night audit history for date range
        router.get('/:hotelId/summary', nightAuditController.getNightAuditSummary.bind(nightAuditController)) // Get night audit summary statistics

        // Get room status for night audit
        router.get('/:hotelId/:auditDate/room-status', nightAuditController.getNightAuditRoomStatus.bind(nightAuditController)) // Get room status and required actions for night audit

        // Get unsettled folios for night audit
        router.get('/:hotelId/:auditDate/unsettled-folios', nightAuditController.getUnsettledFolios.bind(nightAuditController)) // Get unsettled folios requiring attention

        // Get pending nightly charges
        router.get('/:hotelId/:auditDate/nightly-charges', nightAuditController.getPendingNightlyCharges.bind(nightAuditController)) // Get unbilled charges for occupied rooms

        // Get pending reservations
        router.get('/:hotelId/:auditDate/pending-reservations', nightAuditController.getPendingReservations.bind(nightAuditController)) // Get reservations pending check-in for audit date

        // Post nightly charges
        router.post('/:hotelId/:auditDate/nightly-charges', nightAuditController.postNightlyCharges.bind(nightAuditController)) // Post nightly charges to occupied rooms

        // Delete night audit record
        router.delete('/:hotelId/:auditDate', nightAuditController.deleteNightAudit.bind(nightAuditController)) // Delete night audit record
      }).prefix('night-audit')

    // Channex Integration Routes
    // Hotel data migration to Channex.io system
    router
      .group(() => {
        // Migrate complete hotel data to Channex
        router.post('/migrate/:hotelId', channexMigrationController.migrateHotel.bind(channexMigrationController)) // Migrate hotel data to Channex

        // Get migration status
        router.get('/migration-status/:hotelId', channexMigrationController.getMigrationStatus.bind(channexMigrationController)) // Get migration status for hotel

        // IFrame Integration Routes
        // Generate one-time access token for Channex iframe
        router.post('/iframe/token', channexMigrationController.generateIframeToken.bind(channexMigrationController)) // Generate one-time token for iframe authentication

        // Generate iframe URL for channel mapping
        router.post('/iframe/url', channexMigrationController.generateIframeUrl.bind(channexMigrationController)) // Generate iframe URL with configuration parameters

        // Get hotel Channex information for iframe
        router.get('/iframe/hotel/:hotelId', channexMigrationController.getHotelChannexInfo.bind(channexMigrationController)) // Get Channex property info for hotel

        // Booking Revisions Feed
        router.get('/booking-revisions/feed', channexMigrationController.getBookingRevisionsFeed.bind(channexMigrationController)) // Fetch booking revisions from Channex and create reservations
        
        router.get('/booking', channexMigrationController.listBookings.bind(channexMigrationController))
        router.post('/sync/bookings/:hotelId', channexMigrationController.syncBookingsFromChannex.bind(channexMigrationController)
        )
      })
      .prefix('channex');

    /// audit trails
    router
      .group(() => {
        // Import reports routes
        router.get('/', auditTrailController.getAuditTrail.bind(auditTrailController))
      }).prefix('audit-trail')

    // Work Orders Management Routes
    // Work order creation, assignment, status tracking, and maintenance management
    router
      .group(() => {
        // Basic CRUD operations for work orders
        router.get('/', workOrdersController.index.bind(workOrdersController)) // Get all work orders with filtering
        router.post('/', workOrdersController.store.bind(workOrdersController)) // Create a new work order
        router.get('/:id', workOrdersController.show.bind(workOrdersController)) // Get specific work order details
        router.put('/:id', workOrdersController.update.bind(workOrdersController)) // Update work order information
        router.delete('/:id', workOrdersController.destroy.bind(workOrdersController)) // Delete work order

        // Work order status management
        router.put('/:id/status', workOrdersController.updateStatus.bind(workOrdersController)) // Update work order status with logging
        router.patch('/:id/assign', workOrdersController.assign.bind(workOrdersController)) // Assign work order to a user
      })
      .prefix('work_orders')

  })
  .prefix('/api')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

// Import reports routes
import './routes/reports.js'

// Import POS routes
import './routes/pos.js'

