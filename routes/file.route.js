const express = require("express");
const multer = require("multer");
const path = require('path');
const fs = require('fs');
const {uploadFile} = require("../controllers/file.controller");
const { protect } = require('../middlewares/auth.middleware');
const router = express.Router();

// Prepare uploads folder on startup
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {recursive: true});
}

// Config multer for that uploads folder
const storage = multer.diskStorage({
    // Destination
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir)
    },
    // Filename
    filename: (_req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);

        cb(null, uniqueName + path.extname(file.originalname));
    }
});

// Create Multer middleware for file uploads
const upload = multer({
    storage, 
    limits: {fileSize: 10 * 1024 * 1024} // 10MB
});

// Create new endpoint for upload
router.post('/upload', protect, upload.single('file'), uploadFile);

module.exports = router;