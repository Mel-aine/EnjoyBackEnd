// import env from '#start/env'
// import { v2 as cloudinary } from 'cloudinary'

// cloudinary.config({
//   cloud_name: env.get('CLOUDINARY_CLOUD_NAME'),
//   api_key: env.get('CLOUDINARY_API_KEY'),
//   api_secret: env.get('CLOUDINARY_API_SECRET'),
// })

// export default class CloudinaryService {
//   public static async uploadImage(filePath: string) {
//     const result = await cloudinary.uploader.upload(filePath, {
//       folder: 'uploads',
//     })

//     return {
//       url: result.secure_url,
//       publicId: result.public_id,
//     }
//   }

//   public static async deleteImage(publicId: string) {
//     await cloudinary.uploader.destroy(publicId)
//   }
// }
