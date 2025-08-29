# Guide d'Intégration du Système d'Envoi d'Emails

## Configuration

### 1. Variables d'Environnement

Ajoutez les variables suivantes dans votre fichier `.env` :

```env
# Configuration SendGrid (Recommandé)
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Configuration SMTP Alternative
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Configuration Générale
MAIL_FROM_ADDRESS=noreply@yourhotel.com
MAIL_FROM_NAME="Your Hotel Name"
```

### 2. Configuration SendGrid

1. Créez un compte sur [SendGrid](https://sendgrid.com/)
2. Générez une clé API dans les paramètres
3. Remplacez `your_sendgrid_api_key_here` par votre vraie clé API
4. Vérifiez votre domaine d'envoi dans SendGrid

### 3. Configuration SMTP Alternative

Pour Gmail :
1. Activez l'authentification à deux facteurs
2. Générez un mot de passe d'application
3. Utilisez ce mot de passe dans `SMTP_PASSWORD`

## Utilisation

### 1. API Endpoints de Test

#### Tester la Configuration Email
```bash
POST /api/email-test/configuration
Content-Type: application/json

{
  "email": "test@example.com"
}
```

#### Tester un Template Email
```bash
POST /api/email-test/template
Content-Type: application/json

{
  "templateName": "invoice_city_ledger",
  "email": "test@example.com",
  "data": {
    "guest_name": "John Doe",
    "invoice_number": "INV-001",
    "amount": "$150.00",
    "due_date": "2024-02-15"
  }
}
```

#### Mettre un Email en File d'Attente
```bash
POST /api/email-test/queue
Content-Type: application/json

{
  "templateName": "reservation_confirmation",
  "email": "guest@example.com",
  "data": {
    "guest_name": "Jane Smith",
    "reservation_number": "RES-123",
    "check_in_date": "2024-02-20",
    "check_out_date": "2024-02-25"
  }
}
```

#### Obtenir le Statut du Service Email
```bash
GET /api/email-test/status
```

### 2. Utilisation Programmatique

#### EmailService

```typescript
import { EmailService } from '#services/email_service'

// Envoyer un email direct
const result = await EmailService.sendEmail({
  to: 'recipient@example.com',
  subject: 'Test Email',
  html: '<h1>Hello World</h1>'
})

// Envoyer un email avec template
const templateResult = await EmailService.sendTemplateEmail(
  'invoice_city_ledger',
  'customer@example.com',
  {
    guest_name: 'John Doe',
    invoice_number: 'INV-001',
    amount: '$150.00'
  }
)
```

#### EmailQueueService

```typescript
import { EmailQueueService } from '#services/email_queue_service'

// Ajouter un email à la file d'attente
const queuedEmail = await EmailQueueService.queueEmail(
  'payment_reminder_30_days',
  'customer@example.com',
  {
    guest_name: 'Jane Smith',
    amount_due: '$75.00',
    due_date: '2024-02-15'
  }
)
```

### 3. Worker Email

#### Démarrer le Worker
```bash
node ace start:email:worker
```

Le worker traite automatiquement :
- Les emails en attente
- Les emails échoués (avec retry automatique)
- Logging des résultats

## Templates Pré-configurés

### 1. invoice_city_ledger
**Variables disponibles :**
- `{{guest_name}}` - Nom du client
- `{{invoice_number}}` - Numéro de facture
- `{{amount}}` - Montant
- `{{due_date}}` - Date d'échéance
- `{{hotel_name}}` - Nom de l'hôtel

### 2. payment_reminder_30_days
**Variables disponibles :**
- `{{guest_name}}` - Nom du client
- `{{amount_due}}` - Montant dû
- `{{due_date}}` - Date d'échéance
- `{{hotel_name}}` - Nom de l'hôtel

### 3. reservation_confirmation
**Variables disponibles :**
- `{{guest_name}}` - Nom du client
- `{{reservation_number}}` - Numéro de réservation
- `{{check_in_date}}` - Date d'arrivée
- `{{check_out_date}}` - Date de départ
- `{{hotel_name}}` - Nom de l'hôtel

## Monitoring et Logs

### Vérifier le Statut de la File d'Attente
```bash
GET /api/emails/status
```

### Historique des Emails
```bash
GET /api/emails/history?page=1&limit=20
```

### Retry des Emails Échoués
```bash
POST /api/emails/{id}/retry
```

## Dépannage

### Erreurs Communes

1. **"Authentication failed"**
   - Vérifiez vos identifiants SendGrid/SMTP
   - Assurez-vous que la clé API est valide

2. **"Template not found"**
   - Vérifiez que le template existe dans la base de données
   - Utilisez l'endpoint `/api/email-templates` pour lister les templates

3. **"Email sending failed"**
   - Vérifiez la configuration réseau
   - Consultez les logs du worker

### Logs

Les logs du worker sont disponibles dans la console lors de l'exécution :
```bash
node ace start:email:worker
```

## Sécurité

- Ne jamais committer les clés API dans le code
- Utilisez des variables d'environnement
- Limitez les permissions des clés API SendGrid
- Validez toujours les adresses email avant envoi

## Performance

- Le worker traite les emails de manière asynchrone
- Retry automatique pour les emails échoués
- Limitation du taux d'envoi selon les limites du provider
- Monitoring des performances via les endpoints de statut