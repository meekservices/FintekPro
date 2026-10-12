import { chromium } from 'playwright';

async function checkConsoleErrors() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', exception => {
    errors.push(exception.message);
  });

  try {
    // Go to the agent portal
    console.log('Navigating to partner portal...');
    await page.goto('https://partner.fintekpro.com/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check if there is an error boundary
    const errorText = await page.evaluate(() => {
      return document.body.innerText;
    });

    console.log('--- CONSOLE ERRORS ---');
    console.log(errors);
    console.log('--- PAGE TEXT SNIPPET ---');
    console.log(errorText.substring(0, 500));
  } catch (e) {
    console.error('Error navigating:', e);
  } finally {
    await browser.close();
  }
}

checkConsoleErrors();
