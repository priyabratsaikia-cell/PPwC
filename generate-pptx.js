/**
 * generate-pptx.js
 *
 * Node.js script that converts an HTML file into a PowerPoint (.pptx) file
 * using Puppeteer (headless browser) and the dom-to-pptx library (CDN).
 *
 * Usage:
 *   node generate-pptx.js                        # defaults to index.html -> output.pptx
 *   node generate-pptx.js myslide.html            # custom input, output = myslide.pptx
 *   node generate-pptx.js myslide.html result.pptx # custom input + output
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ── CLI Arguments ──────────────────────────────────────────────────────────
const inputFile = process.argv[2] || 'index.html';
const defaultOutput = path.basename(inputFile, path.extname(inputFile)) + '.pptx';
const outputFile = process.argv[3] || defaultOutput;

// Resolve to absolute paths
const htmlPath = path.resolve(inputFile);
const pptxPath = path.resolve(outputFile);

if (!fs.existsSync(htmlPath)) {
  console.error(`Error: HTML file not found: ${htmlPath}`);
  process.exit(1);
}

console.log(`Input  : ${htmlPath}`);
console.log(`Output : ${pptxPath}`);

(async () => {
  let browser;
  try {
    // ── 1. Launch headless browser ───────────────────────────────────────
    console.log('\n[1/5] Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',       // allow local file + CDN cross-origin
        '--allow-file-access-from-files',
      ],
    });

    const page = await browser.newPage();

    // Set a large viewport so the HTML renders at full size
    await page.setViewport({ width: 1920, height: 1080 });

    // Collect console messages from the browser for debugging
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') {
        console.error(`  [browser error] ${msg.text()}`);
      } else if (type === 'warning') {
        console.warn(`  [browser warn]  ${msg.text()}`);
      }
      // silently skip info/log to keep output clean
    });

    // ── 2. Load the HTML file ────────────────────────────────────────────
    console.log('[2/5] Loading HTML file...');
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('       HTML loaded successfully.');

    // ── 3. Inject dom-to-pptx from CDN ───────────────────────────────────
    console.log('[3/5] Injecting dom-to-pptx library from CDN...');
    await page.addScriptTag({
      url: 'https://cdn.jsdelivr.net/npm/dom-to-pptx@latest/dist/dom-to-pptx.bundle.js',
    });

    // Wait a moment for the script to initialize
    await page.waitForFunction(() => typeof window.domToPptx !== 'undefined', {
      timeout: 15000,
    });
    console.log('       dom-to-pptx library loaded.');

    // ── 4. Run the export inside the browser ─────────────────────────────
    console.log('[4/5] Generating PowerPoint from DOM...');

    // We wrap the body content in a selector. The library will traverse
    // document.body and convert everything it finds.
    const base64Data = await page.evaluate(async () => {
      // Use the body as the slide container
      const target = document.body;

      // Call dom-to-pptx with skipDownload so we get the Blob back
      const blob = await window.domToPptx.exportToPptx(target, {
        fileName: 'output.pptx',
        skipDownload: true,
        autoEmbedFonts: true,
      });

      // Convert Blob to base64 so we can pass it back to Node.js
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // reader.result is "data:application/...;base64,XXXX"
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });

    if (!base64Data) {
      throw new Error('Export returned empty data. Check browser console errors above.');
    }

    // ── 5. Write the .pptx file ──────────────────────────────────────────
    console.log('[5/5] Writing .pptx file...');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(pptxPath, buffer);

    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    console.log(`\nDone! Generated ${outputFile} (${sizeMB} MB)`);
    console.log(`File saved to: ${pptxPath}`);
  } catch (err) {
    console.error('\nError during PPTX generation:');
    console.error(err.message || err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
