/**
 * Types pour l'intégration ZKTeco
 */

/**
 * Options de connexion à un terminal ZKTeco
 */
export interface ZKConnectionOptions {
  ip: string
  port: number
  timeout?: number
  inport?: number
}

/**
 * Informations d'un utilisateur à créer sur le terminal
 */
export interface ZKUserInfo {
  userId: string // ID unique (max 9 caractères numériques)
  name: string // Nom de l'utilisateur
  password?: string // Mot de passe (optionnel, 4-8 chiffres)
  cardNumber?: number // Numéro de carte RFID (optionnel)
  role?: number // Rôle: 0=Utilisateur normal, 14=Administrateur
}

/**
 * Données d'empreinte digitale
 */
export interface ZKFingerprintData {
  userId: string
  fingerIndex: number // Index du doigt (0-9)
  template: string // Template d'empreinte (format propriétaire ZKTeco)
  flag: number // Qualité/statut
}

/**
 * Log d'accès récupéré depuis le terminal
 */
export interface ZKAttendanceLog {
  userId: string
  timestamp: Date
  verifyMode: number
  inOutStatus: number
}

/**
 * Informations système du terminal
 */
export interface ZKDeviceInfo {
  serialNumber?: string
  firmwareVersion?: string
  platform?: string
  deviceName?: string
  userCount?: number
  logCount?: number
  faceCount?: number
  cardCount?: number
}

/**
 * Résultat d'une opération sur le terminal
 */
export interface ZKOperationResult {
  success: boolean
  message?: string
  data?: any
}

/**
 * Configuration pour la synchronisation
 */
export interface ZKSyncConfig {
  syncUsers?: boolean
  syncLogs?: boolean
  syncTime?: boolean
  clearLogsAfterSync?: boolean
}
