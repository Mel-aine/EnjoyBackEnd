import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Hotel from '#models/hotel'
import AmenitiesCategory from './amenities_category.js'

export default class AmenityProduct extends BaseModel {
    public static table = 'amenity_products'

    @column({ isPrimary: true })
    declare id: number

    @column()
    declare name: string

    @column()
    declare price: number

    @column()
    declare description: string | null

    @column()
    declare pricingModel: 'flat_rate' | 'time_based'

    @column()
    declare timeUnit: 'hour' | 'day' | null

    @column()
    declare status: 'active' | 'inactive' | 'archived'

    @column({ columnName: 'amenities_category_id' })
    declare amenitiesCategoryId: number

    @column({ columnName: 'hotel_id' })
    declare hotelId: number

    @column({ columnName: 'created_by' })
    declare createdBy: number | null

    @column({ columnName: 'last_modified_by' })
    declare lastModifiedBy: number | null

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime

    @belongsTo(() => User, { foreignKey: 'createdBy' })
    declare creator: BelongsTo<typeof User>

    @belongsTo(() => User, { foreignKey: 'lastModifiedBy' })
    declare modifier: BelongsTo<typeof User>

    @belongsTo(() => Hotel, { foreignKey: 'hotelId' })
    declare service: BelongsTo<typeof Hotel>

    @belongsTo(() => AmenitiesCategory, {
        foreignKey: 'amenitiesCategoryId',
    })
    declare category: BelongsTo<typeof AmenitiesCategory>
}
