/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

import UsersController from '#controllers/users_controller'
import RolesController from '#controllers/roles_controller'
import ServicesController from '#controllers/services_controller'
import ServiceProductsController from '#controllers/service_products_controller'
import ReservationsController from '#controllers/reservations_controller'
import ReservationServiceProductsController from '#controllers/reservation_service_products_controller'
import ProductionOptionsController from '#controllers/production_options_controller'
import PaymentsController from '#controllers/payments_controller'
import OrdersController from '#controllers/orders_controller'
import OrderItemsController from '#controllers/order_items_controller'
import OptionsController from '#controllers/options_controller'
import InvoicesController from '#controllers/invoices_controller'
import CommentsController from '#controllers/comments_controller'
import CategoriesController from '#controllers/categories_controller'
import TypeProductsController from '#controllers/type_products_controller'
const AuthController = () => import('#controllers/auth_controller')


const usersController = new UsersController()
const rolesController = new RolesController()
const servicesController = new ServicesController()
const serviceProductsController = new ServiceProductsController()
const reservationsController = new ReservationsController()
const reservationServiceProductsController = new ReservationServiceProductsController()
const productionOptionsController = new ProductionOptionsController()
const paymentsController = new PaymentsController()
const ordersController = new OrdersController()
const orderItemsController = new OrderItemsController()
const optionsController = new OptionsController()
const invoicesController = new InvoicesController()
const commentsController = new CommentsController()
const categoriesController = new CategoriesController()
const typeProductsController = new TypeProductsController()



router.post('/auth', [AuthController, 'login'])
router.get('/auth', [AuthController, 'user'])
router.get('/', async () => {
  return { hello: 'world' }
})
router
  .group(() => {

router
  .group(() => {
    router.get('/users', usersController.list.bind(usersController))
    router.get('/users/:id', usersController.show.bind(usersController))
    router.post('/users', usersController.store.bind(usersController))
    router.put('/users/:id', usersController.update.bind(usersController))
    router.delete('/users/:id', usersController.destroy.bind(usersController))
  })
  //.middleware('auth') // Protège toutes les routes


  router
  .group(() => {
    router.get('/roles', rolesController.list.bind(rolesController))
    router.get('/roles/:id', rolesController.show.bind(rolesController))
    router.post('/roles', rolesController.store.bind(rolesController))
    router.put('/roles/:id', rolesController.update.bind(rolesController))
    router.delete('/roles/:id', rolesController.destroy.bind(rolesController))

  })


  router
  .group(() => {
    router.post('/services', servicesController.store.bind(servicesController ))
    router.get('/services', servicesController.list.bind(servicesController ))
    router.get('/servicesByCategory/:categoryId', servicesController.showByCategorie.bind(servicesController ))
    router.get('/services/:id', servicesController.show.bind(servicesController ))
    router.put('/services/:id', servicesController.update.bind(servicesController))
    router.delete('/services/:id', servicesController.destroy.bind(servicesController))
  })

  router
  .group(() => {
    router.post('/product', typeProductsController.store.bind(typeProductsController ))
    router.get('/product', typeProductsController.list.bind(typeProductsController ))
    router.get('/product/:id', typeProductsController.show.bind(typeProductsController ))
    router.put('/product/:id', typeProductsController.update.bind(typeProductsController))
    router.delete('/product/:id', typeProductsController.destroy.bind(typeProductsController))
  })


  router
  .group(() => {
    router.post('/service_product', serviceProductsController.store.bind(serviceProductsController ))
    router.get('/service_product', serviceProductsController.list.bind(serviceProductsController ))
    router.get('/service_product_options', serviceProductsController.getAllWithOptions.bind(serviceProductsController ))
    router.get('/service_product/:id', serviceProductsController.show.bind(serviceProductsController ))
    router.put('/service_product/:id', serviceProductsController.update.bind(serviceProductsController))
    router.delete('/service_product/:id', serviceProductsController.destroy.bind(serviceProductsController))
  })


  router
  .group(() => {
    router.get('/reservations', reservationsController.list.bind(reservationsController))
    router.get('/reservations/:id', reservationsController.show.bind(reservationsController))
    router.post('/reservations', reservationsController.store.bind(reservationsController))
    router.put('/reservations/:id', reservationsController.update.bind(reservationsController))
    router.delete('/reservations/:id', reservationsController.destroy.bind(reservationsController))
  })


  router
  .group(() => {
    router.get('/reservation_service', reservationServiceProductsController.list.bind(reservationServiceProductsController))
    router.get('/reservation_service/:id', reservationServiceProductsController.show.bind(reservationServiceProductsController))
    router.post('/reservation_service', reservationServiceProductsController.store.bind(reservationServiceProductsController))
    router.put('/reservation_service/:id', reservationServiceProductsController.update.bind(reservationServiceProductsController))
    router.delete('/reservation_service/:id', reservationServiceProductsController.destroy.bind(reservationServiceProductsController))
  })


  router
  .group(() => {
    router.get('/production_option', productionOptionsController.list.bind(productionOptionsController))
    router.get('/production_option/:id', productionOptionsController.show.bind(productionOptionsController))
    // router.post('/production_option', productionOptionsController.store.bind(productionOptionsController))
    router.post('/production_option', productionOptionsController.bulkCreate.bind(productionOptionsController))

    router.put('/production_option/:id', productionOptionsController.update.bind(productionOptionsController))
    router.delete('/production_option/:id', productionOptionsController.destroy.bind(productionOptionsController))
  })


  router
  .group(() => {
    router.get('/payment', paymentsController.list.bind(paymentsController))
    router.get('/payment/:id', paymentsController.show.bind(paymentsController))
    router.post('/payment', paymentsController.store.bind(paymentsController))
    router.put('/payment/:id', paymentsController.update.bind(paymentsController))
    router.delete('/payment/:id', paymentsController.destroy.bind(paymentsController))
  })


  router
  .group(() => {
    router.get('/order', ordersController.list.bind(ordersController))
    router.get('/order/:id', ordersController.show.bind(ordersController))
    router.post('/order', ordersController.store.bind(ordersController))
    router.put('/order/:id', ordersController.update.bind(ordersController))
    router.delete('/order/:id', ordersController.destroy.bind(ordersController))
  })


  router
  .group(() => {
    router.get('/order_item', orderItemsController.list.bind(orderItemsController))
    router.get('/order_item/:id', orderItemsController.show.bind(orderItemsController))
    router.post('/order_item', orderItemsController.store.bind(orderItemsController))
    router.put('/order_item/:id', orderItemsController.update.bind(orderItemsController))
    router.delete('/order_item/:id', orderItemsController.destroy.bind(orderItemsController))
  })


  router
  .group(() => {
    router.get('/option', optionsController.list.bind(optionsController))
    router.get('/option/:id', optionsController.show.bind(optionsController))
    router.post('/option', optionsController.store.bind(optionsController))
    router.put('/option/:id', optionsController.update.bind(optionsController))
    router.delete('/option/:id', optionsController.destroy.bind(optionsController))
  })


  router
  .group(() => {
    router.get('/invoice', invoicesController.list.bind(invoicesController))
    router.get('/invoice/:id', invoicesController.show.bind(invoicesController))
    router.post('/invoice', invoicesController.store.bind(invoicesController))
    router.put('/invoice/:id', invoicesController.update.bind(invoicesController))
    router.delete('/invoice/:id', invoicesController.destroy.bind(invoicesController))
  })


  router
  .group(() => {
    router.get('/comment', commentsController.list.bind(commentsController))
    router.get('/comment/:id', commentsController.show.bind(commentsController))
    router.post('/comment', commentsController.store.bind(invoicesController))
    router.put('/comment/:id', commentsController.update.bind(commentsController))
    router.delete('/comment/:id', commentsController.destroy.bind(commentsController))
  })


  router
  .group(() => {
    router.get('/category', categoriesController.list.bind(categoriesController))
    router.get('/category/:id', categoriesController.show.bind(categoriesController))
    router.post('/category', categoriesController.store.bind(categoriesController))
    router.put('/category/:id', categoriesController.update.bind(categoriesController))
    router.delete('/category/:id', categoriesController.destroy.bind(categoriesController))
  })
  })
  .prefix('/api')
