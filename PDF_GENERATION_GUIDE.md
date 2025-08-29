# Guide de Génération de PDF

Ce guide explique comment utiliser le système de génération de PDF intégré dans l'application pour créer des factures, reçus et documents personnalisés.

## Architecture du Système

### Services
- **PdfService** : Service principal pour la génération de PDF
- **PdfController** : Contrôleur API pour les endpoints de génération

### Technologies Utilisées
- **Puppeteer** : Pour la conversion HTML vers PDF
- **html-pdf-node** : Bibliothèque de génération PDF

## Endpoints API

### 1. Génération de Facture
```
POST /api/pdf/invoice
```

**Paramètres requis :**
```json
{
  "invoiceNumber": "INV-2024-001",
  "guestName": "John Doe",
  "guestAddress": "123 Main Street\nNew York, NY 10001",
  "hotelName": "Grand Hotel & Resort",
  "hotelAddress": "456 Luxury Avenue\nMiami, FL 33101",
  "issueDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [
    {
      "description": "Deluxe Room - 3 nights",
      "quantity": 3,
      "unitPrice": 150.00,
      "total": 450.00,
      "date": "2024-01-15"
    }
  ],
  "subtotal": 450.00,
  "tax": 45.00,
  "taxRate": 10,
  "total": 495.00,
  "currency": "$",
  "notes": "Merci pour votre séjour"
}
```

**Paramètres optionnels :**
- `format`: "A4" ou "Letter" (défaut: "A4")
- `orientation`: "portrait" ou "landscape" (défaut: "portrait")

### 2. Génération de Reçu
```
POST /api/pdf/receipt
```

**Paramètres requis :**
```json
{
  "receiptNumber": "REC-2024-001",
  "guestName": "Jane Smith",
  "hotelName": "Grand Hotel & Resort",
  "date": "2024-01-15 14:30:00",
  "items": [
    {
      "description": "Standard Room - 2 nights",
      "quantity": 2,
      "unitPrice": 120.00,
      "total": 240.00
    }
  ],
  "total": 240.00,
  "paymentMethod": "Credit Card",
  "currency": "$"
}
```

### 3. Génération de PDF Personnalisé
```
POST /api/pdf/custom
```

**Paramètres requis :**
```json
{
  "html": "<html><body><h1>Mon Document</h1></body></html>",
  "filename": "document-personnalise.pdf",
  "format": "A4",
  "orientation": "portrait",
  "margin": {
    "top": "1cm",
    "right": "1cm",
    "bottom": "1cm",
    "left": "1cm"
  }
}
```

### 4. Exemples de Test
```
GET /api/pdf/sample/invoice    # Génère une facture d'exemple
GET /api/pdf/sample/receipt    # Génère un reçu d'exemple
```

## Utilisation Programmatique

### Import du Service
```typescript
import { PdfService } from '#services/pdf_service'
```

### Génération de Facture
```typescript
const invoiceData = {
  invoiceNumber: 'INV-2024-001',
  guestName: 'John Doe',
  // ... autres données
}

const pdfBuffer = await PdfService.generateInvoicePdf(invoiceData)
```

### Génération de Reçu
```typescript
const receiptData = {
  receiptNumber: 'REC-2024-001',
  guestName: 'Jane Smith',
  // ... autres données
}

const pdfBuffer = await PdfService.generateReceiptPdf(receiptData)
```

### Génération depuis HTML
```typescript
const html = '<html><body><h1>Mon Document</h1></body></html>'
const options = {
  format: 'A4',
  orientation: 'portrait'
}

const pdfBuffer = await PdfService.generatePdfFromHtml(html, options)
```

## Interfaces TypeScript

### InvoiceData
```typescript
interface InvoiceData {
  invoiceNumber: string
  guestName: string
  guestAddress?: string
  hotelName: string
  hotelAddress?: string
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  subtotal: number
  tax?: number
  taxRate?: number
  total: number
  currency?: string
  notes?: string
}
```

### InvoiceItem
```typescript
interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  date?: string
}
```

### PdfOptions
```typescript
interface PdfOptions {
  format?: 'A4' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
}
```

## Templates HTML

### Template de Facture
Le service génère automatiquement un template HTML professionnel pour les factures avec :
- En-tête avec informations de l'hôtel et du client
- Tableau détaillé des articles
- Calculs de sous-total, taxes et total
- Pied de page avec notes
- Styles CSS intégrés

### Template de Reçu
Template simplifié pour les reçus avec :
- Informations essentielles
- Liste des articles
- Total et méthode de paiement
- Design compact

## Configuration

### Options PDF par Défaut
- **Format** : A4
- **Orientation** : Portrait
- **Marges** : 1cm sur tous les côtés
- **Qualité** : Haute résolution

### Personnalisation
Vous pouvez personnaliser :
- Les templates HTML
- Les styles CSS
- Les options de génération PDF
- Les formats de sortie

## Gestion des Erreurs

Le système gère automatiquement :
- Validation des données d'entrée
- Erreurs de génération PDF
- Timeouts de Puppeteer
- Problèmes de mémoire

### Codes d'Erreur Courants
- **400** : Données d'entrée invalides
- **500** : Erreur de génération PDF
- **503** : Service temporairement indisponible

## Performance

### Optimisations
- Réutilisation des instances Puppeteer
- Cache des templates HTML
- Compression des PDF générés
- Limitation de la mémoire utilisée

### Limites
- Taille maximale HTML : 5MB
- Timeout de génération : 30 secondes
- Formats supportés : A4, Letter

## Sécurité

### Mesures de Protection
- Validation stricte des entrées
- Sanitisation du HTML
- Limitation des ressources
- Pas d'exécution de JavaScript externe

## Exemples d'Utilisation

### Avec cURL
```bash
# Génération de facture d'exemple
curl -X GET http://localhost:3333/api/pdf/sample/invoice \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output sample-invoice.pdf

# Génération de facture personnalisée
curl -X POST http://localhost:3333/api/pdf/invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"invoiceNumber":"INV-001","guestName":"John Doe",...}' \
  --output invoice.pdf
```

### Avec JavaScript/Fetch
```javascript
const response = await fetch('/api/pdf/invoice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify(invoiceData)
})

const blob = await response.blob()
const url = window.URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'invoice.pdf'
a.click()
```

## Dépannage

### Problèmes Courants
1. **Puppeteer ne démarre pas** : Vérifiez les dépendances système
2. **PDF vide** : Vérifiez le HTML généré
3. **Timeout** : Réduisez la complexité du document
4. **Mémoire insuffisante** : Limitez le nombre de générations simultanées

### Logs
Les erreurs sont enregistrées dans les logs de l'application avec le préfixe `[PDF_SERVICE]`.

## Commandes Utiles

```bash
# Test de génération PDF
node ace pdf:test

# Nettoyage du cache Puppeteer
node ace pdf:cleanup

# Statistiques de performance
node ace pdf:stats
```

---

**Note** : Ce système nécessite que Puppeteer soit correctement installé avec toutes ses dépendances système.