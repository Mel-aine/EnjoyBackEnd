/* eslint-disable prettier/prettier */
import type { HttpContext } from '@adonisjs/core/http'
import CrudController from './crud_controller.js'
import CrudService from '#services/crud_service'
import EmploymentContract from '#models/employment_contract'
import { DateTime } from 'luxon'

export default class EmploymentContractsController extends CrudController<
  typeof EmploymentContract
> {
  private contractService: CrudService<typeof EmploymentContract>

  constructor() {
    super(new CrudService(EmploymentContract))
    this.contractService = new CrudService(EmploymentContract)
  }

  public async getMultiple({ request, response }: HttpContext) {
    console.log('--> getMultiple.ENTER')
    try {
      const { page = 1, perPage = 20, sortBy = 'contract_start_date', order = 'desc' } = request.qs()
      const data = await this.contractService.list({}, ['*'], sortBy, order, Number(page), Number(perPage))

      return response.ok({
        success: true,
        message: 'Contract read successfully',
        data,
      })
    } catch (error) {
      console.error('Erreur getMultiple:', error)
      return response.status(500).send({
        success: false,
        message: 'Error whyle reading contracts',
        error: error.message || error,
      })
    }
  }

  public async getOne({ params, response }: HttpContext) {
    console.log('--> getOne.ENTER')
    try {
      const contract = await this.contractService.findById(params.id)
      if (!contract) {
        return response.status(404).send({
          success: false,
          message: `Contract id=${params.id} not found`,
        })
      }

      return response.ok({
        success: true,
        message: 'Contract found successfully',
        data: contract,
      })
    } catch (error) {
      console.error('Erreur getOne:', error)
      return response.status(500).send({
        success: false,
        message: 'Error why fetching contracts',
        error: error.message || error,
      })
    }
  }

  public async save({ request, response }: HttpContext) {
    try {
        const data = request.only([
            'employee_id',
            'position_id',
            'contract_start_date',
            'contract_end_date',
            'base_salary',
            'special_conditions',
            'probation_start_date',
            'probation_end_date',
            'status',
            'contract_file_path',
            'is_cdi',
        ])

        // Si on crée un contrat "Active", on désactive les autres actifs du même employé
        if (data.status === 'Active') {
        await this.contractService
            .getModel() // accès au modèle Lucid depuis le service
            .query()
            .where('employee_id', data.employee_id)
            .where('status', 'Active')
            .update({ status: 'Terminated' })
        }

        // Création du nouveau contrat
        const contract = await this.contractService.create(data)
        await contract.refresh()

        return response.created({
            success: true,
            message: 'contract successfully created',
            data: contract,
        })
    } catch (error) {
        console.error('Error whyle creating contract :', error)

        return response.status(400).send({
            success: false,
            message: 'Error whyle creating contract',
            error: error.message || error,
        })
    }
  }

  public async update({ params, request, response }: HttpContext) {
    console.log('--> update.ENTER')
    try {
      const contract = await this.contractService.update(params.id, request.body())
      if (!contract) {
        return response.status(404).send({
          success: false,
          message: `Contract id=${params.id} not found`,
        })
      }

      return response.ok({
        success: true,
        message: 'Contract updated successfully',
        data: contract,
      })
    } catch (error) {
      console.error('Erreur update:', error)
      return response.status(500).send({
        success: false,
        message: 'Error whyle updating contract',
        error: error.message || error,
      })
    }
  }

  public async terminate({ params, response }: HttpContext) {
    console.log('--> terminate.ENTER')
    try {
      const contract = await this.contractService.findById(params.id)
      if (!contract) {
        return response.status(404).send({
          success: false,
          message: `Contract id=${params.id} not found`,
        })
      }

      contract.status = 'Terminated'
      contract.contract_end_date = DateTime.now()
      await contract.save()

      return response.ok({
        success: true,
        message: 'Contract terminated successfully',
        data: contract,
      })
    } catch (error) {
      console.error('Erreur terminate:', error)
      return response.status(500).send({
        success: false,
        message: 'Error whyle terminating contract',
        error: error.message || error,
      })
    }
  }

  
}
