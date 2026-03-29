const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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
    // 1. Ensure directory exists
    const uploadPath = path.join(__dirname, '../../public/uploads/products');
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    // 2. Generate unique filename
    const filename = `${filenamePrefix}-${Date.now()}.webp`;
    const filepath = path.join(uploadPath, filename);

    // 3. Compress with Sharp
    await sharp(buffer)
        .resize(800, 800, {
            fit: sharp.fit.inside,
            withoutEnlargement: true // Don't enlarge if image is smaller than 800x800
        })
        .webp({ quality: 80 })
        .toFile(filepath);

    // 4. Return URL path
    return `/public/uploads/products/${filename}`;
};

module.exports = {
    compressAndSaveProductImage
};
