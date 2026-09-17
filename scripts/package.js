#!/usr/bin/env node

/**
 * Package script: Creates a distributable ZIP from the dist/ directory.
 *
 * Usage: npm run package
 *
 * Output: release/CareerLens-v<version>.zip
 *
 * The ZIP contains the extension files at its root:
 * - manifest.json
 * - background.js
 * - content.js
 * - sidepanel.html
 * - sidepanel.js
 * - icons/
 * - assets/
 */

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

async function packageExtension() {
  try {
    // Read version from package.json
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf8")
    );
    const version = packageJson.version;

    // Verify dist directory exists
    const distDir = path.join(__dirname, "..", "dist");
    if (!fs.existsSync(distDir)) {
      console.error(
        "ERROR: dist/ directory not found. Run 'npm run build' first."
      );
      process.exit(1);
    }

    // Create release directory
    const releaseDir = path.join(__dirname, "..", "release");
    if (!fs.existsSync(releaseDir)) {
      fs.mkdirSync(releaseDir, { recursive: true });
    }

    // Create ZIP
    const zip = new JSZip();
    const outputPath = path.join(
      releaseDir,
      `CareerLens-v${version}.zip`
    );

    console.log(`📦 Packaging CareerLens v${version}...`);

    // Recursively add all files from dist to ZIP
    function addDirToZip(dir, zipFolder, relativePath = "") {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const zipPath = path.join(relativePath, file).replace(/\\/g, "/");

        if (stat.isDirectory()) {
          addDirToZip(
            filePath,
            zipFolder.folder(file) || zipFolder,
            zipPath
          );
        } else {
          const content = fs.readFileSync(filePath);
          zipFolder.file(file, content);
        }
      }
    }

    addDirToZip(distDir, zip);

    // Verify manifest.json is at root
    if (!zip.file("manifest.json")) {
      console.error(
        "ERROR: manifest.json not found in dist/. Build output is invalid."
      );
      process.exit(1);
    }

    // Write ZIP file
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE"
    });

    fs.writeFileSync(outputPath, buffer);

    const bytes = buffer.length;
    const kb = (bytes / 1024).toFixed(2);

    console.log(`✅ Successfully packaged: ${outputPath}`);
    console.log(`   Size: ${kb} KB`);
    console.log(`   Version: ${version}`);
    console.log(
      "\n💡 To load in Chrome:"
    );
    console.log("   1. Extract the ZIP");
    console.log("   2. Go to chrome://extensions");
    console.log("   3. Enable Developer mode");
    console.log("   4. Click 'Load unpacked'");
    console.log("   5. Select the extracted CareerLens folder");
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

packageExtension();
