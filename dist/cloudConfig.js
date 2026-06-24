"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.cloudinary = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUD_API_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: "expense_DEV",
        allowed_formats: ["jpg", "png", "jpeg", "heic", "heif"],
        public_id: (req, file) => `receipt-${Date.now()}`
    } // Cast to any because CloudinaryStorage params type might be strict or missing exact match for 'folder' in some versions
});
exports.storage = storage;
