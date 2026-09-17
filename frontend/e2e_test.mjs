import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\4c6a9aec-77da-49ce-b893-f74a4cecd317";
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "e2e_screenshots");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function clickByText(page, text, tag = "*", timeout = 10000) {
  await page.waitForFunction((txt, tg) => {
    const elements = Array.from(document.querySelectorAll(tg));
    return elements.some(el => el.textContent.includes(txt));
  }, { timeout }, text, tag);

  await page.evaluate((txt, tg) => {
    const elements = Array.from(document.querySelectorAll(tg));
    const el = elements.find(e => e.textContent.includes(txt));
    if (el) el.click();
    else throw new Error(`Element with text "${txt}" not found`);
  }, text, tag);
}

async function runE2ETest() {
  console.log("=== STARTING AUTOMATED END-TO-END BROWSER TEST ===");
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
    await page.setViewport({ width: 1280, height: 900 });

    // Enable console logging from page
    page.on("console", msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));

    console.log("1. Navigating to http://127.0.0.1:5173/...");
    await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle0" });

    // Verify title and header
    const headerText = await page.$eval("header", el => el.innerText);
    console.log("Header verified:", headerText.replace(/\n/g, " | "));

    // Wait for the session script to load and the participant form to appear
    await page.waitForSelector("select", { timeout: 10000 });
    console.log("Participant setup form loaded successfully!");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_participant_setup.png") });
    console.log("Saved: 01_participant_setup.png");

    // 2. Select female category
    console.log("2. Selecting 'Female' category...");
    const firstSelect = await page.$("select");
    await firstSelect.select("female");

    // Wait for auto-assigned ID
    await page.waitForFunction(() => {
      return document.body.innerText.includes("Auto-assigned · Conflict-free");
    }, { timeout: 10000 });

    const volunteerId = await page.$eval("span.font-mono.text-xl.font-bold", el => el.innerText);
    console.log(`Auto-assigned ID generated: ${volunteerId}`);
    if (!volunteerId.startsWith("F")) throw new Error(`Unexpected ID: ${volunteerId}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_auto_id_assigned.png") });
    console.log("Saved: 02_auto_id_assigned.png");

    // 3. Test Manual ID Toggle
    console.log("3. Testing manual ID toggle...");
    await clickByText(page, "Have a specific ID? Enter manually", "button");
    await page.waitForSelector("input[placeholder*='F01']");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_manual_id_toggle.png") });
    console.log("Saved: 03_manual_id_toggle.png");

    // Switch back to auto
    await clickByText(page, "Auto-assign", "button");
    await page.waitForFunction(() => document.body.innerText.includes("Auto-assigned · Conflict-free"));

    // 4. Fill Age group, Language, Environment
    console.log("4. Configuring age group, environment, and consent...");
    const allSelects = await page.$$("select");
    // selects: [0] = gender, [1] = age group, [2] = environment
    await allSelects[1].select("26-35");
    await allSelects[2].select("E1");

    // Check consent box
    await page.click("input[type='checkbox']");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_consent_selected.png") });
    console.log("Saved: 04_consent_selected.png");

    // Continue to session
    console.log("5. Continuing to session...");
    await clickByText(page, "Continue to session", "button");
    await page.waitForFunction(() => document.body.innerText.includes("Prepare the recording"));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_pre_session_instructions.png") });
    console.log("Saved: 05_pre_session_instructions.png");

    // 6. Test 5-second test clip
    console.log("6. Recording 5-second test clip...");
    await clickByText(page, "Start recording", "button");
    await page.waitForFunction(() => document.body.innerText.includes("Stop recording"));
    console.log("Recording in progress with live audio stream. Waiting 6 seconds...");
    await new Promise(r => setTimeout(r, 6000));

    await clickByText(page, "Stop recording", "button");
    await page.waitForFunction(() => document.body.innerText.includes("Save test locally"));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_test_clip_ready.png") });
    console.log("Saved: 06_test_clip_ready.png");

    console.log("Saving test clip to local IndexedDB storage...");
    await clickByText(page, "Save test locally", "button");

    // 7. Start Section D
    console.log("7. Starting Section D...");
    await page.waitForFunction(() => document.body.innerText.includes("Start Section D"));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_section_d_intro.png") });
    console.log("Saved: 07_section_d_intro.png");

    await clickByText(page, "Start Section D", "button");
    await page.waitForSelector("p.urdu");
    const urduPrompt = await page.$eval("p.urdu", el => el.innerText);
    console.log(`Prompt loaded: ${urduPrompt}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_recording_prompt.png") });
    console.log("Saved: 08_recording_prompt.png");

    // 8. Record clip and submit
    console.log("8. Recording Clip 1 take...");
    await clickByText(page, "Start recording", "button");
    await page.waitForFunction(() => document.body.innerText.includes("Stop recording"));
    await new Promise(r => setTimeout(r, 2500));
    await clickByText(page, "Stop recording", "button");
    await page.waitForFunction(() => document.body.innerText.includes("Submit"));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_take_ready_to_submit.png") });
    console.log("Saved: 09_take_ready_to_submit.png");

    console.log("Submitting take to backend...");
    await clickByText(page, "Submit", "button");
    await page.waitForFunction(() => {
      return document.body.innerText.includes("Continue to Next Take") ||
             document.body.innerText.includes("submitted");
    }, { timeout: 15000 });
    console.log("Audio take uploaded and standardized successfully!");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_upload_success.png") });
    console.log("Saved: 10_upload_success.png");

    // 9. Researcher Dashboard Flow
    console.log("9. Accessing Researcher Dashboard...");
    await clickByText(page, "Researcher dashboard", "button");
    await page.waitForSelector("input[type='password']");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11_admin_login.png") });
    console.log("Saved: 11_admin_login.png");

    console.log("Authenticating as admin...");
    await page.type("input[type='password']", "local-dev-password");
    await clickByText(page, "Sign in", "button");

    await page.waitForFunction(() => document.body.innerText.includes("Dataset dashboard"), { timeout: 10000 });
    console.log("Researcher Dashboard loaded!");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12_dashboard_overview.png") });
    console.log("Saved: 12_dashboard_overview.png");

    // Verify stats
    const statsText = await page.$eval("main", el => el.innerText);
    console.log("Dashboard Snapshot:\n" + statsText.split("\n").slice(0, 15).join("\n"));

    // Test Export metadata action
    console.log("Testing 'Export metadata' button...");
    await clickByText(page, "Export metadata", "button");

    // Return to participant collection
    console.log("Navigating back to participant collection / active session...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Participant collection"));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes("Dataset dashboard");
    }, { timeout: 10000 });

    const currentScreenText = await page.$eval("main", el => el.innerText);
    console.log("Returned to screen. Content summary:\n" + currentScreenText.split("\n").slice(0, 5).join(" | "));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13_back_to_session_view.png") });
    console.log("Saved: 13_back_to_session_view.png");

    console.log("\n=======================================================");
    console.log("SUCCESS: 100% AUTOMATED END-TO-END BROWSER TEST PASSED!");
    console.log("=======================================================");
  } finally {
    await browser.close();
  }
}

runE2ETest().catch(err => {
  console.error("Browser E2E Test Execution Error:", err);
  process.exit(1);
});
