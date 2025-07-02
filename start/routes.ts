import router from '@adonisjs/core/services/router'
import UsersController from '#controllers/users_controller'
import DashboardController from '#controllers/dashboard_controller'

// Import dynamique
const AuthController = () => import('#controllers/auth_controller')

const dashboardController = new DashboardController()
const usersController = new UsersController()

// Auth routes
router.post('api/auth', [AuthController, 'login'])
router.post('api/authLogin', [AuthController, 'signin'])
router.get('api/auth', [AuthController, 'user'])
router.put('api/auth/:id', [AuthController, 'update_user'])
router.post('api/validateEmail', [AuthController, 'validateEmail'])
router.post('api/validatePassword', [AuthController, 'validatePassword'])

router.get('/', async () => {
  return { hello: 'world' }
})

router.group(() => {
  // USERS
  router.group(() => {
    router.get('/users', usersController.list.bind(usersController))
    router.get('/users/:id', usersController.show.bind(usersController))
    router.post('/users', usersController.store.bind(usersController))
    router.put('/users/:id', usersController.update.bind(usersController))
    router.delete('/users/:id', usersController.destroy.bind(usersController))
  })

  // DASHBOARD
  router.group(() => {
    router.get('/occupancy/:serviceId/stats', dashboardController.occupancyStats.bind(dashboardController))
    router.get('/availability/:serviceId', dashboardController.getAvailability.bind(dashboardController))
    router.get('/occupancy/:serviceId/average-stay', dashboardController.averageStay.bind(dashboardController))

  })

}).prefix('api')
