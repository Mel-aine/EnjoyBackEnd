import router from '@adonisjs/core/services/router'
import UsersController from '#controllers/users_controller'
import RolesController from '#controllers/roles_controller'
import ReservationsController from '#controllers/reservations_controller'
import StockCategoriesController from '#controllers/stock_categories_controller'
import SuppliersController from '#controllers/suppliers_controller'
import ProductServicesController from '#controllers/product_services_controller'
import MouvementsController from '#controllers/mouvements_controller'
import DepartmentsController from '#controllers/departments_controller'
import ExpensesController from '#controllers/expenses_controller'
import AssigmentUsersController from '#controllers/assigment_users_controller'
import PermissionsController from '#controllers/permissions_controller'
import TasksController from '#controllers/tasks_controller'
import RolePermissionsController from '#controllers/role_permissions_controller'
import CancellationPoliciesController from '#controllers/cancellation_policies_controller'
import RefundsController from '#controllers/refunds_controller'
import HotelsController from '#controllers/hotels_controller'
import CurrenciesController from '#controllers/currencies_controller'
import GuestsController from '#controllers/guests_controller'
import RoomTypesController from '#controllers/room_types_controller'
import BedTypesController from '#controllers/bed_types_controller'
import RoomsController from '#controllers/rooms_controller'
import FoliosController from '#controllers/folios_controller'
import FolioTransactionsController from '#controllers/folio_transactions_controller'
import PaymentMethodsController from '#controllers/payment_methods_controller'
import IdentityTypesController from '#controllers/identity_types_controller'
import ReservationRoomsController from '#controllers/reservation_rooms_controller'
import RoomOwnersController from '#controllers/room_owners_controller'
import RoomRatesController from '#controllers/room_rates_controller'
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
import PayoutReasonsController from '#controllers/payout_reasons_controller'
import ExtraChargesController from '#controllers/extra_charges_controller'
import TaxRatesController from '#controllers/tax_rates_controller'
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'
import { middleware } from '#start/kernel'

// import { middleware } from '#start/kernel'
import ActivityLogsController from '#controllers/activity_logs_controller'
// import { middleware } from '#start/kernel'

// Import dynamique
const AuthController = () => import('#controllers/auth_controller')
const AmenitiesCategoriesController = () => import('#controllers/amenities_categories_controller')
import DashboardController from '#controllers/dasboard_controller'
import EmploymentContractsController from '#controllers/employment_contracts_controller'
import PayrollsController from '#controllers/payrolls_controller'
// Import dynamique
const dashboardController = new DashboardController()
const StaffDashboardsController = () => import('#controllers/staff_dashboards_controller')
const AmenityProductsController = () => import('#controllers/amenity_products_controller')

const AmenityPaymentsController = () => import('#controllers/amenity_payments_controller')
const AmenityBookingsController = () => import('#controllers/amenity_bookings_controller')
const usersController = new UsersController()
const employmentContractController = new EmploymentContractsController()
const payrollController = new PayrollsController()
const rolesController = new RolesController()
const stockCategoriesController = new StockCategoriesController()
const suppliersController = new SuppliersController()
const productServicesController = new ProductServicesController()
const mouvementsController = new MouvementsController()
const departmentsController = new DepartmentsController()
const expensesController = new ExpensesController()
const assigmentUsersController = new AssigmentUsersController()
const permissionsController = new PermissionsController()
const tasksController = new TasksController()
const rolePermissionsController = new RolePermissionsController()
const activityLogsController = new ActivityLogsController()
const cancellationPoliciesController = new CancellationPoliciesController()
const refundsController = new RefundsController()
const hotelsController = new HotelsController()
const currenciesController = new CurrenciesController()
const guestsController = new GuestsController()
const roomTypesController = new RoomTypesController()
const bedTypesController = new BedTypesController()
const roomsController = new RoomsController()
const foliosController = new FoliosController()
const folioTransactionsController = new FolioTransactionsController()
const paymentMethodsController = new PaymentMethodsController()
const identityTypesController = new IdentityTypesController()
const reservationRoomsController = new ReservationRoomsController()
const roomOwnersController = new RoomOwnersController()
const roomRatesController = new RoomRatesController()
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
const payoutReasonsController = new PayoutReasonsController()
const extraChargesController = new ExtraChargesController()
const taxRatesController = new TaxRatesController()
router.get('/swagger', async () => {
  return AutoSwagger.default.ui('/swagger/json', swagger)
})
router.get('/swagger/json', async ({ response }) => {
  const basicSpec = {
    swagger: '2.0',
    info: swagger.info,
    host: 'localhost:3333',
    basePath: '/',
    schemes: ['http'],
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
      }
    },
  }
  return response.json(basicSpec)
})
router.post('api/auth', [AuthController, 'login'])
router.post('api/authLogin', [AuthController, 'signin'])
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
      router.get('/users/:id', usersController.show.bind(usersController))
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

    router.group(() => {
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
    })
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
      router.get('/roles/:serviceId', rolesController.GetByServiceId.bind(rolesController))
      router.get(
        '/services/:serviceId/roles',
        rolesController.getRolesByService.bind(rolesController)
      )
      router.post('/roles', rolesController.store.bind(rolesController))
      router.put('/roles/:id', rolesController.update.bind(rolesController))
      router.delete('/roles/:id', rolesController.destroy.bind(rolesController))
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
      router.get(
        '/prooductService/:serviceId',
        productServicesController.GetByServiceId.bind(productServicesController)
      )
      router.post(
        '/prooductService',
        productServicesController.store.bind(productServicesController)
      )
      router.put(
        '/prooductService/:id',
        productServicesController.update.bind(productServicesController)
      )
      router.delete(
        '/prooductService/:id',
        productServicesController.destroy.bind(productServicesController)
      )
    })

    router.group(() => {
      router.get('/expenses/:serviceId', expensesController.GetByServiceId.bind(expensesController))
      router.post('/expenses', expensesController.store.bind(expensesController))
      router.put('/expenses/:id', expensesController.update.bind(expensesController))
      router.delete('/expenses/:id', expensesController.destroy.bind(expensesController))
    })

    router.group(() => {
      router.get(
        '/department/:serviceId',
        departmentsController.GetByServiceId.bind(departmentsController)
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

    // router.group(() => {
    //   router.post('/services', servicesController.store.bind(servicesController))

    //   router.get(
    //     '/servicesByCategory/:categoryId',
    //     servicesController.showByCategorie.bind(servicesController)
    //   )

    //   router.get('/services/:id', servicesController.show.bind(servicesController))
    //   router.patch('/services/:id', servicesController.update.bind(servicesController))
    //   router.delete('/services/:id', servicesController.destroy.bind(servicesController))
    //   router.get(
    //     '/services/customer/:serviceId',
    //     servicesController.customers.bind(servicesController)
    //   )
    //   router.get(
    //     '/servicesWithServiceProduct',
    //     servicesController.getServicesWithProductsAndOptions.bind(servicesController)
    //   )
    //   router.get(
    //     '/services/:id/reservation/search',
    //     reservationsController.searchReservations.bind(servicesController)
    //   )
    //   router.get(
    //     '/services/:serviceId/departments/:departmentId/details',
    //     departmentsController.getDepartmentDetails.bind(departmentsController)
    //   )
    // })

    // router.group(() => {
    //   router.post('/product', typeProductsController.store.bind(typeProductsController))
    //   router.get(
    //     '/product/:serviceId',
    //     typeProductsController.GetByServiceId.bind(typeProductsController)
    //   )
    //   router.get(
    //     '/type-products/room-count',
    //     typeProductsController.countRoomsByType.bind(typeProductsController)
    //   )
    //   router.put('/product/:id', typeProductsController.update.bind(typeProductsController))
    //   router.delete('/product/:id', typeProductsController.destroyed.bind(typeProductsController))
    // })

    // router.group(() => {
    //   router.post(
    //     '/service_product',
    //     serviceProductsController.store.bind(serviceProductsController)
    //   )
    //   router.get('/service_product', serviceProductsController.list.bind(serviceProductsController))
    //   router.post(
    //     '/service_product/:id/filter',
    //     serviceProductsController.filter.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service_product_options',
    //     serviceProductsController.getAllWithOptions.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service_product_option',
    //     serviceProductsController.getServiceProductAllWithOptions.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service_product/:id',
    //     serviceProductsController.show.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service_products/:id',
    //     serviceProductsController.showWithReservations.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service_product_by_date',
    //     serviceProductsController.getAvailable.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service_product_by_serviceId/:serviceId',
    //     serviceProductsController.showByServiceId.bind(serviceProductsController)
    //   )
    //   router.put(
    //     '/service_product/:id',
    //     serviceProductsController.update.bind(serviceProductsController)
    //   )
    //   router.delete(
    //     '/service_product/:id',
    //     serviceProductsController.destroyed.bind(serviceProductsController)
    //   )
    //   router.patch(
    //     '/service_product/update_status/:id',
    //     serviceProductsController.updateStatus.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service-products/available',
    //     serviceProductsController.findAvailableRooms.bind(serviceProductsController)
    //   )
    //   router.get(
    //     '/service-products/:serviceId/details',
    //     serviceProductsController.getServiceProductsWithDetails.bind(serviceProductsController)
    //   )
    // })

    // router.group(() => {
    //   router.get(
    //     '/reservations_by_id/:id',
    //     reservationsController.show.bind(reservationsController)
    //   )
    //   router.get(
    //     '/reservations/:serviceId',
    //     reservationsController.GetByServiceId.bind(reservationsController)
    //   )
    //   router.get(
    //     '/reservations/:reservationId/details',
    //     reservationsController.getReservationDetails.bind(reservationsController)
    //   )
    //   // .use(middleware.checkPermission(['bookings_read']))
    //   router.post('/reservations', reservationsController.store.bind(reservationsController))
    //   router.post(
    //     '/reservationswithuser',
    //     reservationsController.createWithUserAndReservation.bind(reservationsController)
    //   )
    //   router.put('/reservations/:id', reservationsController.update.bind(reservationsController))
    //   router.put(
    //     '/reservations_update/:id',
    //     reservationsController.updateReservation.bind(reservationsController)
    //   )
    //   router.delete(
    //     '/reservations/:id',
    //     reservationsController.destroy.bind(reservationsController)
    //   )
    //   router.patch(
    //     '/reservations/:id/check-in',
    //     reservationsController.checkIn.bind(reservationsController)
    //   )
    //   router.patch(
    //     '/reservations/:id/check-out',
    //     reservationsController.checkOut.bind(reservationsController)
    //   )
    //   router.patch(
    //     '/reservations/:id/extend',
    //     reservationsController.extendStay.bind(reservationsController)
    //   )
    //   router.get(
    //     '/reservations/service-product/:serviceProductId',
    //     reservationsController.showByServiceProductId.bind(reservationsController)
    //   )
    //   router.patch(
    //     '/reservations/:id/checkExtendStay',
    //     reservationsController.checkExtendStay.bind(reservationsController)
    //   )
    //   router.patch(
    //     '/reservations/:id/extendStay',
    //     reservationsController.extendStay.bind(reservationsController)
    //   )
    //   router.get(
    //     '/reservations/:id/cancellation-summary',
    //     reservationsController.getCancellationSummary.bind(reservationsController)
    //   )
    //   router.post(
    //     '/reservations/:id/cancel',
    //     reservationsController.cancelReservation.bind(reservationsController)
    //   )
    // })

    router.group(() => {
      router.get('/activity-logs', activityLogsController.index.bind(activityLogsController))
      router.post('/activity-logs', activityLogsController.store.bind(activityLogsController))
      router.get(
        '/activity-logs/user/:createdBy',
        activityLogsController.showByUser.bind(activityLogsController)
      )
      // This route must be before /:id to avoid 'by-entity' being treated as an id
      router.get(
        '/activity-logs/by-entity',
        activityLogsController.showByEntity.bind(activityLogsController)
      )
      router.get('/activity-logs/:id', activityLogsController.show.bind(activityLogsController))
      router.put('/activity-logs/:id', activityLogsController.update.bind(activityLogsController))
    })

    // router.group(() => {
    //   router.get(
    //     '/reservation_service',
    //     reservationServiceProductsController.list.bind(reservationServiceProductsController)
    //   )
    //   router.get(
    //     '/reservation_service/:reservationId',
    //     reservationServiceProductsController.showByResrvationId.bind(
    //       reservationServiceProductsController
    //     )
    //   )
    //   router.get(
    //     '/reservation_service_serviceId/:serviceId',
    //     reservationServiceProductsController.getRecentBookings.bind(
    //       reservationServiceProductsController
    //     )
    //   )
    //   router.get(
    //     '/reservation_service/:id',
    //     reservationServiceProductsController.show.bind(reservationServiceProductsController)
    //   )
    //   router.post(
    //     '/reservation_service',
    //     reservationServiceProductsController.store.bind(reservationServiceProductsController)
    //   )
    //   router.put(
    //     '/reservation_service/:id',
    //     reservationServiceProductsController.update.bind(reservationServiceProductsController)
    //   )
    //   router.delete(
    //     '/reservation_service/:id',
    //     reservationServiceProductsController.destroy.bind(reservationServiceProductsController)
    //   )
    // })



    // router.group(() => {
    //   router.get('/payment', paymentsController.list.bind(paymentsController))
    //   router.get('/payment/:id', paymentsController.show.bind(paymentsController))
    //   router.get('/payments/:serviceId', paymentsController.getAllPayment.bind(paymentsController))
    //   router.post('/payment', paymentsController.store.bind(paymentsController))
    //   router.post('/paymentConfirm', paymentsController.storePayment.bind(paymentsController))
    //   router.put('/payment/:id', paymentsController.update.bind(paymentsController))
    //   router.put('/payment/:id/confirm', paymentsController.confirmPayment.bind(paymentsController))
    //   router.delete('/payment/:id', paymentsController.destroy.bind(paymentsController))
    // })



    router
      .group(() => {
        router.get('/service/:serviceId', [AmenitiesCategoriesController, 'getByService'])
        router.get('/:id', [AmenitiesCategoriesController, 'show'])
        router.post('', [AmenitiesCategoriesController, 'store'])
        router.put('/:id', [AmenitiesCategoriesController, 'update'])
        router.delete('/:id', [AmenitiesCategoriesController, 'destroy'])
      })
      .prefix('amenities-categories')

    router.group(() => {
      router.get('/service/:serviceId/category/:categoryId', [AmenityProductsController, 'getByServiceAndCategory'])
      router.get('/service/:serviceId/search', [AmenityProductsController, 'searchByName'])
      router.get('/:id', [AmenityProductsController, 'show'])
      router.post('', [AmenityProductsController, 'store'])
      router.put('/:id', [AmenityProductsController, 'update'])
      router.delete('/:id', [AmenityProductsController, 'destroy'])
    }).prefix('amenity-products')

    router.resource('amenity-bookings', AmenityBookingsController).apiOnly()
    router.get(
      '/reservations/:reservationId/services/:serviceId/amenity-bookings',
      [AmenityBookingsController, 'getByReservationAndService']
    )
    router.get('/amenity-categories/:categoryId/amenity-bookings', [
      AmenityBookingsController,
      'getByAmenityCategory',
    ])
    router.get('/reservations/:reservationId/unpaid-amenities', [
      AmenityBookingsController,
      'getUnpaidByReservation',
    ])
    router.post('/reservations/:reservationId/pay-amenities', [
      AmenityPaymentsController,
      'payForAmenities',
    ])
    router.get('/reservations/:id/invoice', [ReservationsController, 'getHotelInvoiceData'])


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
      router.get(
        '/assigmentUser/:serviceId',
        assigmentUsersController.showByServiceId.bind(assigmentUsersController)
      )
      router.get(
        '/services/:serviceId/employees',
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
    //Refund routes
    router.group(() => {
      router.post('/refund', refundsController.store.bind(refundsController))
      router.get('/refund', refundsController.list.bind(refundsController))
      router.get(
        '/refund/:serviceId',
        refundsController.getRefundByServiceId.bind(refundsController)
      )
      router.post(
        '/refund/filter/:serviceId',
        refundsController.filterRefunds.bind(refundsController)
      )
      router.put('/refund/:id', refundsController.update.bind(refundsController))
      router.delete('/refund/:id', refundsController.destroy.bind(refundsController))
    })

    // Hotel Management Routes
    // Comprehensive hotel management system with CRUD operations and analytics
    router
      .group(() => {
        // Basic CRUD operations for hotels
        router.get('/', hotelsController.index.bind(hotelsController)) // Get all hotels with pagination and search
        router.post('/', hotelsController.store.bind(hotelsController)) // Create a new hotel
        router.get('/:id', hotelsController.show.bind(hotelsController)) // Get specific hotel details
        router.put('/:id', hotelsController.update.bind(hotelsController)) // Update hotel information
        router.put('/:id/information', hotelsController.updateHotelInformation.bind(hotelsController)) // Update complete hotel information
        router.put('/:id/notices', hotelsController.updateNotices.bind(hotelsController)) // Update hotel notices
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
        router.get('/', roomTypesController.index.bind(roomTypesController)) // Get all room types with filtering by hotel
        router.post('/', roomTypesController.store.bind(roomTypesController)) // Create a new room type
        router.get('/:id', roomTypesController.show.bind(roomTypesController)) // Get specific room type details
        router.get('/:id/hotel', roomTypesController.showByHotel.bind(roomTypesController)) // Get room type details for a specific hotel
        router.put('/:id', roomTypesController.update.bind(roomTypesController)) // Update room type information
        router.delete('/:id', roomTypesController.destroy.bind(roomTypesController)) // Soft delete room type
        router.patch('/:id/restore', roomTypesController.restore.bind(roomTypesController)) // Restore soft-deleted room type
        router.patch('/:id/toggle-status', roomTypesController.toggleStatus.bind(roomTypesController)) // Toggle publish to website status

        // Room type analytics
        router.get('/:id/stats', roomTypesController.stats.bind(roomTypesController)) // Get room type statistics
        router.get('/:id/availability', roomTypesController.availability.bind(roomTypesController)) // Check availability for date range

        // Sort order management
        router.patch('/sort-order', roomTypesController.updateSortOrder.bind(roomTypesController)) // Update sort order for multiple room types
      })
      .prefix('configuration/room_types')

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
      .prefix('configuration/bed_types')

    // Rate Type Management Routes
    // Rate type configuration and pricing management
    router
      .group(() => {
        // Basic CRUD operations for rate types
        router.get('/', rateTypesController.index.bind(rateTypesController)) // Get all rate types with filtering by hotel
        router.post('/', rateTypesController.store.bind(rateTypesController)) // Create a new rate type
        router.get('/:id', rateTypesController.show.bind(rateTypesController)) // Get specific rate type details
         router.get('/:id/hotel', rateTypesController.getByRoomType.bind(rateTypesController)) // Get rate type details for a specific hotel
        router.put('/:id', rateTypesController.update.bind(rateTypesController)) // Update rate type information
        router.delete('/:id', rateTypesController.destroy.bind(rateTypesController)) // Soft delete rate type
        router.patch('/:id/restore', rateTypesController.restore.bind(rateTypesController)) // Restore soft-deleted rate type

        // Rate type analytics
        router.get('/stats', rateTypesController.stats.bind(rateTypesController)) // Get rate type statistics
      })
      .prefix('configuration/rate_types')

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
      .prefix('configuration/seasons')

    // Room Management Routes
    // Individual room management and status tracking
    router
      .group(() => {
        // Basic CRUD operations for rooms
        router.get('/', roomsController.index.bind(roomsController)) // Get all rooms with filtering and status
        router.post('/', roomsController.store.bind(roomsController)) // Create a new room
        router.get('/:id', roomsController.show.bind(roomsController)) // Get specific room details
        router.put('/:id', roomsController.update.bind(roomsController)) // Update room information
        router.delete('/:id', roomsController.destroy.bind(roomsController)) // Delete room

        // Room status management
        router.patch('/:id/status', roomsController.updateStatus.bind(roomsController)) // Update room status (available, occupied, maintenance, etc.)
        router.patch('/:id/housekeeping', roomsController.updateHousekeepingStatus.bind(roomsController)) // Update housekeeping status
        router.patch('/:id/maintenance', roomsController.updateMaintenanceStatus.bind(roomsController)) // Update maintenance status

        // Room analytics and reports
        router.get('/stats', roomsController.stats.bind(roomsController)) // Get room statistics
        router.get('/:id/availability', roomsController.availability.bind(roomsController)) // Get room availability for date range
      })
      .prefix('configuration/rooms')

    // Room Rate Management Routes
    // Room rate configuration and pricing management
    router
      .group(() => {
        // Basic CRUD operations for room rates
        router.get('/', roomRatesController.index.bind(roomRatesController)) // Get all room rates with filtering
        router.post('/', roomRatesController.store.bind(roomRatesController)) // Create a new room rate
        router.get('/base-rate', roomRatesController.getBaseRateByRoomAndRateType.bind(roomRatesController)) // Get base rate
        router.get('/:id', roomRatesController.show.bind(roomRatesController)) // Get specific room rate details
        router.put('/:id', roomRatesController.update.bind(roomRatesController)) // Update room rate information
        router.delete('/:id', roomRatesController.destroy.bind(roomRatesController)) // Delete room rate

        // Room rate operations
        router.get('/date-range', roomRatesController.getByDateRange.bind(roomRatesController)) // Get room rates by date range

        router.get('/statistics', roomRatesController.stats.bind(roomRatesController)) // Get room rate statistics
      })
      .prefix('configuration/room_rates')

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
        router.post('/:id/transfer', foliosController.transfer.bind(foliosController)) // Transfer charges between folios

        // Folio reports
        router.get('/:id/balance', foliosController.balance.bind(foliosController)) // Get folio balance
        router.get('/statistics', foliosController.stats.bind(foliosController)) // Get folio statistics
      })
      .prefix('folios')

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


      //Reservation Routes
    router
      .group(() => {
        router.post('/create', [ReservationsController, 'saveReservation']) // Create a new reservation
        router.get('/:id/customer',[ReservationsController, 'getGuestsByHotel'])//get guest
        router.get('/:reservationId/details',[ReservationsController, 'getReservationDetails'])
      })
      .prefix('reservation')

    // Configuration routes
    router
      .group(() => {
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
        router.delete('/:id', identityTypesController.destroy.bind(identityTypesController)) // Soft delete identity type
      })
      .prefix('identity_types')

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
          router.get('/hotel/:hotelId', extraChargesController.getByHotel.bind(extraChargesController)) // Get extra charges by hotel
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
      })
      .prefix('configuration')

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
  })
  .prefix('/api')
  .use(
    middleware.auth({
      guards: ['api'],
    })
  )

// Import reports routes
import './routes/reports.js'
