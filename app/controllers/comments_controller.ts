
import Comment from '#models/comment';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const commentService = new CrudService(Comment)

export default class CommentsController extends CrudController<typeof Comment> {
  constructor() {
    super(commentService)
  }
}
