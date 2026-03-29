const multer = require('multer');
const ApiError = require('../utils/ApiError');

// We use memory storage so we can compress it with sharp before saving it to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(ApiError.badRequest('Hanya file gambar yang diperbolehkan!'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // Batas 2MB, best practice agar server tidak berat menerima file mentah.
    }
});

module.exports = upload;
