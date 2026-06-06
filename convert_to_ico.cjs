const fs = require('fs');
const path = require('path');

// PNG to ICO conversion function
// ICO file format: https://en.wikipedia.org/wiki/ICO_(file_format)

function pngToIco(pngPath, icoPath) {
  // Read PNG file
  const pngData = fs.readFileSync(pngPath);
  
  // Create ICO file with PNG data embedded
  // ICO header: 6 bytes
  // ICO directory entry: 16 bytes per image
  // Image data: PNG data
  
  const numImages = 1;
  const headerSize = 6 + (16 * numImages);
  
  // Create header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved (must be 0)
  header.writeUInt16LE(1, 2);      // Image type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images
  
  // Get PNG dimensions
  // PNG signature is 8 bytes, IHDR chunk starts at byte 8
  const width = pngData.readUInt32BE(16);
  const height = pngData.readUInt32BE(20);
  
  // Create directory entry (16 bytes)
  const directory = Buffer.alloc(16);
  directory.writeUInt8(width >= 256 ? 0 : width, 0);   // Width (0 = 256)
  directory.writeUInt8(height >= 256 ? 0 : height, 1);  // Height (0 = 256)
  directory.writeUInt8(0, 2);      // Color palette (0 = no palette)
  directory.writeUInt8(0, 3);      // Reserved
  directory.writeUInt16LE(1, 4);    // Color planes
  directory.writeUInt16LE(32, 6);   // Bits per pixel
  directory.writeUInt32LE(pngData.length, 8);  // Image data size
  directory.writeUInt32LE(headerSize, 12);     // Offset to image data
  
  // Combine all parts
  const ico = Buffer.concat([header, directory, pngData]);
  
  // Write ICO file
  fs.writeFileSync(icoPath, ico);
  
  console.log(`转换完成！ICO文件已保存到: ${icoPath}`);
  console.log(`原图尺寸: ${width}x${height}像素`);
}

// Paths
const pngPath = 'C:\\Users\\DELL\\Desktop\\w.ico';
const icoPath = 'C:\\Users\\DELL\\bob-desk\\app_icon.ico';

// Convert
pngToIco(pngPath, icoPath);
