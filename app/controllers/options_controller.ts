

import Option from '#models/option';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

import type { HttpContext } from '@adonisjs/core/http'
const optionService = new CrudService(Option)

export default class OptionsController extends CrudController<typeof Option> {
  constructor() {
    super(optionService)
  }
  public async equipmentFilterOptions({ response }: HttpContext) {
    try {
      const equipmentOptionNames = [
        'Bed Type',
        'View',
        'Balcony',
        'Terrace',
        'Air Conditioning',
        'Wi-Fi',
        'TV',
        'Mini Bar',
        'Safe Deposit Box',
        'Private Bathroom',
        'Kitchen / Kitchenette',
        'Washing Machine',
        'Extra Bed',
        'Wheelchair Accessible',
        'Private Pool',
        'Jacuzzi / Spa'
      ]

      const equipments = await Option.query()
        .whereIn('option_name', equipmentOptionNames)
        .andWhere('is_default', true)
        .andWhere('category_id', 14)
        .orderBy('option_name')

      const mappedOptions = equipments.flatMap((option) => {
        // const baseKey = option.option_name.toLowerCase().replace(/\s+/g, '_')

        return option.values.map((val) => ({
          label: `${option.option_name}: ${val}`,
          value: `${val}`,
        }))
      })

      return response.ok(mappedOptions)
    } catch (error) {
      console.error('Error fetching equipment filters:', error)
      return response.status(500).json({ message: 'Server error' })
    }
  }
}
