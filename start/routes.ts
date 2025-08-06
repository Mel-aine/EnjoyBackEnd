import router from '@adonisjs/core/services/router'
import UsersController from '#controllers/users_controller'
import RolesController from '#controllers/roles_controller'
import ServicesController from '#controllers/services_controller'
import ServiceProductsController from '#controllers/service_products_controller'
import ReservationsController from '#controllers/reservations_controller'
import ReservationServiceProductsController from '#controllers/reservation_service_products_controller'
import ProductionOptionsController from '#controllers/production_options_controller'
import PaymentsController from '#controllers/payments_controller'
import OptionsController from '#controllers/options_controller'
import CategoriesController from '#controllers/categories_controller'
import TypeProductsController from '#controllers/type_products_controller'
import StockCategoriesController from '#controllers/stock_categories_controller'
import SuppliersController from '#controllers/suppliers_controller'
import ProductServicesController from '#controllers/product_services_controller'
import MouvementsController from '#controllers/mouvements_controller'
import DepartmentsController from '#controllers/departments_controller'
import ExpensesController from '#controllers/expenses_controller'
import SchedulesController from '#controllers/schedules_controller'
import AssigmentUsersController from '#controllers/assigment_users_controller'
import PermissionsController from '#controllers/permissions_controller'
import TasksController from '#controllers/tasks_controller'
import RolePermissionsController from '#controllers/role_permissions_controller'
import CancellationPoliciesController from '#controllers/cancellation_policies_controller'
import RefundsController from '#controllers/refunds_controller'
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
const servicesController = new ServicesController()
const serviceProductsController = new ServiceProductsController()
const reservationsController = new ReservationsController()
const reservationServiceProductsController = new ReservationServiceProductsController()
const productionOptionsController = new ProductionOptionsController()
const paymentsController = new PaymentsController()
const optionsController = new OptionsController()
const categoriesController = new CategoriesController()
const typeProductsController = new TypeProductsController()
const stockCategoriesController = new StockCategoriesController()
const suppliersController = new SuppliersController()
const productServicesController = new ProductServicesController()
const mouvementsController = new MouvementsController()
const departmentsController = new DepartmentsController()
const expensesController = new ExpensesController()
const schedulesController = new SchedulesController()
const assigmentUsersController = new AssigmentUsersController()
const permissionsController = new PermissionsController()
const tasksController = new TasksController()
const rolePermissionsController = new RolePermissionsController()
const activityLogsController = new ActivityLogsController()
const cancellationPoliciesController = new CancellationPoliciesController()
const refundsController = new RefundsController()
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
router.get('/services', servicesController.list.bind(servicesController)).prefix('/api')
router
  .group(() => {
    router.get('/category', categoriesController.list.bind(categoriesController))
    router.get('/category/:id', categoriesController.show.bind(categoriesController))
    router.post('/category', categoriesController.store.bind(categoriesController))
    router.put('/category/:id', categoriesController.update.bind(categoriesController))
    router.delete('/category/:id', categoriesController.destroy.bind(categoriesController))
  })
  .prefix('/api')

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

    router.group(() => {
      router.post('/services', servicesController.store.bind(servicesController))

      router.get(
        '/servicesByCategory/:categoryId',
        servicesController.showByCategorie.bind(servicesController)
      )
      router.post(
        '/servicesWithUser',
        servicesController.createWithUserAndService.bind(servicesController)
      )
      router.get('/services/:id', servicesController.show.bind(servicesController))
      router.patch('/services/:id', servicesController.update.bind(servicesController))
      router.delete('/services/:id', servicesController.destroy.bind(servicesController))
      router.get('/services/search', servicesController.searchByName.bind(servicesController))
      router.get(
        '/services/customer/:serviceId',
        servicesController.customers.bind(servicesController)
      )
      router.get(
        '/servicesWithServiceProduct',
        servicesController.getServicesWithProductsAndOptions.bind(servicesController)
      )
      router.get(
        '/services/:id/reservation/search',
        reservationsController.searchReservations.bind(servicesController)
      )
      router.get(
        '/services/:serviceId/departments/:departmentId/details',
        departmentsController.getDepartmentDetails.bind(departmentsController)
      )
    })

    router.group(() => {
      router.post('/product', typeProductsController.store.bind(typeProductsController))
      router.get(
        '/product/:serviceId',
        typeProductsController.GetByServiceId.bind(typeProductsController)
      )
      router.get(
        '/type-products/room-count',
        typeProductsController.countRoomsByType.bind(typeProductsController)
      )
      router.put('/product/:id', typeProductsController.update.bind(typeProductsController))
      router.delete('/product/:id', typeProductsController.destroyed.bind(typeProductsController))
    })

    router.group(() => {
      router.post(
        '/service_product',
        serviceProductsController.store.bind(serviceProductsController)
      )
      router.get('/service_product', serviceProductsController.list.bind(serviceProductsController))
      router.post(
        '/service_product/:id/filter',
        serviceProductsController.filter.bind(serviceProductsController)
      )
      router.get(
        '/service_product_options',
        serviceProductsController.getAllWithOptions.bind(serviceProductsController)
      )
      router.get(
        '/service_product_option',
        serviceProductsController.getServiceProductAllWithOptions.bind(serviceProductsController)
      )
      router.get(
        '/service_product/:id',
        serviceProductsController.show.bind(serviceProductsController)
      )
      router.get(
        '/service_products/:id',
        serviceProductsController.showWithReservations.bind(serviceProductsController)
      )
      router.get(
        '/service_product_by_date',
        serviceProductsController.getAvailable.bind(serviceProductsController)
      )
      router.get(
        '/service_product_by_serviceId/:serviceId',
        serviceProductsController.showByServiceId.bind(serviceProductsController)
      )
      router.put(
        '/service_product/:id',
        serviceProductsController.update.bind(serviceProductsController)
      )
      router.delete(
        '/service_product/:id',
        serviceProductsController.destroyed.bind(serviceProductsController)
      )
      router.patch(
        '/service_product/update_status/:id',
        serviceProductsController.updateStatus.bind(serviceProductsController)
      )
      router.get(
        '/service-products/available',
        serviceProductsController.findAvailableRooms.bind(serviceProductsController)
      )
      router.get(
        '/service-products/:serviceId/details',
        serviceProductsController.getServiceProductsWithDetails.bind(serviceProductsController)
      )
    })

    router.group(() => {
      router.get(
        '/reservations_by_id/:id',
        reservationsController.show.bind(reservationsController)
      )
      router.get(
        '/reservations/:serviceId',
        reservationsController.GetByServiceId.bind(reservationsController)
      )
      router.get(
        '/reservations/:reservationId/details',
        reservationsController.getReservationDetails.bind(reservationsController)
      )
      // .use(middleware.checkPermission(['bookings_read']))
      router.post('/reservations', reservationsController.store.bind(reservationsController))
      router.post(
        '/reservationswithuser',
        reservationsController.createWithUserAndReservation.bind(reservationsController)
      )
      router.put('/reservations/:id', reservationsController.update.bind(reservationsController))
      router.put(
        '/reservations_update/:id',
        reservationsController.updateReservation.bind(reservationsController)
      )
      router.delete(
        '/reservations/:id',
        reservationsController.destroy.bind(reservationsController)
      )
      router.patch(
        '/reservations/:id/check-in',
        reservationsController.checkIn.bind(reservationsController)
      )
      router.patch(
        '/reservations/:id/check-out',
        reservationsController.checkOut.bind(reservationsController)
      )
      router.patch(
        '/reservations/:id/extend',
        reservationsController.extendStay.bind(reservationsController)
      )
      router.get(
        '/reservations/service-product/:serviceProductId',
        reservationsController.showByServiceProductId.bind(reservationsController)
      )
      router.patch(
        '/reservations/:id/checkExtendStay',
        reservationsController.checkExtendStay.bind(reservationsController)
      )
      router.patch(
        '/reservations/:id/extendStay',
        reservationsController.extendStay.bind(reservationsController)
      )
      router.get(
        '/reservations/:id/cancellation-summary',
        reservationsController.getCancellationSummary.bind(reservationsController)
      )
      router.post(
        '/reservations/:id/cancel',
        reservationsController.cancelReservation.bind(reservationsController)
      )
    })

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

    router.group(() => {
      router.get(
        '/reservation_service',
        reservationServiceProductsController.list.bind(reservationServiceProductsController)
      )
      router.get(
        '/reservation_service/:reservationId',
        reservationServiceProductsController.showByResrvationId.bind(
          reservationServiceProductsController
        )
      )
      router.get(
        '/reservation_service_serviceId/:serviceId',
        reservationServiceProductsController.getRecentBookings.bind(
          reservationServiceProductsController
        )
      )
      router.get(
        '/reservation_service/:id',
        reservationServiceProductsController.show.bind(reservationServiceProductsController)
      )
      router.post(
        '/reservation_service',
        reservationServiceProductsController.store.bind(reservationServiceProductsController)
      )
      router.put(
        '/reservation_service/:id',
        reservationServiceProductsController.update.bind(reservationServiceProductsController)
      )
      router.delete(
        '/reservation_service/:id',
        reservationServiceProductsController.destroy.bind(reservationServiceProductsController)
      )
    })

    router.group(() => {
      router.get(
        '/production_option',
        productionOptionsController.list.bind(productionOptionsController)
      )
      router.get(
        '/production_option/:id',
        productionOptionsController.show.bind(productionOptionsController)
      )
      router.get(
        '/production_options/:serviceProductId',
        productionOptionsController.showByServiceProductId.bind(productionOptionsController)
      )
      router.post(
        '/production_option',
        productionOptionsController.bulkCreate.bind(productionOptionsController)
      )
      router.put(
        '/product_option/by-service/:service_product_id',
        productionOptionsController.updateByServiceProductId.bind(productionOptionsController)
      )
      router.put(
        '/production_option/:id',
        productionOptionsController.update.bind(productionOptionsController)
      )
      router.delete(
        '/production_option/:id',
        productionOptionsController.destroy.bind(productionOptionsController)
      )
    })

    router.group(() => {
      router.get('/payment', paymentsController.list.bind(paymentsController))
      router.get('/payment/:id', paymentsController.show.bind(paymentsController))
      router.get('/payments/:serviceId', paymentsController.getAllPayment.bind(paymentsController))
      router.post('/payment', paymentsController.store.bind(paymentsController))
      router.post('/paymentConfirm', paymentsController.storePayment.bind(paymentsController))
      router.put('/payment/:id', paymentsController.update.bind(paymentsController))
      router.put('/payment/:id/confirm', paymentsController.confirmPayment.bind(paymentsController))
      router.delete('/payment/:id', paymentsController.destroy.bind(paymentsController))
    })

    router.group(() => {
      router.get('/option', optionsController.list.bind(optionsController))
      router.get(
        '/option_equipement',
        optionsController.equipmentFilterOptions.bind(optionsController)
      )
      router.get('/option/:id', optionsController.show.bind(optionsController))
      router.post('/option', optionsController.store.bind(optionsController))
      router.put('/option/:id', optionsController.update.bind(optionsController))
      router.delete('/option/:id', optionsController.destroy.bind(optionsController))
    })

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


    router.group(() => {
      router.post('/schedules', schedulesController.create.bind(SchedulesController))
      router.get('/schedules', schedulesController.lister.bind(SchedulesController))
    })

    router.group(() => {
      router.get(
        '/services/:serviceId/products/grouped',
        serviceProductsController.getGroupedByAccommodationType.bind(ServiceProductsController)
      )
    })

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
