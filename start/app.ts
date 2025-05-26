// import cron from 'node-cron'
// import AutoReleaseRooms from '@/commands/auto_release_rooms'

// cron.schedule('0 0 * * *', async () => {
//   const command = new AutoReleaseRooms()
//   await command.run()
//   console.log('Tâche de libération automatique exécutée à', new Date().toLocaleString())
// })
import cron from 'node-cron'
import { exec } from 'child_process'

cron.schedule('0 0 * * *', () => {
  console.log('Déclenchement de la libération automatique des chambres...')
  exec('node ace auto:release-rooms', (error, stdout, stderr) => {
    if (error) {
      console.error(`Erreur lors de l’exécution: ${error.message}`)
      return
    }
    if (stderr) {
      console.error(`Erreur dans la sortie : ${stderr}`)
      return
    }
    console.log(`Résultat : ${stdout}`)
  })
})
