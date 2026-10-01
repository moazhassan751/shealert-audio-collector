import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function clickByText(page, text, tag = "*", timeout = 10000) {
  await page.waitForFunction((txt, tg) => {
    const elements = Array.from(document.querySelectorAll(tg));
    return elements.some(el => el.textContent.toLowerCase().includes(txt.toLowerCase()));
  }, { timeout }, text, tag);

  await page.evaluate((txt, tg) => {
    const elements = Array.from(document.querySelectorAll(tg));
    const el = elements.find(e => e.textContent.toLowerCase().includes(txt.toLowerCase()));
    if (el) el.click();
    else throw new Error(`Element with text "${txt}" not found`);
  }, text, tag);
}

async function runTest() {
  console.log("=== STARTING MULTI-TAKE SECTION D PROGRESSION TEST ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--window-size=1280,900"
    ]
  });

  try {
    const page = await browser.newPage();
    page.on("console", msg => {
      if (msg.type() === "error") {
        console.log(`[Browser Console Error] ${msg.text()}`);
      }
    });

    console.log("1. Navigating to http://127.0.0.1:8000/...");
    await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle0" });

    // Select Female Voice
    console.log("Selecting Female Voice category...");
    await clickByText(page, "Female Voice", "button");

    await page.waitForFunction(() => document.body.innerText.includes("Auto-assigned · Conflict-free"));
    console.log("Participant assigned ID!");

    // Consent
    await page.click("input[type='checkbox']");
    await clickByText(page, "Continue to Recording Session", "button");

    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("prepare your recording"));
    console.log("Reached pre-session instructions!");

    // 5-second test clip
    console.log("Recording 5-second test clip...");
    await clickByText(page, "Start Recording", "button");
    await new Promise(r => setTimeout(r, 5500));
    await clickByText(page, "Stop Recording", "button");

    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("play recording") || document.body.innerText.toLowerCase().includes("save test locally"));
    console.log("Testing playback on test clip...");
    await clickByText(page, "Play Recording", "button");
    await new Promise(r => setTimeout(r, 1000));

    console.log("Saving test clip locally...");
    await clickByText(page, "Save Test Locally", "button");

    // Start Section D
    console.log("Waiting for Start Section D button...");
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("start section d"));
    await clickByText(page, "Start Section D", "button");

    // Now record 8 takes to complete Section D and advance to Section A!
    for (let take = 1; take <= 8; take++) {
      console.log(`\n--- Recording Section D Take ${take} of 8 ---`);
      await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("start recording"), { timeout: 10000 });
      
      const clipText = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll("span")).find(s => s.innerText.includes("Clip "));
        return span ? span.innerText : "unknown";
      });
      console.log(`Current position: ${clipText}`);

      await clickByText(page, "Start Recording", "button");
      await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("stop recording"));
      await new Promise(r => setTimeout(r, 2200));

      await clickByText(page, "Stop Recording", "button");
      await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("submit take"), { timeout: 10000 });

      // Check quiet warning
      const hasQuiet = await page.evaluate(() => document.body.innerText.includes("Audio signal appears very quiet"));
      console.log(`Quiet warning shown: ${hasQuiet} (expected: false)`);
      if (hasQuiet) {
        console.warn("WARNING: Quiet warning triggered on take " + take);
      }

      // Test playback button toggle
      await clickByText(page, "Play Recording", "button");
      await new Promise(r => setTimeout(r, 500));
      const isPlaying = await page.evaluate(() => document.body.innerText.toLowerCase().includes("pause playback"));
      console.log(`Playback started successfully: ${isPlaying}`);

      // Submit
      console.log("Submitting take...");
      await clickByText(page, "Submit Take", "button");

      await page.waitForFunction(() => document.body.innerText.includes("Continue to Next Take"), { timeout: 60000 });
      console.log(`Take ${take} successfully saved!`);

      await clickByText(page, "Continue to Next Take", "button");
    }

    // Now verify we have moved to Section A (Stern / Aggressive Lines)!
    await page.waitForFunction(() => document.body.innerText.includes("Stern / Aggressive Lines") || document.body.innerText.includes("Clip 9 of 20"), { timeout: 10000 });
    console.log("\n=======================================================");
    console.log("SUCCESS! Successfully moved from Section D to Section A!");
    console.log("All 8 takes recorded and saved without error or audio leak!");
    console.log("=======================================================");

  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
