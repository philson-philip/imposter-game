// Run with: pnpm e2e  (needs Google Chrome; set CHROME to another Chromium path if needed)
// Multi-player browser E2E: four isolated browser contexts play a full round through the real UI.
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = new URL("../.e2e-shots/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log("  ✓", msg);
  else {
    failures++;
    console.log("  ✗", msg);
  }
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];

async function newPlayer(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(phone);
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${name}] console.error: ${m.text()}`);
  });
  return { name, ctx, page };
}
const shot = (page, file) => page.screenshot({ path: OUT + file, fullPage: true });
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), { timeout }, re.source);
async function clickText(page, label) {
  const handle = await page.waitForSelector(`::-p-text(${label})`, { timeout: 10000 });
  await handle.click();
}
const buttonsPressed = (page) => page.$$("button[aria-pressed]");

try {
  console.log("1. static pages");
  const host = await newPlayer("Host");
  await host.page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(host.page, "01-home.png");
  ok((await text(host.page)).includes("Start a game"), "home renders");
  await host.page.goto(`${BASE}/how-to-play`, { waitUntil: "networkidle0" });
  await shot(host.page, "02-how-to-play.png");
  await host.page.goto(`${BASE}/join`, { waitUntil: "networkidle0" });
  await shot(host.page, "03-join.png");
  await host.page.goto(`${BASE}/setup`, { waitUntil: "networkidle0" });
  await shot(host.page, "04-setup.png");

  console.log("2. host creates a room");
  await host.page.goto(`${BASE}/new`, { waitUntil: "networkidle0" });
  await host.page.waitForSelector("input");
  await host.page.type("input", "Philson");
  await shot(host.page, "05-new.png");
  await host.page.click("button[type=submit]");
  await host.page.waitForFunction(() => location.pathname.startsWith("/room/"), { timeout: 15000 });
  const code = (await host.page.evaluate(() => location.pathname)).split("/").pop();
  ok(/^[A-Z0-9]{5}$/.test(code), `room ${code} created`);
  await waitText(host.page, /Players/);
  await shot(host.page, "06-lobby-host.png");

  console.log("3. three players join through the link");
  const players = [];
  for (const n of ["Anu", "Biju", "Chinnu"]) {
    const p = await newPlayer(n);
    await p.page.goto(`${BASE}/room/${code}`, { waitUntil: "networkidle0" });
    await p.page.waitForSelector("input");
    if (n === "Anu") await shot(p.page, "07-join-form.png");
    await p.page.type("input", n);
    await p.page.click("button[type=submit]");
    await waitText(p.page, /Waiting for Philson to start/);
    players.push(p);
  }
  await shot(players[0].page, "08-lobby-player.png");
  await waitText(host.page, /4 of 20/);
  ok(true, "host sees 4 players");
  await shot(host.page, "09-lobby-host-4.png");

  console.log("4. host picks Food and starts round 1");
  await clickText(host.page, "Food");
  await waitText(host.page, /48 words/);
  await clickText(host.page, "Start round 1");
  const all = [host, ...players];
  for (const p of all) await waitText(p.page, /Give your clues/);
  ok(true, "everyone sees the clues phase");
  await shot(host.page, "10-clues-host.png");
  let imposter = null;
  for (const p of all) {
    const t = await text(p.page);
    if (t.includes("You're the Imposter")) imposter = p;
  }
  ok(imposter !== null, `imposter is ${imposter?.name}`);
  await shot(imposter.page, "11-clues-imposter.png");
  const crew = all.find((p) => p !== imposter);
  await shot(crew.page, "12-clues-crew.png");

  console.log("5. typed clues in turn order");
  const clueInput = 'input[placeholder*="say the word"], input[placeholder*="Bluff"]';
  for (let i = 0; i < 4; i++) {
    let done = false;
    for (let attempt = 0; attempt < 30 && !done; attempt++) {
      for (const p of all) {
        const input = await p.page.$(clueInput);
        if (input) {
          await input.type(p === imposter ? "classic" : `clue ${i + 1}`);
          await p.page.keyboard.press("Enter");
          // the input disappears once the server accepts the clue and the turn moves on
          await p.page.waitForFunction((sel) => !document.querySelector(sel), { timeout: 10000 }, clueInput);
          console.log(`   ${p.name} sent clue ${i + 1}`);
          done = true;
          break;
        }
      }
      if (!done) await sleep(500);
    }
    ok(done, `clue ${i + 1} submitted`);
  }
  for (const p of all) await waitText(p.page, /Who is the Imposter\?/);
  ok(true, "everyone sees the vote");
  await shot(host.page, "13-vote-host.png");

  console.log("6. everyone votes");
  for (const p of all) {
    await p.page.waitForSelector("button[aria-pressed]");
    const buttons = await buttonsPressed(p.page);
    // crew tries to vote the imposter out; the imposter votes for the first other player
    let target = buttons[0];
    if (p !== imposter) {
      for (const b of buttons) {
        const label = await b.evaluate((el) => el.innerText);
        if (label.includes(imposter.name)) target = b;
      }
    }
    await target.click();
    await sleep(400);
  }
  await waitText(host.page, /Imposter caught!|got away|cancelled/, 20000);
  const imposterText = await text(imposter.page);
  if (imposterText.includes("Which word did everyone have?")) {
    await shot(imposter.page, "14-guess-imposter.png");
    await shot(crew.page, "15-guess-crew.png");
    const options = await imposter.page.$$("div.grid button");
    ok(options.length === 5, `imposter has ${options.length} guess options`);
    await options[0].click();
  }
  await waitText(host.page, /Scores/, 20000);
  ok(true, "reveal reached");
  await shot(host.page, "16-reveal-host.png");
  await shot(imposter.page, "17-reveal-imposter.png");

  console.log("7. host starts round 2 in Movies, then ends the game");
  await clickText(host.page, "Next round:");
  await clickText(host.page, "Movies");
  await clickText(host.page, "Start round 2");
  for (const p of all) await waitText(p.page, /Round 2/);
  ok(true, "round 2 started for everyone");
  await shot(host.page, "18-round2-host.png");
  await clickText(host.page, "Start voting now");
  await waitText(players[0].page, /Who is the Imposter\?/);
  await clickText(host.page, "End voting now");
  await waitText(host.page, /Scores/, 20000);
  await clickText(host.page, "End game and show final standings");
  for (const p of all) await waitText(p.page, /Game over/);
  ok(true, "final standings shown to everyone");
  await shot(host.page, "19-ended-host.png");
  await shot(players[1].page, "20-ended-player.png");

  console.log("8. a player leaves");
  // the final-standings screen has its own "Leave room" button (no confirmation sheet)
  await clickText(players[2].page, "Leave room");
  await players[2].page.waitForFunction(() => location.pathname === "/", { timeout: 10000 });
  await sleep(2500);
  ok(!(await text(host.page)).includes("Chinnu"), "host no longer sees Chinnu");

  console.log("9. pass & play on one phone");
  const solo = await newPlayer("Solo");
  await solo.page.goto(`${BASE}/setup`, { waitUntil: "networkidle0" });
  const inputs = await solo.page.$$("input");
  const names = ["Ammu", "Kannan", "Meera"];
  for (let i = 0; i < 3; i++) await inputs[i].type(names[i]);
  await clickText(solo.page, "Start with 3 players");
  await waitText(solo.page, /Pass the phone to Ammu/);
  await shot(solo.page, "21-peek-facedown.png");
  await clickText(solo.page, "Tap to reveal");
  await sleep(800);
  await shot(solo.page, "22-peek-faceup.png");
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await clickText(solo.page, "Tap to reveal");
      await sleep(400);
    }
    await clickText(solo.page, "Got it");
    await sleep(700);
  }
  await waitText(solo.page, /Give your clues/);
  await shot(solo.page, "23-local-clues.png");
  await clickText(solo.page, "Start voting");
  await waitText(solo.page, /Who is the Imposter\?/);
  const voteButtons = await buttonsPressed(solo.page);
  await voteButtons[0].click();
  await clickText(solo.page, "Vote out");
  await waitText(solo.page, /The group voted out/);
  await clickText(solo.page, "Reveal the truth");
  await sleep(600);
  await shot(solo.page, "24-local-reveal.png");
  const t = await text(solo.page);
  if (t.includes("last chance")) {
    await clickText(solo.page, "Imposter's last chance");
    await clickText(solo.page, "Nailed it");
  } else {
    await clickText(solo.page, "See the scores");
  }
  await waitText(solo.page, /Scores/);
  await shot(solo.page, "25-local-scores.png");
  ok(true, "pass & play round completed");
} catch (err) {
  failures++;
  console.log("  ✗ E2E crashed:", err.message);
} finally {
  await browser.close();
}
const realErrors = errors.filter((e) => !/favicon|net::ERR_|the server responded with a status of 404/i.test(e));
console.log(realErrors.length ? "browser errors:\n" + realErrors.join("\n") : "no browser errors");
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
