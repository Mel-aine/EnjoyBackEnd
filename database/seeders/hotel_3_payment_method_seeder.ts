import { BaseSeeder } from '@adonisjs/lucid/seeders'
import PaymentMethod from '#models/payment_method'
import { PaymentMethodType } from '../../app/enums.js'

export default class extends BaseSeeder {
  async run() {
    console.log('Managing payment methods for hotel 3...')
    
    // First, show current payment methods
    console.log('Current payment methods for hotel 3:')
    const currentMethods = await PaymentMethod.query().where('hotel_id', 3)
    console.log(currentMethods.map(m => ({ id: m.id, name: m.methodName, code: m.methodCode, type: m.methodType })))
    
    // Delete all existing payment methods for hotel 3
    console.log('\nDeleting existing payment methods for hotel 3...')
    await PaymentMethod.query().where('hotel_id', 3).delete()
    
    console.log('Creating new payment methods for hotel 3...')
    
    const paymentMethods = [
      {
        methodName: 'Master card',
        methodCode: 'MASTERCARD',
        methodType: PaymentMethodType.CASH,
        shortCode: 'MC',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'Orange Money',
        methodCode: 'ORANGE_MONEY',
        methodType: PaymentMethodType.CASH,
        shortCode: 'OM',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'Especes',
        methodCode: 'CASH',
        methodType:  PaymentMethodType.CASH,
        shortCode: 'CASH',
        type: 'CASH',
        cardProcessing: false,
        isDefault: true
      },
      {
        methodName: 'VISA card',
        methodCode: 'VISA',
        methodType:  PaymentMethodType.CASH,
        shortCode: 'VISA',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'VIREMENT BANCAIRE',
        methodCode: 'BANK_TRANSFER',
        methodType:  PaymentMethodType.CASH,
        shortCode: 'WIRE',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'MTN Mobile Money',
        methodCode: 'MTN_MOMO',
        methodType:  PaymentMethodType.CASH,
        shortCode: 'MTN',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'Chèque',
        methodCode: 'CHECK',
        methodType:  PaymentMethodType.CASH,
        shortCode: 'CHK',
        type: 'CASH',
        cardProcessing: false
      }
    ]
    
    for (let i = 0; i < paymentMethods.length; i++) {
      const method = paymentMethods[i]
      const paymentMethod = await PaymentMethod.create({
        hotelId: 3,
        methodName: method.methodName,
        methodCode: method.methodCode,
        methodType: method.methodType,
        description: `${method.methodName} payment method`,
        isActive: true,
        isDefault: method.isDefault || false,
        shortCode: method.shortCode,
        cardProcessing: method.cardProcessing,
        surchargeEnabled: false,
        receiptNoSetting: 'auto_general'
      })
      
      console.log(`Created: ${paymentMethod.methodName} (ID: ${paymentMethod.id})`)
    }
    
    console.log('\nNew payment methods for hotel 3:')
    const newMethods = await PaymentMethod.query().where('hotel_id', 3)
    console.log(newMethods.map(m => ({ id: m.id, name: m.methodName, code: m.methodCode, type: m.methodType })))
    
    console.log('\nPayment methods management completed successfully!')
  }
}