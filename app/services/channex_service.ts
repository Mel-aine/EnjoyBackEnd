import axios, { AxiosInstance, AxiosResponse } from 'axios'
import env from '#start/env'

/**
 * Channex.io API Integration Service
 * Provides methods to interact with all Channex.io API endpoints
 * Base URL: https://api.channex.io/v1
 * Authentication: API Key via X-API-Key header
 */
interface RestrictionData {
  rate_plan_id: string
  date_from: string
  date_to: string
  closed_to_arrival?: boolean
  closed_to_departure?: boolean
  stop_sell?: boolean
  min_stay_arrival?: number
  min_stay_through?: number
  max_stay?: number
  [key: string]: any
}
export class ChannexService {
  private client: AxiosInstance
  private baseURL: string
  private apiKey: string

  constructor() {
    this.apiKey = env.get('CHANNEX_API_KEY') || 'uDLcCU1XVVraqAVOGfKNvXqVaTyE73jnmDXdPr8gufyR0SF91CQeIwJjWm2qrOX3'
    this.baseURL = env.get('CHANNEX_BASE_URL') || 'https://staging.channex.io/api/v1'

    // Initialize HTTP client with base configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'user-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    })

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log('Channex API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params
        })
        return config
      },
      (error) => {
        console.error('Channex API Request Error', { error: error.message })
        return Promise.reject(error)
      }
    )

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log('Channex API Response', {
          status: response.status,
          url: response.config.url
        })
        return response
      },
      (error) => {
        console.error('Channex API Response Error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        })
        return Promise.reject(this.handleApiError(error))
      }
    )
  }

  /**
   * Handle API errors and format them consistently
   */
  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response
      const message = data?.message || data?.error || `HTTP ${status} Error`
      return new Error(`Channex API Error (${status}): ${message}`)
    } else if (error.request) {
      return new Error('Channex API Error: No response received')
    } else {
      return new Error(`Channex API Error: ${error.message}`)
    }
  }

  /**
   * Generic GET request method
   */
  private async get<T>(endpoint: string, params?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(endpoint, { params })
    return response.data
  }

  /**
   * Generic POST request method
   */
  private async post<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(endpoint, data)
    return response.data
  }

  /**
   * Generic PUT request method
   */
  private async put<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(endpoint, data)
    return response.data
  }

  /**
   * Generic PATCH request method
   */
  private async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(endpoint, data)
    return response.data
  }

  /**
   * Generic DELETE request method
   */
  private async delete<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(endpoint)
    return response.data
  }

  // =============================================================================
  // PROPERTIES API METHODS
  // =============================================================================

  /**
   * List all properties
   * GET /properties
   */
  async listProperties(params?: {
    page?: number
    per_page?: number
    filter?: any
  }) {
    return this.get('/properties', params)
  }

  /**
   * Get a specific property
   * GET /properties/{property_id}
   */
  async getProperty(propertyId: string) {
    return this.get(`/properties/${propertyId}`)
  }

  /**
   * Create a new property with comprehensive structure
   * Required fields: title, currency
   * Optional fields: email, phone, zip_code, country, state, city, address, longitude, latitude, timezone, facilities, property_type, group_id, settings, content, logo_url, website
   * POST /properties
   */
  async createProperty(propertyData: {
    // Required fields
    title: string
    currency: string // 3 symbols (e.g., "GBP", "USD")

    // Optional fields
    email?: string | null
    phone?: string | null
    zip_code?: string | null
    country?: string | null // 2 symbols (e.g., "GB", "US")
    state?: string | null
    city?: string | null
    address?: string | null
    longitude?: string | null // decimal number as string
    latitude?: string | null // decimal number as string
    timezone?: string | null // e.g., "Europe/London"
    facilities?: string[] | null // List of facility IDs
    property_type?: string | null // e.g., "hotel"
    group_id?: string | null // UUID

    // Settings object
    settings?: {
      allow_availability_autoupdate_on_confirmation?: boolean
      allow_availability_autoupdate_on_modification?: boolean
      allow_availability_autoupdate_on_cancellation?: boolean
      min_stay_type?: string // e.g., "both"
      min_price?: number | null
      max_price?: number | null
      state_length?: number
      cut_off_time?: string // e.g., "00:00:00"
      cut_off_days?: number
      max_day_advance?: number | null
    }

    // Content object
    content?: {
      description?: string
      important_information?: string
      photos?: Array<{
        url: string
        position?: number
        author?: string
        kind?: string // e.g., "photo"
        description?: string
      }>
    }

    logo_url?: string // URL
    website?: string // URL
  }) {
    // Wrap the property data in the expected structure
    const requestData = {
      property: propertyData
    }

    return this.post('/properties', requestData)
  }

  /**
   * Create a property using the demo structure format
   * This is a convenience method that matches the exact structure from the API documentation
   */
  async createPropertyFromDemo(demoData: {
    title: string
    currency: string
    email?: string
    phone?: string
    zip_code?: string
    country?: string
    state?: string
    city?: string
    address?: string
    longitude?: string
    latitude?: string
    timezone?: string
    facilities?: string[]
    property_type?: string
    group_id?: string
    settings?: {
      allow_availability_autoupdate_on_confirmation?: boolean
      allow_availability_autoupdate_on_modification?: boolean
      allow_availability_autoupdate_on_cancellation?: boolean
      min_stay_type?: string
      min_price?: number | null
      max_price?: number | null
      state_length?: number
      cut_off_time?: string
      cut_off_days?: number
      max_day_advance?: number | null
    }
    content?: {
      description?: string
      photos?: Array<{
        url: string
        position?: number
        author?: string
        kind?: string
        description?: string
      }>
      important_information?: string
    }
    logo_url?: string
    website?: string
  }) {
    // Use the main createProperty method
    return this.createProperty(demoData)
  }

  /**
   * Update a property
   * PUT /properties/{property_id}
   */
  async updateProperty(propertyId: string, propertyData: any) {
    return this.put(`/properties/${propertyId}`, propertyData)
  }

  /**
   * Delete a property
   * DELETE /properties/{property_id}
   */
  async deleteProperty(propertyId: string) {
    return this.delete(`/properties/${propertyId}`)
  }

  // =============================================================================
  // PROPERTY USERS API METHODS
  // =============================================================================

  /**
   * List property users
   * GET /properties/{property_id}/users
   */
  async listPropertyUsers(propertyId: string, params?: {
    page?: number
    per_page?: number
  }) {
    return this.get(`/properties/${propertyId}/users`, params)
  }

  /**
   * Add user to property
   * POST /properties/{property_id}/users
   */
  async addPropertyUser(propertyId: string, userData: {
    email: string
    role: string
    [key: string]: any
  }) {
    return this.post(`/properties/${propertyId}/users`, userData)
  }

  /**
   * Remove user from property
   * DELETE /properties/{property_id}/users/{user_id}
   */
  async removePropertyUser(propertyId: string, userId: string) {
    return this.delete(`/properties/${propertyId}/users/${userId}`)
  }

  // =============================================================================
  // ROOM TYPES API METHODS
  // =============================================================================

  /**
   * List room types for a property
   * GET /properties/{property_id}/room_types
   */
  async listRoomTypes(params?: {
    page?: number
    per_page?: number
    filter?: any
  }) {
    return this.get(`/room_types`, params)
  }

  /**
   * Get a specific room type
   * GET /properties/{property_id}/room_types/{room_type_id}
   */
  async getRoomType(roomTypeId: string) {
    return this.get(`/room_types/${roomTypeId}`)
  }

  /**
   * Create a new room type
   * POST /properties/{property_id}/room_types
   */
  async createRoomType(propertyId: string, roomTypeData: {
    [key: string]: any
  }) {
    return this.post(`/room_types`, roomTypeData)
  }

  /**
   * Update a room type
   * PUT /properties/{property_id}/room_types/{room_type_id}
   */
  async updateRoomType(propertyId: string, roomTypeId: string, roomTypeData: any) {
    return this.put(` /room_types/${roomTypeId}`, roomTypeData)
  }

  /**
   * Delete a room type
   * DELETE /properties/{property_id}/room_types/{room_type_id}
   */
  async deleteRoomType(propertyId: string, roomTypeId: string) {
    return this.delete(`/room_types/${roomTypeId}`)
  }

  // =============================================================================
  // RATE PLANS API METHODS
  // =============================================================================

  /**
   * List rate plans for a property
   * GET /properties/{property_id}/rate_plans
   */
  async listRatePlans(propertyId: string, params?: {
    page?: number
    per_page?: number
    filter?: any
  }) {
    return this.get(`/rate_plans`, params)
  }

  /**
   * Get a specific rate plan
   * GET /properties/{property_id}/rate_plans/{rate_plan_id}
   */
  async getRatePlan(propertyId: string, ratePlanId: string) {
    return this.get(`/rate_plans/${ratePlanId}`)
  }

  /**
   * Create a new rate plan
   * POST /properties/{property_id}/rate_plans
   */
  async createRatePlan(propertyId: string, ratePlanData: {
    [key: string]: any
  }) {
    return this.post(`/rate_plans`, ratePlanData)
  }

  /**
   * Update a rate plan
   * PUT /properties/{property_id}/rate_plans/{rate_plan_id}
   */
  async updateRatePlan(propertyId: string, ratePlanId: string, ratePlanData: any) {
    return this.put(`/rate_plans/${ratePlanId}`, ratePlanData)
  }

  /**
   * Delete a rate plan
   * DELETE /properties/{property_id}/rate_plans/{rate_plan_id}
   */
  async deleteRatePlan(propertyId: string, ratePlanId: string) {
    return this.delete(`/properties/${propertyId}/rate_plans/${ratePlanId}`)
  }

  // =============================================================================
  // AVAILABILITY AND RATES (ARI) API METHODS
  // =============================================================================

  /**
   * Get availability for rate plans
   * GET /properties/{property_id}/availability
   */
  async getAvailability(propertyId: string, params: {
    rate_plan_ids: string[]
    date_from: string // YYYY-MM-DD format
    date_to: string   // YYYY-MM-DD format
  }) {
    return this.get(`/properties/${propertyId}/availability`, params)
  }

  /**
   * Update availability for rate plans
   * PUT /properties/{property_id}/availability
   */
  async updateAvailability(propertyId: string, availabilityData: {
    "values": {
      room_type_id: string
      property_id:string
      date_from: string
      date_to: string
      availability: number
      [key: string]: any
    }[]
  }) {
    return this.post(`/availability`, availabilityData)
  }

  /**
   * Get rates for rate plans
   * GET /properties/{property_id}/rates
   */
  async getRates(propertyId: string, params: {
    rate_plan_ids: string[]
    date_from: string // YYYY-MM-DD format
    date_to: string   // YYYY-MM-DD format
  }) {
    return this.get(`/rates`, params)
  }

  /**
   * Update rates for rate plans
   * PUT /properties/{property_id}/rates
   */
  async updateRates(propertyId: string, ratesData: {
    rate_plan_id: string
    date_from: string
    date_to: string
    rate: number
    [key: string]: any
  }[]) {
    return this.put(`/rates`, ratesData)
  }

  /**
   * Get restrictions for rate plans
   * GET /properties/{property_id}/restrictions
   */
  async getRestrictions(propertyId: string, params: {
    rate_plan_ids: string[] | null
    date_from: string // YYYY-MM-DD format
    date_to: string   // YYYY-MM-DD format
    restrictions:string //rate,availability,min_stay_arrival,min_stay_through,min_stay,closed_to_arrival,closed_to_departure,stop_sell,max_stay,availability_offset,max_availability
  }) {
    return this.get(`/restrictions`, {
      "filter[property_id]":propertyId,
      "filter[date][gte]":params.date_from,
      "filter[date][lte]":params.date_to,
      "filter[restrictions]":params.restrictions
    })
  }

  /**
   * Update restrictions for rate plans
   * PUT /properties/{property_id}/restrictions
   */

  async updateRestrictions(propertyId: string, restrictionsData: {
    "values": RestrictionData[]
  }[]) {
    return this.post(`/restrictions`, restrictionsData)
  }
  /**
   * Bulk update ARI (Availability, Rates, and Restrictions)
   * PUT /properties/{property_id}/ari
   */
  async updateARI(propertyId: string, ariData: {
    rate_plan_id: string
    date_from: string
    date_to: string
    availability?: number
    rate?: number
    closed_to_arrival?: boolean
    closed_to_departure?: boolean
    stop_sell?: boolean
    min_stay_arrival?: number
    min_stay_through?: number
    max_stay?: number
    [key: string]: any
  }[]) {
    return this.put(`/properties/${propertyId}/ari`, ariData)
  }

  // =============================================================================
  // BOOKINGS API METHODS
  // =============================================================================

  /**
   * List bookings for a property
   * GET /properties/{property_id}/bookings
   */
  async listBookings(propertyId: string, params?: {
    page?: number
    per_page?: number
    filter?: {
      arrival_date_from?: string
      arrival_date_to?: string
      departure_date_from?: string
      departure_date_to?: string
      created_at_from?: string
      created_at_to?: string
      updated_at_from?: string
      updated_at_to?: string
      status?: string[]
      [key: string]: any
    }
  }) {
    return this.get(`/properties/${propertyId}/bookings`, params)
  }

  /**
   * Get a specific booking
   * GET /properties/{property_id}/bookings/{booking_id}
   */
  async getBooking(propertyId: string, bookingId: string) {
    return this.get(`/properties/${propertyId}/bookings/${bookingId}`)
  }

  /**
   * Create a new booking
   * POST /properties/{property_id}/bookings
   */
  async createBooking(propertyId: string, bookingData: {
    arrival_date: string
    departure_date: string
    room_type_id: string
    rate_plan_id: string
    occupancy: {
      adults: number
      children?: number
      infants?: number
    }
    customer: {
      name: string
      surname: string
      email: string
      phone?: string
      [key: string]: any
    }
    [key: string]: any
  }) {
    return this.post(`/properties/${propertyId}/bookings`, bookingData)
  }

  /**
   * Update a booking
   * PUT /properties/{property_id}/bookings/{booking_id}
   */
  async updateBooking(propertyId: string, bookingId: string, bookingData: any) {
    return this.put(`/properties/${propertyId}/bookings/${bookingId}`, bookingData)
  }

  /**
   * Cancel a booking
   * DELETE /properties/{property_id}/bookings/{booking_id}
   */
  async cancelBooking(propertyId: string, bookingId: string) {
    return this.delete(`/properties/${propertyId}/bookings/${bookingId}`)
  }

  /**
   * Get booking revisions
   * GET /properties/{property_id}/bookings/{booking_id}/revisions
   */
  async getBookingRevisions(propertyId: string, bookingId: string) {
    return this.get(`/properties/${propertyId}/bookings/${bookingId}/revisions`)
  }

  /**
   * Get booking revisions feed
   * GET /booking_revisions/feed
   */
  async getBookingRevisionsFeed(params?: {
    page?: number
    per_page?: number
    filter?: {
      created_at_from?: string
      created_at_to?: string
      updated_at_from?: string
      updated_at_to?: string
      [key: string]: any
    }
  }) {
    return this.get('/booking_revisions/feed', params)
  }

  // =============================================================================
  // BOOKINGS API METHODS2
  // =============================================================================

  /**
 * List bookings for a property
 * GET /properties/{property_id}/bookings
 */
  async listBooking() {
    return this.get(`/bookings`)
  }

  async getBookingByFilter(params: {
    page: number,
    limit: number
  }) {
    return this.get(`/bookings?pagination[page]=${params.page}&pagination[limit]=${params.limit}`)
  }

  /**
   * Get a specific booking
   * GET /properties/{property_id}/bookings/{booking_id}
   */
  async getBookings(bookingId: string) {
    return this.get(`/bookings/${bookingId}`)
  }

  /**
   * Post Acknowledge Booking Revision receiving
   * POST /booking_revisions/${id}
   */

  async postAcknowledge(id: string) {
    return this.post(`/booking_revisions/${id}/ack`)
  }

  /**
* Get booking revisions
* GET /properties/{property_id}/bookings/{booking_id}/revisions
*/

  async getBookingRevision() {
    return this.get(`/booking_revisions`)
  }
  async getBookingRevisionById(id: string) {
    return this.get(`/booking_revisions/${id}`)
  }


  /**
* Get booking revisions feed
* GET /booking_revisions/feed
*/

  async getBookingRevisionFeed(params?: { property_id?: string }) {
    const filter = params && params.property_id ? `?filter[property_id]=${params.property_id}` : '';
    return this.get(`/booking_revisions/feed${filter}`);
  }




  // =============================================================================
  // WEBHOOKS API METHODS
  // =============================================================================

  /**
   * List webhooks for a property
   * GET /properties/{property_id}/webhooks
   */
  async listWebhooks(propertyId: string, params?: {
    page?: number
    per_page?: number
  }) {
    return this.get(`/properties/${propertyId}/webhooks`, params)
  }

  /**
   * Get a specific webhook
   * GET /properties/{property_id}/webhooks/{webhook_id}
   */
  async getWebhook(propertyId: string, webhookId: string) {
    return this.get(`/properties/${propertyId}/webhooks/${webhookId}`)
  }

  /**
   * Create a new webhook
   * POST /properties/{property_id}/webhooks
   */
  async createWebhook(propertyId: string, webhookData: {
    url: string
    events: string[]
    active?: boolean
    [key: string]: any
  }) {
    return this.post(`/properties/${propertyId}/webhooks`, webhookData)
  }

  /**
   * Update a webhook
   * PUT /properties/{property_id}/webhooks/{webhook_id}
   */
  async updateWebhook(propertyId: string, webhookId: string, webhookData: any) {
    return this.put(`/properties/${propertyId}/webhooks/${webhookId}`, webhookData)
  }

  /**
   * Delete a webhook
   * DELETE /properties/{property_id}/webhooks/{webhook_id}
   */
  async deleteWebhook(propertyId: string, webhookId: string) {
    return this.delete(`/properties/${propertyId}/webhooks/${webhookId}`)
  }

  // =============================================================================
  // GROUPS API METHODS
  // =============================================================================

  /**
   * List groups
   * GET /groups
   */
  async listGroups(params?: {
    page?: number
    per_page?: number
  }) {
    return this.get('/groups', params)
  }

  /**
   * Get a specific group
   * GET /groups/{group_id}
   */
  async getGroup(groupId: string) {
    return this.get(`/groups/${groupId}`)
  }

  /**
   * Create a new group
   * POST /groups
   */
  async createGroup(groupData: any) {
    return this.post('/groups', groupData)
  }

  /**
   * Update a group
   * PUT /groups/{group_id}
   */
  async updateGroup(groupId: string, groupData: any) {
    return this.put(`/groups/${groupId}`, groupData)
  }

  /**
   * Delete a group
   * DELETE /groups/{group_id}
   */
  async deleteGroup(groupId: string) {
    return this.delete(`/groups/${groupId}`)
  }

  // =============================================================================
  // PHOTOS API METHODS
  // =============================================================================

  /**
   * List photos for a property
   * GET /properties/{property_id}/photos
   */
  async listPhotos(propertyId: string, params?: {
    page?: number
    per_page?: number
  }) {
    return this.get(`/properties/${propertyId}/photos`, params)
  }

  /**
   * Upload a photo
   * POST /properties/{property_id}/photos
   */
  async uploadPhoto(propertyId: string, photoData: {
    photo: string // base64 encoded image
    kind: string
    position?: number
    [key: string]: any
  }) {
    return this.post(`/properties/${propertyId}/photos`, photoData)
  }

  /**
   * Update a photo
   * PUT /properties/{property_id}/photos/{photo_id}
   */
  async updatePhoto(propertyId: string, photoId: string, photoData: any) {
    return this.put(`/properties/${propertyId}/photos/${photoId}`, photoData)
  }

  /**
   * Delete a photo
   * DELETE /properties/{property_id}/photos/{photo_id}
   */
  async deletePhoto(propertyId: string, photoId: string) {
    return this.delete(`/properties/${propertyId}/photos/${photoId}`)
  }

  // =============================================================================
  // FACILITIES API METHODS
  // =============================================================================

  /**
   * List facilities for a property
   * GET /properties/{property_id}/facilities
   */
  async listFacilities(propertyId: string) {
    return this.get(`/properties/${propertyId}/facilities`)
  }

  /**
   * Update facilities for a property
   * PUT /properties/{property_id}/facilities
   */
  async updateFacilities(propertyId: string, facilitiesData: {
    facilities: string[]
    [key: string]: any
  }) {
    return this.put(`/properties/${propertyId}/facilities`, facilitiesData)
  }

  /**
   * Get a list of property facilities
   * GET /property_facilities
   */
  async listPropertyFacilities(params?: {
    page?: number
    per_page?: number
  }) {
    return this.get('/property_facilities', params)
  }

  /**
   * Get property facility options (all facilities without pagination)
   * GET /property_facilities/options
   */
  async getPropertyFacilityOptions() {
    return this.get('/property_facilities/options')
  }

  /**
   * Get a list of room type facilities
   * GET /room_facilities
   */
  async listRoomTypeFacilities(params?: {
    page?: number
    per_page?: number
  }) {
    return this.get('/room_facilities', params)
  }

  /**
   * Get room type facility options (all facilities without pagination)
   * GET /room_facilities/options
   */
  async getRoomTypeFacilityOptions() {
    return this.get('/room_facilities/options')
  }

  // =============================================================================
  // HOTEL POLICIES API METHODS
  // =============================================================================

  /**
   * Create a hotel policy
   * POST /hotel_policies
   */
  async createHotelPolicy(hotelPolicyData: {

    [key: string]: any
  }) {
    return this.post('/hotel_policies', { hotel_policy: hotelPolicyData })
  }

  /**
   * List hotel policies
   * GET /hotel_policies
   */
  async listHotelPolicies(params?: {
    page?: number
    per_page?: number
  }) {
    return this.get('/hotel_policies', params)
  }

  /**
   * Get a specific hotel policy
   * GET /hotel_policies/{policy_id}
   */
  async getHotelPolicy(policyId: string) {
    return this.get(`/hotel_policies/${policyId}`)
  }
  // =============================================================================
  // GROUPS API METHODS
  // =============================================================================


  // =============================================================================
  // REVIEWS API METHODS
  // =============================================================================

  /**
   * List reviews for a property
   * GET /properties/{property_id}/reviews
   */
  async listReviews(propertyId: string, params?: {
    page?: number
    per_page?: number
    filter?: any
  }) {
    return this.get(`/properties/${propertyId}/reviews`, params)
  }

  /**
   * Get a specific review
   * GET /properties/{property_id}/reviews/{review_id}
   */
  async getReview(propertyId: string, reviewId: string) {
    return this.get(`/properties/${propertyId}/reviews/${reviewId}`)
  }


  /**
   * Update a review response
   * PUT /properties/{property_id}/reviews/{review_id}
   */
  async updateReview(propertyId: string, reviewId: string, reviewData: {
    response?: string
    [key: string]: any
  }) {
    return this.put(`/properties/${propertyId}/reviews/${reviewId}`, reviewData)
  }

  // =============================================================================
  // MESSAGES API METHODS
  // =============================================================================

  /**
   * List messages for a property
   * GET /properties/{property_id}/messages
   */
  async listMessages(propertyId: string, params?: {
    page?: number
    per_page?: number
    filter?: any
  }) {
    return this.get(`/properties/${propertyId}/messages`, params)
  }

  /**
   * Get a specific message
   * GET /properties/{property_id}/messages/{message_id}
   */
  async getMessage(propertyId: string, messageId: string) {
    return this.get(`/properties/${propertyId}/messages/${messageId}`)
  }

  /**
   * Send a message
   * POST /properties/{property_id}/messages
   */
  async sendMessage(propertyId: string, messageData: {
    booking_id: string
    text: string
    [key: string]: any
  }) {
    return this.post(`/properties/${propertyId}/messages`, messageData)
  }

  /**
   * Mark message as read
   * PUT /properties/{property_id}/messages/{message_id}
   */
  async markMessageAsRead(propertyId: string, messageId: string) {
    return this.put(`/properties/${propertyId}/messages/${messageId}`, { read: true })
  }

  // =============================================================================
  // AUTHENTICATION & IFRAME API METHODS
  // =============================================================================

  /**
   * Generate a one-time access token for iframe authentication
   * POST /auth/one_time_token
   */
  async generateOneTimeToken(tokenData: {
    property_id: string
    group_id?: string
    username: string
  }) {
    return this.post('/auth/one_time_token', { one_time_token: tokenData })
  }

  /**
   * Generate iframe URL for channel mapping
   * This method fetches hotel data, generates a one-time token, and constructs the complete iframe URL
   */
  async generateIframeUrl(hotelId: string, options?: {
    channels?: string[]
    page?: string
    availableChannels?: string[]
    channelsFilter?: string[]
    allowNotificationsEdit?: boolean
    language?: 'en' | 'pt' | 'es' | 'ru' | 'de' | 'el' | 'it' | 'hu' | 'th'
    allowOpenBookings?: boolean
    username?: string
  }): Promise<string> {
    // Import Hotel model dynamically to avoid circular dependencies
    const { default: Hotel } = await import('../models/hotel.js')

    // Fetch hotel data
    const hotel = await Hotel.find(hotelId)
    if (!hotel) {
      throw new Error(`Hotel with ID ${hotelId} not found`)
    }

    // Check if hotel has been migrated to Channex
    if (!hotel.channexPropertyId || !hotel.channexGroupId) {
      throw new Error(`Hotel ${hotelId} has not been migrated to Channex yet`)
    }

    // Generate one-time token
    const tokenData = {
      property_id: hotel.channexPropertyId,
      group_id: hotel.channexGroupId,
      username: options?.username || 'admin'
    }

    const tokenResponse: any = await this.generateOneTimeToken(tokenData)
    const oneTimeToken = tokenResponse.data?.token

    if (!oneTimeToken) {
      throw new Error('Failed to generate one-time token')
    }

    // Construct iframe URL
    const baseUrl = this.baseURL
    const params = new URLSearchParams({
      oauth_session_key: oneTimeToken,
      app_mode: 'headless',
      redirect_to: options?.page || '/channels',
      property_id: hotel.channexPropertyId
    })

    // Add optional parameters
    if (hotel.channexGroupId) {
      params.append('group_id', hotel.channexGroupId)
    }

    if (options?.channels && options.channels.length > 0) {
      params.append('channels', options.channels.join(','))
    }

    if (options?.availableChannels && options.availableChannels.length > 0) {
      params.append('available_channels', options.availableChannels.join(','))
    }

    if (options?.channelsFilter && options.channelsFilter.length > 0) {
      params.append('channels_filter', options.channelsFilter.join(','))
    }

    if (options?.allowNotificationsEdit) {
      params.append('allow_notifications_edit', 'true')
    }

    if (options?.language) {
      params.append('lng', options.language)
    }

    if (options?.allowOpenBookings) {
      params.append('allow_open_bookings', 'true')
    }

    return `https://staging.channex.io/auth/exchange?${params.toString().replaceAll('%2F', '/')}`
  }
}