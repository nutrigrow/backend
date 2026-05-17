const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sanitizeFilenamePrefix = (value, fallback) => {
    const sanitized = String(value || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return sanitized || fallback;
};

const compressAndSaveImage = async (buffer, folder, filenamePrefix = 'image') => {
    const safeFolder = String(folder || '').replace(/[^a-z0-9_-]/gi, '');
    const safePrefix = sanitizeFilenamePrefix(filenamePrefix, 'image');
    const uploadPath = path.join(__dirname, '../../public/uploads', safeFolder || 'images');

    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    const filename = `${safePrefix}-${Date.now()}.webp`;
    const filepath = path.join(uploadPath, filename);

    await sharp(buffer)
        .resize(800, 800, {
            fit: sharp.fit.inside,
            withoutEnlargement: true
        })
        .webp({ quality: 80 })
        .toFile(filepath);

    return `/public/uploads/${safeFolder || 'images'}/${filename}`;
};

/**
 * Compresses an image and saves it to a specified directory.
 * Best practice: convert to WebP, resize max width/height, quality 80 for good balance.
 * Expected result: image sizes typically 50KB - 150KB.
 * 
 * @param {Buffer} buffer - Multer file buffer
 * @param {string} filenamePrefix - Prefix for the filename (e.g. 'product')
 * @returns {Promise<string>} The relative path for URL (e.g. '/public/uploads/products/product-123.webp')
 */
const compressAndSaveProductImage = async (buffer, filenamePrefix = 'product') => {
    return compressAndSaveImage(buffer, 'products', filenamePrefix);
};

const compressAndSaveArticleImage = async (buffer, filenamePrefix = 'article') => {
    return compressAndSaveImage(buffer, 'articles', filenamePrefix);
};

module.exports = {
    compressAndSaveImage,
    compressAndSaveProductImage,
    compressAndSaveArticleImage
};
