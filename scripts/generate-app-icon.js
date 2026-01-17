// Script to generate iOS app icon from the favicon design
// Run with: node scripts/generate-app-icon.js

const fs = require('fs');
const path = require('path');

// Try to use sharp for PNG generation, fall back to SVG output
async function generateIcon() {
  const size = 1024;
  const iconScale = 0.5; // Icon takes up 50% of the image

  // Create the SVG matching our favicon design
  const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#14b8a6"/>
      <stop offset="100%" style="stop-color:#0d9488"/>
    </linearGradient>
  </defs>
  <!-- Background - no rounded corners for iOS (system applies mask) -->
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <!-- House icon - centered and scaled -->
  <g transform="translate(${size * 0.25}, ${size * 0.25}) scale(${size * iconScale / 24})">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          fill="none"
          stroke="white"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"/>
    <polyline points="9 22 9 12 15 12 15 22"
              fill="none"
              stroke="white"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"/>
  </g>
</svg>`;

  // Output paths
  const outputDir = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  const svgPath = path.join(outputDir, 'AppIcon.svg');
  const pngPath = path.join(outputDir, 'AppIcon-512@2x.png');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write SVG file as backup
  fs.writeFileSync(svgPath, svgIcon);
  console.log('SVG icon created at:', svgPath);

  // Try to generate PNG using sharp
  try {
    const sharp = require('sharp');

    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(pngPath);

    console.log('PNG icon created at:', pngPath);
    console.log('\nApp icon generated successfully!');

    // Clean up SVG (we only need the PNG)
    fs.unlinkSync(svgPath);

  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('\nSharp module not found. Install it with: npm install sharp --save-dev');
      console.log('\nAlternatively, convert the SVG manually using:');
      console.log('1. Online: https://cloudconvert.com/svg-to-png (set 1024x1024)');
      console.log('2. ImageMagick: convert AppIcon.svg -resize 1024x1024 AppIcon-512@2x.png');
      console.log('3. Inkscape: inkscape -w 1024 -h 1024 AppIcon.svg -o AppIcon-512@2x.png');
      console.log('\nThen place the PNG at:', pngPath);
    } else {
      console.error('Error generating PNG:', e.message);
      console.log('\nPlease convert the SVG manually using an online converter.');
    }
  }
}

generateIcon().catch(console.error);
