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
    router.get('/occupancy/:serviceId/stats', dashboardController.occupancyStats.bind(dashboardController))// Endpoint pour les taux d'occupation semaine, mois, année
    router.get('/availability/:serviceId', dashboardController.getAvailability.bind(dashboardController))// Endpoint pour les disponibilités des chambres le taux d'ocupation, le nombre de chambres disponibles, le nombre de chambres occupées, le nombre de chambres réservées aujourd'hui et le taux de réservation aujourd'hui et la semaine dernière
    router.get('/occupancy/:serviceId/average-stay', dashboardController.averageStay.bind(dashboardController))// Endpoint pour la durée moyenne de séjour
    router.get('/revenue/:serviceId/stats', dashboardController.getRevenueStats.bind(dashboardController))// Endpoint pour les statistiques de revenus annuels, mensuels, trimestriels et semestriels
    router.get('/revenue/:serviceId/monthly-comparison',dashboardController.getMonthlyRevenueComparison.bind(dashboardController)) // Endpoint pour la comparaison des revenus mensuels
    router.get('/occupancy/:serviceId/average-rate', dashboardController.averageOccupancyRate.bind(dashboardController)) // Endpoint pour le taux d'occupation moyen sur une période donnée
    router.get('/occupancy/:id/monthly', dashboardController.monthlyOccupancy.bind(dashboardController))// Endpoint pour les statistiques d'occupation mensuelles
    router.get('/adr/:serviceId/:period', dashboardController.getAverageDailyRate.bind(dashboardController)) // Endpoint pour le tarif journalier moyen
    //router.get('/clients/origin-stats', dashboardController.getNationalityStats.bind(dashboardController))//Endpoint pour les statistiques de nationalité des clients
    router.get('/stay-duration/:serviceId', dashboardController.stayDurationStats.bind(dashboardController))



  
  })

}).prefix('api')
