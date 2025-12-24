const cloudinary = require('cloudinary').v2;
const {CloudinaryStorage}=require("multer-storage-cloudinary");


cloudinary.config({ 
  cloud_name: process.env.CLOUD_API_NAME, 
  api_key: process.env.CLOUD_API_KEY, 
  api_secret:process.env.CLOUD_API_SECRET
});

const storage=new CloudinaryStorage({
    cloudinary:cloudinary,
    params:{
        folder:"expense_DEV",
        allowed_formats: ["jpg", "png", "jpeg", "heic", "heif"],
        public_id: (req, file) => `receipt-${Date.now()}`
    }
});

module.exports={
    cloudinary,
    storage
}