// Script to generate iOS app icon from the Family Hub logo
// Run with: node scripts/generate-app-icon.js

const fs = require('fs');
const path = require('path');

async function generateIcon() {
  // Source logo - the designed icon
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');

  // Output paths for Capacitor iOS project
  const outputDir = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  const iosIconPath = path.join(outputDir, 'AppIcon-512@2x.png');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    console.error('Logo not found at:', logoPath);
    console.log('Please place your logo PNG at assets/logo.png');
    console.log('The logo should be at least 1024x1024 pixels');
    process.exit(1);
  }

  console.log('Using logo from:', logoPath);

  // Generate icons using sharp
  try {
    const sharp = require('sharp');

    // Generate main iOS icon (1024x1024) - MUST be opaque (no alpha channel)
    // Flatten onto teal background to remove any transparency (matches icon design)
    await sharp(logoPath)
      .resize(1024, 1024)
      .flatten({ background: { r: 20, g: 184, b: 166 } }) // #14b8a6 - teal-500
      .png()
      .toFile(iosIconPath);
    console.log('iOS App icon (1024x1024) created at:', iosIconPath);

    console.log('\nApp icon generated successfully!');

  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('\nSharp module not found. Install it with: npm install sharp --save-dev');
      console.log('Skipping icon generation - using existing icon from repo.');
      // Don't exit with error - let the build continue with existing icon
    } else {
      console.error('Error generating icon:', e.message);
      process.exit(1);
    }
  }
}

generateIcon().catch(console.error);
