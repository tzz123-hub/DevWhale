const fs = require('fs');
const zlib = require('zlib');

// Read PNG
const buf = fs.readFileSync('C:/Users/DELL/Desktop/TUI/codewhale-windows-x64/bob前端/build/logo.png');

// Parse PNG chunks - extract only IHDR + IDAT + IEND, strip all other chunks (metadata, color profiles, etc.)
let pos = 8; // skip PNG signature
const chunks = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.slice(pos + 8, pos + 8 + len);
  const crc = buf.readUInt32BE(pos + 8 + len);
  chunks.push({ type, data, len });
  pos += 12 + len;
}

// Keep essential chunks only
const keep = chunks.filter(c => ['IHDR', 'IDAT', 'IEND', 'PLTE', 'tRNS'].includes(c.type));

// Rebuild minimal PNG
const out = [buf.slice(0, 8)]; // PNG signature
for (const c of keep) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(c.data.length, 0);
  header.write(c.type, 4, 4, 'ascii');
  // CRC
  const crcData = Buffer.concat([header.slice(4), c.data]);
  const crc = crc32(crcData);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(crc, 0);
  out.push(header, c.data, footer);
}

const result = Buffer.concat(out);
console.log(`Original: ${buf.length} bytes`);
console.log(`Minimal: ${result.length} bytes`);
console.log(`Reduction: ${((1 - result.length/buf.length)*100).toFixed(1)}%`);

fs.writeFileSync('C:/Users/DELL/Desktop/TUI/codewhale-windows-x64/bob前端/build/logo.png', result);

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
