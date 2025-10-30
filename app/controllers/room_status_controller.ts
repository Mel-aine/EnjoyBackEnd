import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import RoomType from '#models/room_type'
import CleaningStatus from '#models/cleaning_status'
import { createRoomStatusReportValidator } from '#validators/room_status_report'
import PdfService from '#services/pdf_service'

import logger from '@adonisjs/core/services/logger'
import edge from 'edge.js'
import { join } from 'node:path'

export default class RoomStatusReportsController {    
  /**
   * Génère les données du rapport en JSON
   */
  async generateRoomsByStatus({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createRoomStatusReportValidator)
      const { date, hotelId } = payload

      const reportData = await this.getRoomStatusReportData(date, hotelId, auth)

      return response.ok({
        success: true,
        message: 'Rapport des statuts des chambres généré avec succès',
        data: reportData.responseData,
        filters: {
          date,
          hotelId
        },
        generatedAt: DateTime.now().toISO(),
        generatedBy: reportData.generatedBy
      })

    } catch (error) {
      logger.error('Error generating room status report:', error)
      
      console.error('Error generating room status report', {
        error: error.message,
        stack: error.stack,
        userId: auth.user?.id,
        hotelId: request.body().hotelId
      })

      return response.badRequest({
        success: false,
        message: 'Échec de la génération du rapport des statuts des chambres',
        error: error.message
      })
    }
  }

  /**
   * Génère le rapport en PDF
   */
  async generateRoomsByStatusPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createRoomStatusReportValidator)
      const { date, hotelId } = payload

      const reportData = await this.getRoomStatusReportData(date, hotelId, auth)
      const pdfBuffer = await this.generatePdfBuffer(reportData)

      console.log('data@@@@', reportData )
      if (!pdfBuffer) {
        throw new Error('Échec de la génération du PDF')
      }

      // Retourner directement le PDF
      response.header('Content-Type', 'application/pdf')
      response.header(
        'Content-Disposition', 
        `inline; filename="rapport-statut-chambres-${reportData.reportDate.toFormat('yyyy-MM-dd')}.pdf"`
      )
      return response.send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating room status PDF report:', error)
      console.log(error)
      return response.badRequest({
        success: false,
        message: 'Échec de la génération du PDF du rapport',
        error: error.message
      })
    }
  }

  /**
   * Fonction utilitaire pour récupérer les données du rapport
   */
  private async getRoomStatusReportData(date: string, hotelId: number, auth: HttpContext['auth']) {
    const reportDate = DateTime.fromISO(date)

    if (!reportDate.isValid) {
      throw new Error('La date fournie est invalide')
    }

    // Récupérer les informations de l'hôtel
    const hotel = await Hotel.findOrFail(hotelId)

    // Récupérer tous les types de chambres de l'hôtel avec leurs chambres
    const roomTypes = await RoomType.query()
      .where('hotel_id', hotelId)
      .where('is_deleted', false)
      .preload('rooms', (roomQuery) => {
        roomQuery
          .where('isDeleted', false)
          .preload('assignedHousekeeper')
          .orderBy('sort_key', 'asc')
          .orderBy('roomNumber', 'asc')
      })
      .orderBy('room_type_name', 'asc')

    // Récupérer tous les statuts de nettoyage pour la date spécifiée
    const cleaningStatuses = await CleaningStatus.query()
      .whereHas('room', (roomQuery) => {
        roomQuery.where('hotelId', hotelId)
      })
      .where('status_changed_at', reportDate.toSQLDate())

    // Créer une map pour accéder rapidement aux statuts de nettoyage par roomId
    const cleaningStatusMap = new Map()
    cleaningStatuses.forEach(status => {
      cleaningStatusMap.set(status.roomId, status)
    })

    // Fonction pour déterminer le code de statut
    const getStatusCode = (roomStatus: string, housekeepingStatus: string): string => {
      const isClean = housekeepingStatus?.toLowerCase() === 'clean' || 
                     housekeepingStatus?.toLowerCase() === 'propre'
      
      const isDirty = housekeepingStatus?.toLowerCase() === 'dirty' ||
                     housekeepingStatus?.toLowerCase() === 'sale'
      
      // Normaliser le roomStatus
      const normalizedStatus = roomStatus?.toLowerCase()
      
      switch (normalizedStatus) {
        case 'occupied':
          if (isClean) return 'OP'
          if (isDirty) return 'OS'
          return 'None'
        
        case 'available':
          if (isClean) return 'LP'
          if (isDirty) return 'LS'
          return 'None'
        
        case 'arrival':
        case 'arriving':
          return 'AR'
        
        case 'departure':
        case 'departing':
          return 'DP'
        
        case 'late_departure':
        case 'late_checkout':
          return 'DT'
        
        case 'eviction':
        case 'evicted':
          return 'DL'
        
        case 'reserved':
        case 'reservation':
          return 'RS'
        
        case 'out_of_order':        
        case 'out_of_service':
          return 'HS'
        
        default:
          return 'None'
      }
    }

    // Compteurs pour les statistiques globales
    let statsCount = {
      OP: 0,  // Occupé Propre
      OS: 0,  // Occupé Sale
      LP: 0,  // Libre Propre
      LS: 0,  // Libre Sale
      AR: 0,  // Arrivée
      DP: 0,  // Départ
      DT: 0,  // Départ Tardif
      DL: 0,  // Délogement
      RS: 0,  // Réservation
      HS: 0,  // Hors Service
      RM: 0   // Refus Ménage
    }

    // Construire les données par type de chambre
    const roomsByType = roomTypes.map(roomType => {
      const roomsData = roomType.rooms.map(room => {
        const cleaningStatus = cleaningStatusMap.get(room.id)
        
        // Récupérer les remarques du jour
        const housekeepingRemarks = room.housekeepingRemarks || []
        const todayRemarks = housekeepingRemarks
          .filter(remark => {
            const remarkDate = DateTime.fromJSDate(new Date(remark.date))
            return remarkDate.hasSame(reportDate, 'day')
          })
          .map(remark => remark.remark)
          .join('; ')

        // Combiner toutes les observations
        const observations = [
          todayRemarks,
          cleaningStatus?.notes,
          room.maintenanceNotes,
          room.outOfOrderReason
        ].filter(Boolean).join(' | ')

        // Déterminer l'état matin et soir avec les codes de statut
        const etatMatin = cleaningStatus?.morningStatus || getStatusCode(room.status, room.housekeepingStatus)
        const etatSoir = cleaningStatus?.eveningStatus || getStatusCode(room.status, room.housekeepingStatus)
        
        // Compter CHAQUE apparition séparément (matin ET soir)
        if (statsCount.hasOwnProperty(etatMatin) && etatMatin !== 'None') {
          statsCount[etatMatin]++
        }
        if (statsCount.hasOwnProperty(etatSoir) && etatSoir !== 'None') {
          statsCount[etatSoir]++
        }
        
        // Vérifier si refus ménage dans les observations
        if (observations.toLowerCase().includes('refus ménage') || 
            observations.toLowerCase().includes('refus menage') ||
            observations.toLowerCase().includes('rm')) {
          statsCount.RM++
        }

        return {
          roomId: room.id,
          roomNumber: room.roomNumber,
          floor: room.floorNumber || room.floor || null,
          etatMatin: etatMatin,
          etatSoir: etatSoir,
          occupancyStatus: room.status,
          housekeepingStatus: room.housekeepingStatus || 'Non défini',
          observations: observations || '',
          assignedHousekeeper: room.assignedHousekeeper ? 
            `${room.assignedHousekeeper.firstName} ${room.assignedHousekeeper.lastName}` : 
            'Non assigné',
          lastCleaned: cleaningStatus?.updatedAt?.toFormat('HH:mm') || null,
          maintenanceRequired: room.status === 'out_of_order' || !!room.outOfOrderReason,
          outOfOrderFrom: room.outOfOrderFrom?.toFormat('dd/MM/yyyy HH:mm') || null,
          outOfOrderTo: room.outOfOrderTo?.toFormat('dd/MM/yyyy HH:mm') || null
        }
      })

      return {
        roomTypeId: roomType.id,
        roomTypeName: roomType.roomTypeName,
        shortCode: roomType.shortCode,
        totalRooms: roomsData.length,
        rooms: roomsData
      }
    })

    // Calculer les statistiques globales
    const totalRooms = roomsByType.reduce((sum, type) => sum + type.totalRooms, 0)
    const totalWithObservations = roomsByType.reduce((sum, type) => 
      sum + type.rooms.filter(room => room.observations !== '').length, 0
    )

    // Calculer le cumul HSH-LS (Hors Service + Libre Sale)
    const cumulHshLs = statsCount.HS + statsCount.LS

    // Préparer la réponse avec toutes les données
    const responseData = {
      hotelDetails: {
        hotelId: hotel.id,
        hotelName: hotel.hotelName,
        address: hotel.address,
        email: hotel.email,
        phone: hotel.phone || '',
        logo: hotel.logo || ''
      },
      reportDate: reportDate.toFormat('yyyy-MM-dd'),
      dateFormatted: reportDate.toFormat('dd MMMM yyyy', { locale: 'fr' }),
      roomsByType,
      statistics: {
        totalRoomTypes: roomsByType.length,
        totalRooms,
        totalWithObservations,
        statusBreakdown: statsCount,
        cumulNuitee: {
          total: totalRooms,
          hshLs: cumulHshLs
        },
        // Format exact comme demandé
        legend: [
          `OP : OCCUPE PROPRE ${statsCount.OP.toString().padStart(2, '0')}  OS : OCCUPER SALE ${statsCount.OS.toString().padStart(2, '0')}`,
          `LP : LIBRE PROPRE ${statsCount.LP.toString().padStart(2, '0')}  LS : LIBRE SALE ${statsCount.LS.toString().padStart(2, '0')}`,
          `AR : Arrivée ${statsCount.AR.toString().padStart(2, '0')}  DP : Départ ${statsCount.DP.toString().padStart(2, '0')}`,
          `DT : Départ tardif ${statsCount.DT.toString().padStart(2, '0')}  DL : Délogement ${statsCount.DL.toString().padStart(2, '0')}`,
          `RS :  Réservation ${statsCount.RS.toString().padStart(2, '0')}  HS : HORS SERVICE ${statsCount.HS.toString().padStart(2, '0')}`,
          `CN : CUMULE Nuitée ${totalRooms} HSH-LS ${cumulHshLs}  RM : Refus ménage ${statsCount.RM.toString().padStart(2, '0')}`
        ]
      }
    }

    const generatedBy = auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : 'Système'

    return {
      responseData,
      hotel,
      reportDate,
      generatedBy
    }
  }

  /**
   * Fonction utilitaire pour générer le buffer PDF
   */
  private async generatePdfBuffer(reportData: any): Promise<Buffer | null> {
    try {
      // Configuration d'Edge pour les templates
      edge.mount(join(process.cwd(), 'resources/views'))

      // Ajouter la fonction helper formatNumber
      edge.global('formatNumber', (number) => {
        if (!number && number !== 0) return '0'
        const num = parseFloat(number)
        return new Intl.NumberFormat('fr-FR').format(num)
      })

      // Préparer les données pour le template
      const templateData = {
        hotel: reportData.hotel,
        ...reportData.responseData,
        currentDate: DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss'),
        currency: reportData.hotel.currencyCode || 'XAF',
        hotelName: reportData.hotel.hotelName,
        generatedBy: reportData.generatedBy,
        generatedAt: DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')
      }
      
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Render le template Edge pour le rapport de statut des chambres
      const html = await edge.render('reports/room_status_reports', templateData)
      const headerTemplate = `
      <div style="font-size:10px; width:100%; padding:3px 20px; margin:0;">
        <!-- Hotel name and report title -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:1px solid #333; margin-bottom:3px;">
          <div style="font-weight:bold; color:#00008B; font-size:13px;">${templateData.hotelName}</div>
          <div style="font-size:13px; color:#8B0000; font-weight:bold;">Room Status Report</div>
        </div>

        <div style="font-size:10px; margin-bottom:3px; border-bottom:1px solid #333;">
          <span style="margin-right:10px;"><strong>Report of the </strong> ${templateData.dateFormatted}</span>
        </div>
      `
      // Create footer template
      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${templateData.generatedAt}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${templateData.generatedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>`

      // Générer le PDF à partir du HTML
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(html, {
        format: 'A4', 
        margin: {
          top: '90px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        printBackground: true
      })

      return pdfBuffer

    } catch (pdfError) {
      logger.error('Error generating PDF buffer:', pdfError)
      return null
    }
  }

}