import type { HttpContext } from '@adonisjs/core/http'
import CrudController from './crud_controller.js'
import CrudService from '#services/crud_service'
import Payroll from '#models/payroll'

export default class PayrollsController extends CrudController<typeof Payroll> {
  private payrollService: CrudService<typeof Payroll>

  constructor() {
    super(new CrudService(Payroll))
    this.payrollService = new CrudService(Payroll)
  }

  /**
   * Liste paginée des fiches de paie, triées selon les critères.
   */
  public async getMultiple({ request, response }: HttpContext) {
    const { page = 1, perPage = 20, sortBy = 'month_year', order = 'desc' } = request.qs()

    const data = await this.payrollService.list({}, ['*'], sortBy, order, page, perPage)
    return response.ok(data)
  }

  /**
   * Récupère une fiche de paie par ID.
   */
  public async getOne({ params, response }: HttpContext) {
    const payroll = await this.payrollService.findById(params.id)
    if (!payroll) {
      return response.notFound({ message: 'Fiche de paie introuvable' })
    }
    return response.ok(payroll)
  }

  /**
   * Crée une nouvelle fiche de paie.
   */
  public async save({ request, response }: HttpContext) {
    const data = request.only([
      'contract_id',
      'month_year',
      'gross_salary',
      'normal_hours',
      'overtime_hours',
      'overtime_pay',
      'bonuses',
      'allowances',
      'cnps_contributions',
      'withheld_taxes',
      'net_salary',
      'rib_employe',
      'payslip_file_path',
    ])

    const created = await this.payrollService.create(data)
    return response.created(created)
  }

  /**
   * Met à jour une fiche de paie existante.
   */
  public async update({ params, request, response }: HttpContext) {
    const updated = await this.payrollService.update(params.id, request.body())
    if (!updated) {
      return response.notFound({ message: 'Fiche de paie introuvable' })
    }
    return response.ok(updated)
  }

  /**
   * Supprime une fiche de paie.
   */
  public async delete({ params, response }: HttpContext) {
    const deleted = await this.payrollService.delete(params.id)
    if (!deleted) {
      return response.notFound({ message: 'Fiche de paie introuvable' })
    }
    return response.ok({ message: 'Fiche de paie supprimée avec succès' })
  }

  /**
   * Récupère les fiches de paie d’un employé spécifique.
   */
  public async getPayrollByEmployee({ params, response }: HttpContext) {
    const employeeId = Number(params.employeeId)
    if (Number.isNaN(employeeId)) {
      return response.badRequest({ message: 'Invalid employee ID' })
    }
    const records = await Payroll.query()
      .whereHas('contract', (contractQuery) => {
        contractQuery.where('employee_id', employeeId)
      })
      .orderBy('month_year', 'desc')
    return response.ok(records)
  }

  /**
   * Récupère les fiches de paie pour un contrat spécifique.
   */
  public async getPayrollsByContract({ params, response }: HttpContext) {
    const contractId = Number(params.contractId)
    if (Number.isNaN(contractId)) {
      return response.badRequest({ message: 'Invalid contract ID' })
    }
    const records = await Payroll.query()
      .where('contract_id', contractId)
      .orderBy('month_year', 'desc')
    return response.ok(records)
  }
}
