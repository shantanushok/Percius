require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');            

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ✅ Modified: Accept `cleanedYear`
async function downloadCSV(page, goalNumber, cleanedYear) {
  try {
    console.log(`📥 Starting download for SDG ${goalNumber}...`);

    // Sequentially scroll through 4 parts of the page to ensure visibility
    const scrollSteps = [0.25, 0.5, 0.75, 1];
    let targetVisible = false;

    for (const step of scrollSteps) {
      await page.evaluate((fraction) => {
        window.scrollTo(0, document.body.scrollHeight * fraction);
      }, step);

      console.log(`🔎 Scrolled to ${(step * 100).toFixed(0)}% of page...`);
      await page.waitForTimeout(2000);

      const visibleHeading = await page.$('div.top-heading-area h5.climate-heading');
      if (visibleHeading) {
        targetVisible = true;
        console.log('✅ Found top-heading-area for current SDG');
        break;
      }
    }

    if (!targetVisible) throw new Error('top-heading-area not found after full scroll.');

    // Click on ⋮ inside that area
    const ellipsis = page.locator('div.top-heading-area div.download_data_area i.fa-ellipsis-v');
    await ellipsis.scrollIntoViewIfNeeded();
    await ellipsis.click({ delay: 400 });
    console.log('⋮ Menu opened');

    // Wait for visible Download Data button inside the same block
    const downloadButton = page.locator('div.top-heading-area div.download_data_btn.show button.btn-light');
    await downloadButton.waitFor({ state: 'visible', timeout: 8000 });
    await downloadButton.scrollIntoViewIfNeeded();

    // Wait a bit for animations
    await page.waitForTimeout(1000);

    // Trigger file download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      downloadButton.click({ delay: 400 })
    ]);

    // ✅ Use the detected data year for file naming
    const filePath = path.join(DATA_DIR, `sdg_goal_${goalNumber}_${cleanedYear}.csv`);
    await download.saveAs(filePath);

    console.log(`✅ SDG ${goalNumber} saved successfully → ${filePath}`);
    return true;
  } catch (err) {
    console.error(`⚠️ SDG ${goalNumber} download failed: ${err.message}`);
    return false;
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });
  const page = await browser.newPage();

  console.log('🌐 Opening NITI SDG Index portal...');
  await page.goto('https://sdgindiaindex.niti.gov.in/#/ranking', {
    waitUntil: 'load',
    timeout: 120000
  });

  await delay(8000); // Wait for navbar and scripts to initialize

  // ✅ New: Detect the displayed year
  const yearText = await page.$eval(
    'span.mat-select-min-line.ng-tns-c30-1.ng-star-inserted',
    el => el.textContent.trim()
  );
  console.log(`📅 Detected data year: ${yearText}`);
  const cleanedYear = yearText.replace(/[^0-9\-]/g, '');

  console.log('🔍 Finding SDG goal elements...');
  const goals = await page.locator(
    '.navbar-nav .nav-link.goal1, .navbar-nav .nav-link.goal2, .navbar-nav .nav-link.goal3, .navbar-nav .nav-link.goal4, .navbar-nav .nav-link.goal5, .navbar-nav .nav-link.goal6, .navbar-nav .nav-link.goal7, .navbar-nav .nav-link.goal8, .navbar-nav .nav-link.goal9, .navbar-nav .nav-link.goal10, .navbar-nav .nav-link.goal11, .navbar-nav .nav-link.goal12, .navbar-nav .nav-link.goal13, .navbar-nav .nav-link.goal14, .navbar-nav .nav-link.goal15, .navbar-nav .nav-link.goal16, .navbar-nav .nav-link.goal17'
  ).all();

  console.log(`Found ${goals.length} SDG icons.`);

  // ✅ Pass the year when downloading each SDG file
  for (let i = 0; i < goals.length; i++) {
    console.log(`\n➡️  Navigating to SDG ${i + 1}...`);
    const goal = goals[i];
    await goal.click({ delay: 500 });
    await delay(7000); // wait for page content to load
    await downloadCSV(page, i + 1, cleanedYear);
  }

  console.log('\n📊 Downloading Indicator List...');
  await page.goto('https://sdgindiaindex.niti.gov.in/#/ranking', { waitUntil: 'load' });
  await delay(5000);

  const menuButton = page.locator('button.mat-menu-trigger');
  await menuButton.first().click({ delay: 500 });

  const downloadButton = page.locator('text=Download Data');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    downloadButton.click({ delay: 500 })
  ]);

  // ✅ Use same year in indicator list filename
  const indicatorPath = path.join(DATA_DIR, `indicator_list_${cleanedYear}.csv`);
  await download.saveAs(indicatorPath);
  console.log(`✅ Saved Indicator List: ${indicatorPath}`);

  await browser.close();
  console.log('\n🎉 All downloads complete!');
})();  
