const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsDirectory = path.join(__dirname, "uploads");
const brandsDirectory = path.join(uploadsDirectory, "brands");

[uploadsDirectory, brandsDirectory].forEach((directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
});

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

function imageUpload({ directory = uploadsDirectory, maxFiles = 9, allowSvg = false } = {}) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, callback) => callback(null, directory),
      filename: (req, file, callback) =>
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${EXTENSIONS[file.mimetype]}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: maxFiles },
    fileFilter: (req, file, callback) => {
      const allowed = Object.keys(EXTENSIONS).filter((type) => allowSvg || type !== "image/svg+xml");

      if (!allowed.includes(file.mimetype)) {
        return callback(new Error("Only JPG, PNG and WEBP images are allowed."));
      }

      callback(null, true);
    },
  });
}

function uploadErrorMessage(error, maxFiles = 9) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") return "Each image must be 5 MB or smaller.";
    if (error.code === "LIMIT_FILE_COUNT") return `You can upload a maximum of ${maxFiles} images.`;
    if (error.code === "LIMIT_UNEXPECTED_FILE") return "Unexpected image field or too many images.";
  }

  return error.message;
}

function publicPath(file, folder = "") {
  return `/uploads/${folder ? `${folder}/` : ""}${file.filename}`;
}

function removeUpload(imagePath) {
  if (typeof imagePath !== "string" || !imagePath.startsWith("/uploads/")) {
    return;
  }

  const absolute = path.join(__dirname, imagePath);

  if (absolute.startsWith(uploadsDirectory) && fs.existsSync(absolute)) {
    fs.unlinkSync(absolute);
  }
}

function removeFiles(files) {
  [files].flat(2).filter(Boolean).forEach((group) => {
    Object.values(group.fieldname ? { file: group } : group)
      .flat()
      .forEach((file) => {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
  });
}

// Multer trusts the declared Content-Type; this reads the first bytes of a stored file and confirms it is really a
// JPEG, PNG, WEBP (or an SVG/XML text file where SVG is allowed). Defence in depth so a forged content-type can't
// leave a non-image in the uploads folder.
function looksLikeImage(filePath) {
  let fd;

  try {
    fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(12);

    fs.readSync(fd, header, 0, 12, 0);

    if (header.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return true; // JPEG
    if (header.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
    if (header.slice(0, 4).toString("ascii") === "RIFF" && header.slice(8, 12).toString("ascii") === "WEBP") return true; // WEBP

    const text = header.toString("utf8").replace(/^\uFEFF/, "").trimStart().toLowerCase();

    return text.startsWith("<?xml") || text.startsWith("<svg"); // SVG / XML
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // already closed
      }
    }
  }
}

// Express middleware to run after multer: drop the request if any stored file is not really an image.
function verifyImageBytes(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);

  if (files.some((file) => !looksLikeImage(file.path))) {
    removeFiles(req.files || req.file);
    return res.status(400).json({ message: "Only real JPG, PNG and WEBP images are allowed.", field: "images" });
  }

  next();
}

module.exports = {
  uploadsDirectory,
  brandsDirectory,
  imageUpload,
  uploadErrorMessage,
  publicPath,
  removeUpload,
  removeFiles,
  looksLikeImage,
  verifyImageBytes,
};
