import sharp from "sharp";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// App Store screenshot dimensions
const DIMENSIONS = {
  "6.7": { width: 1290, height: 2796 }, // iPhone 15 Pro Max, 14 Pro Max
  "6.5": { width: 1284, height: 2778 }, // iPhone 14 Plus, 13 Pro Max
  "5.5": { width: 1242, height: 2208 }, // iPhone 8 Plus (still required)
};

// Screenshot configurations with marketing text
const SCREENSHOTS = [
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 19.57.14.png",
    headline: "Your Couple Dashboard",
    subheadline: "Track matches, packs & explore together",
    outputName: "01-home",
  },
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 20.10.53.png",
    headline: "Curated Question Packs",
    subheadline: "From first dates to spicy adventures",
    outputName: "02-packs",
  },
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 19.57.35.png",
    headline: "Swipe on Questions",
    subheadline: "Answer yes, no, or maybe together",
    outputName: "03-swipe",
  },
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 21.00.55.png",
    headline: "Express Yourself",
    subheadline: "Swipe right on what excites you",
    outputName: "04-swipe-yes",
  },
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 19.57.51.png",
    headline: "It's a Match!",
    subheadline: "Celebrate when you both say yes",
    outputName: "05-match",
  },
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 20.02.50.png",
    headline: "Discover Your Matches",
    subheadline: "See where you both agree",
    outputName: "06-home-matches",
  },
  {
    source: "Simulator Screenshot - iPhone 16 Pro - 2025-12-30 at 20.01.31.png",
    headline: "Chat About It",
    subheadline: "Every match unlocks a conversation",
    outputName: "07-chat",
  },
];

// Brand colors (matching app theme)
const COLORS = {
  background: {
    start: "#0f0f1a", // Dark purple-black
    end: "#1a1a2e", // Slightly lighter
  },
  accent: {
    pink: "#ec4899",
    purple: "#8b5cf6",
  },
  text: {
    primary: "#ffffff",
    secondary: "rgba(255, 255, 255, 0.7)",
  },
};

async function createGradientBackground(width, height) {
  // Create a gradient background using canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Create vertical gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.background.start);
  gradient.addColorStop(0.5, COLORS.background.end);
  gradient.addColorStop(1, COLORS.background.start);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle accent glow at top
  const glowGradient = ctx.createRadialGradient(
    width / 2,
    0,
    0,
    width / 2,
    0,
    width * 0.8
  );
  glowGradient.addColorStop(0, "rgba(236, 72, 153, 0.15)");
  glowGradient.addColorStop(0.5, "rgba(139, 92, 246, 0.08)");
  glowGradient.addColorStop(1, "transparent");

  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, width, height * 0.5);

  return canvas.toBuffer("image/png");
}

async function addTextOverlay(
  backgroundBuffer,
  width,
  height,
  headline,
  subheadline
) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw the background first
  const img = await sharp(backgroundBuffer).toBuffer();
  const backgroundImage = await loadImage(img);
  ctx.drawImage(backgroundImage, 0, 0);

  // Calculate text positions (top area)
  const textAreaTop = height * 0.05;

  // Draw headline
  const headlineSize = Math.round(width * 0.065);
  ctx.font = `bold ${headlineSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`;
  ctx.fillStyle = COLORS.text.primary;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Add text shadow for better readability
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillText(headline, width / 2, textAreaTop);

  // Draw subheadline
  const subheadlineSize = Math.round(width * 0.035);
  ctx.font = `${subheadlineSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`;
  ctx.fillStyle = COLORS.text.secondary;
  ctx.shadowBlur = 10;

  ctx.fillText(subheadline, width / 2, textAreaTop + headlineSize + 20);

  return canvas.toBuffer("image/png");
}

async function generateScreenshot(config, targetSize, inputDir, outputDir) {
  const { width, height } = DIMENSIONS[targetSize];
  const { source, headline, subheadline, outputName } = config;

  console.log(
    `  Generating ${outputName} for ${targetSize}" display (${width}x${height})...`
  );

  // Load source screenshot
  const sourcePath = path.join(inputDir, source);
  const sourceImage = sharp(sourcePath);
  const sourceMetadata = await sourceImage.metadata();

  // Calculate screenshot placement
  // Screenshot should take up about 75% of height, centered horizontally
  const screenshotMaxHeight = Math.round(height * 0.75);
  const screenshotMaxWidth = Math.round(width * 0.85);

  // Calculate scale to fit
  const scaleHeight = screenshotMaxHeight / sourceMetadata.height;
  const scaleWidth = screenshotMaxWidth / sourceMetadata.width;
  const scale = Math.min(scaleHeight, scaleWidth);

  const screenshotWidth = Math.round(sourceMetadata.width * scale);
  const screenshotHeight = Math.round(sourceMetadata.height * scale);

  // Position screenshot (centered horizontally, below text area)
  const screenshotX = Math.round((width - screenshotWidth) / 2);
  const screenshotY = Math.round(height * 0.18); // Start below text

  // Create gradient background
  const backgroundBuffer = await createGradientBackground(width, height);

  // Add text overlay
  const withText = await addTextOverlay(
    backgroundBuffer,
    width,
    height,
    headline,
    subheadline
  );

  // Resize source screenshot with rounded corners
  const roundedCorners = Math.round(screenshotWidth * 0.06);
  const resizedScreenshot = await sourceImage
    .resize(screenshotWidth, screenshotHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  // Create rounded corner mask
  const maskCanvas = createCanvas(screenshotWidth, screenshotHeight);
  const maskCtx = maskCanvas.getContext("2d");
  maskCtx.beginPath();
  maskCtx.roundRect(0, 0, screenshotWidth, screenshotHeight, roundedCorners);
  maskCtx.fillStyle = "white";
  maskCtx.fill();

  const roundedScreenshot = await sharp(resizedScreenshot)
    .composite([
      {
        input: await sharp(maskCanvas.toBuffer("image/png"))
          .resize(screenshotWidth, screenshotHeight)
          .toBuffer(),
        blend: "dest-in",
      },
    ])
    .toBuffer();

  // Add drop shadow effect by creating a shadow layer
  const shadowOffset = 20;
  const shadowBlur = 40;
  const shadowCanvas = createCanvas(
    screenshotWidth + shadowBlur * 2,
    screenshotHeight + shadowBlur * 2
  );
  const shadowCtx = shadowCanvas.getContext("2d");
  shadowCtx.shadowColor = "rgba(0, 0, 0, 0.4)";
  shadowCtx.shadowBlur = shadowBlur;
  shadowCtx.shadowOffsetX = 0;
  shadowCtx.shadowOffsetY = shadowOffset;
  shadowCtx.fillStyle = "black";
  shadowCtx.beginPath();
  shadowCtx.roundRect(
    shadowBlur,
    shadowBlur,
    screenshotWidth,
    screenshotHeight,
    roundedCorners
  );
  shadowCtx.fill();

  // Composite everything together
  const finalImage = await sharp(withText)
    .composite([
      {
        input: shadowCanvas.toBuffer("image/png"),
        left: screenshotX - shadowBlur,
        top: screenshotY - shadowBlur,
        blend: "multiply",
      },
      {
        input: roundedScreenshot,
        left: screenshotX,
        top: screenshotY,
      },
    ])
    .png()
    .toBuffer();

  // Save output
  const outputPath = path.join(outputDir, `${outputName}-${targetSize}in.png`);
  await fs.writeFile(outputPath, finalImage);
  console.log(`    Saved: ${outputPath}`);
}

async function main() {
  console.log("App Store Screenshot Generator\n");

  const inputDir = path.resolve(__dirname, "../../etc/ios_sim");
  const outputDir = path.resolve(__dirname, "output");

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Check for source files
  console.log("Checking source screenshots...");
  for (const config of SCREENSHOTS) {
    const sourcePath = path.join(inputDir, config.source);
    try {
      await fs.access(sourcePath);
      console.log(`  Found: ${config.source}`);
    } catch {
      console.error(`  Missing: ${config.source}`);
      process.exit(1);
    }
  }

  console.log("\nGenerating screenshots...\n");

  // Generate for each size
  for (const targetSize of Object.keys(DIMENSIONS)) {
    console.log(`\n${targetSize}" Display:`);
    for (const config of SCREENSHOTS) {
      await generateScreenshot(config, targetSize, inputDir, outputDir);
    }
  }

  console.log("\n\nDone! Screenshots saved to:", outputDir);
  console.log("\nGenerated files:");
  const files = await fs.readdir(outputDir);
  for (const file of files.sort()) {
    console.log(`  - ${file}`);
  }
}

main().catch(console.error);
