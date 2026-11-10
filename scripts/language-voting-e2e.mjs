// BASE=https://deployment VERCEL_PROJECT_FILE=.vercel/project-access.json node scripts/language-voting-e2e.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const base = process.env.BASE ?? "http://localhost:3100";
const origin = new URL(base).origin;
const project = process.env.VERCEL_PROJECT_FILE ? JSON.parse(fs.readFileSync(process.env.VERCEL_PROJECT_FILE, "utf8")) : null;
const bypass = Object.entries(project?.protectionBypass ?? {}).find(([, value]) => value.scope === "automation-bypass")?.[0];
const access = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const malayalam = /[\u0d00-\u0d7f]/u;
fs.mkdirSync(".e2e-shots", { recursive: true });
let roomCode;
const players = [];

async function api(path, { id, body, method = body ? "POST" : "GET" } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...access, "content-type": "application/json", ...(id ? { "x-player-id": id.playerId, "x-player-token": id.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  assert(response.ok, `${method} ${path} returned ${response.status}`);
  return data;
}
const act = (id, body) => api(`/api/rooms/${id.code}/actions`, { id, body });
const view = async (id) => (await api(`/api/rooms/${id.code}`, { id })).view;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const errors = [];

async function pageFor(context, identity) {
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on("pageerror", (error) => errors.push(error.message));
  if (bypass) {
    await page.setRequestInterception(true);
    page.on("request", (request) => void request.continue({ headers: { ...request.headers(), ...(new URL(request.url()).origin === origin ? access : {}) } }));
  }
  if (identity) {
    await page.evaluateOnNewDocument((id) => localStorage.setItem(`imposter.room.${id.code}.v1`, JSON.stringify(id)), identity);
  }
  return page;
}

async function go(page, path) {
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
}
async function waitText(page, value) {
  try {
    await page.waitForFunction((value) => document.body.innerText.toLowerCase().includes(value.toLowerCase()), { timeout: 20000 }, value);
  } catch {
    throw new Error(`Waiting for ${value}: ${(await page.$eval("body", (element) => element.innerText)).slice(0, 1000)}`);
  }
}
async function click(page, text, { exact = false, action = false } = {}) {
  await page.waitForFunction((text, exact) => [...document.querySelectorAll("button")].some((button) => !button.disabled && (exact ? button.innerText.trim() === text : button.innerText.includes(text))), { timeout: 20000 }, text, exact);
  const response = action ? page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/actions") && response.request().method() === "POST") : null;
  await page.evaluate((text, exact) => [...document.querySelectorAll("button")].find((button) => !button.disabled && (exact ? button.innerText.trim() === text : button.innerText.includes(text))).click(), text, exact);
  if (response) assert.equal((await response).status(), 200);
}
async function voteButton(page, name) {
  const response = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/actions") && response.request().method() === "POST");
  await page.waitForFunction((name) => [...document.querySelectorAll("button[aria-pressed]")].some((button) => !button.disabled && button.innerText.trim().split("\n").includes(name)), { timeout: 20000 }, name);
  await page.evaluate((name) => [...document.querySelectorAll("button[aria-pressed]")].find((button) => !button.disabled && button.innerText.trim().split("\n").includes(name)).click(), name);
  assert.equal((await response).status(), 200);
}
async function categoryLabels(page) {
  return page.$$eval("button[aria-pressed]", (buttons) => buttons.map((button) => button.innerText));
}
async function pending(page, language = "en") {
  return page.$$eval(`div[aria-live="polite"][lang="${language}"] li`, (items) => items.map((item) => item.innerText));
}
async function shot(page, path) {
  await page.waitForFunction(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).every((animation) => animation.playState === "finished"));
  await page.screenshot({ path, fullPage: true });
}

try {
  console.log("1. Online language selection and persistence");
  const created = await api("/api/rooms", { body: { name: "Alex" } });
  roomCode = created.code;
  players.push({ code: roomCode, playerId: created.playerId, token: created.token, name: "Alex" });
  for (const name of ["Alex", "Rahul", "Arjun"]) {
    const joined = await api(`/api/rooms/${roomCode}/join`, { body: { name } });
    const player = joined.view.players.find((player) => player.id === joined.playerId);
    players.push({ code: roomCode, playerId: joined.playerId, token: joined.token, name: player.name });
  }
  const host = players[0];
  const hostPage = await pageFor(await browser.createBrowserContext(), host);
  await go(hostPage, `/room/${roomCode}`);
  await waitText(hostPage, "Start round 1");
  await click(hostPage, "English", { exact: true, action: true });
  await hostPage.waitForFunction(() => [...document.querySelectorAll("button[aria-pressed]")].every((button) => !/[\u0d00-\u0d7f]/u.test(button.innerText)));
  assert.equal((await categoryLabels(hostPage)).length, 11);
  await click(hostPage, "മലയാളം", { exact: true, action: true });
  await waitText(hostPage, "ഭക്ഷണം");
  assert((await categoryLabels(hostPage)).every((label) => malayalam.test(label)));
  await click(hostPage, "English", { exact: true, action: true });
  await go(hostPage, `/room/${roomCode}`);
  await waitText(hostPage, "Start round 1");
  assert.equal((await view(host)).settings.wordDisplay, "en");
  await act(host, { type: "setSettings", settings: { categoryIds: ["food"], clueMode: "spoken", imposterHint: true } });
  await act(host, { type: "startRound" });
  const views = await Promise.all(players.map(view));
  const imposter = players[views.findIndex((view) => view.round.you.isImposter)];
  const crew = players[views.findIndex((view) => !view.round.you.isImposter)];
  const secret = (await view(crew)).round.you.word;
  const crewPage = await pageFor(await browser.createBrowserContext(), crew);
  await go(crewPage, `/room/${roomCode}`);
  await waitText(crewPage, secret.en);
  assert(!malayalam.test(await crewPage.$eval('section[aria-label="Your card"]', (element) => element.innerText)));
  await shot(crewPage, ".e2e-shots/language-online-english-card.png");
  console.log("  ✓ all 10 categories, persistent language changes, English-only secret card");

  console.log("2. Pending votes, vote changes, refresh, and privacy");
  await act(host, { type: "startVoting" });
  await waitText(hostPage, "0 of 4 players voted");
  assert.deepEqual(new Set(await pending(hostPage)), new Set(players.map((player) => player.name)));
  await voteButton(hostPage, players[1].name);
  await waitText(hostPage, "1 of 4 players voted");
  assert(!(await pending(hostPage)).includes(host.name));
  await voteButton(hostPage, players[2].name);
  await voteButton(hostPage, players[2].name);
  assert.equal((await view(host)).round.votesIn, 1);
  await go(hostPage, `/room/${roomCode}`);
  await waitText(hostPage, "1 of 4 players voted");
  assert.deepEqual(new Set(await pending(hostPage)), new Set(players.slice(1).map((player) => player.name)));
  const other = await view(players[1]);
  assert.equal(other.round.you.votedFor, null);
  assert.equal(other.round.tally, null);
  assert(!("votes" in other.round));
  await shot(hostPage, ".e2e-shots/voting-pending-english-mobile.png");
  const desktop = await pageFor(hostPage.browserContext(), host);
  await desktop.setViewport({ width: 1280, height: 900 });
  await go(desktop, `/room/${roomCode}`);
  await waitText(desktop, "1 of 4 players voted");
  await shot(desktop, ".e2e-shots/voting-pending-english-desktop.png");
  await desktop.close();
  await hostPage.bringToFront();
  console.log("  ✓ pending names update by ID; changes/repeats count once; refresh restores progress; choices stay private");

  console.log("3. Eliminated eligibility and in-game language changes");
  const victim = players.find((player) => player.playerId !== imposter.playerId && player.playerId !== host.playerId);
  for (const player of players) if (player !== victim) await act(player, { type: "vote", targetId: victim.playerId });
  await act(host, { type: "endVoting" });
  await act(host, { type: "continueRound" });
  await act(host, { type: "startVoting" });
  await waitText(hostPage, "0 of 3 players voted");
  assert(!(await pending(hostPage)).includes(victim.name));
  const active = (await view(host)).round.playerIds;
  await act(host, { type: "vote", targetId: active.find((id) => id !== host.playerId) });
  await act(host, { type: "setSettings", settings: { wordDisplay: "ml" } });
  await waitText(hostPage, "3 പേരിൽ 1 പേർ വോട്ട് ചെയ്തു");
  assert(!(await pending(hostPage, "ml")).includes(victim.name));
  const activeCrew = players.find((player) => active.includes(player.playerId) && player.playerId !== imposter.playerId);
  assert.equal((await view(activeCrew)).round.you.word.id, secret.id);
  assert.equal((await view(host)).roundsPlayed, 0);
  await shot(hostPage, ".e2e-shots/voting-pending-malayalam-mobile.png");
  await act(host, { type: "endGame" });
  await act(host, { type: "backToLobby", resetScores: false });
  await act(host, { type: "startRound" });
  await act(host, { type: "startVoting" });
  await waitText(hostPage, "4 പേരിൽ 0 പേർ വോട്ട് ചെയ്തു");
  assert.equal((await pending(hostPage, "ml")).length, 4);
  console.log("  ✓ eliminated players excluded, same secret retained across language switch, fresh rounds reset all voters");

  console.log("4. Local English setup and legacy session restoration");
  const local = await pageFor(await browser.createBrowserContext());
  await go(local, "/setup");
  await waitText(local, "Players");
  const inputs = await local.$$("input");
  for (const [index, name] of ["A", "B", "C"].entries()) await inputs[index].type(name);
  await click(local, "English", { exact: true });
  assert((await categoryLabels(local)).every((label) => !malayalam.test(label)));
  await go(local, "/setup");
  await waitText(local, "Players");
  assert.equal(await local.evaluate(() => JSON.parse(localStorage.getItem("imposter.settings.v1")).wordDisplay), "en");
  await click(local, "Secret ballot", { exact: true });
  await click(local, "Start with 3 players");
  await waitText(local, "Pass the phone to A");
  await local.evaluate(() => {
    const round = JSON.parse(localStorage.getItem("imposter.round.v1"));
    localStorage.setItem("imposter.round.v1", JSON.stringify({ ...round, id: "legacy", number: 3, categoryId: "food", word: { ml: "കപ്പ", en: "Kappa" }, imposter: 2, starter: 0, peekIndex: 0 }));
    const session = JSON.parse(localStorage.getItem("imposter.session.v1"));
    localStorage.setItem("imposter.session.v1", JSON.stringify({ ...session, scores: [4, 2, 1], roundsPlayed: 2, usedWords: ["food:കപ്പ"] }));
  });
  await go(local, "/play");
  await waitText(local, "Pass the phone to A");
  await click(local, "Tap to reveal");
  await waitText(local, "Tapioca");
  const saved = await local.evaluate(() => [localStorage.getItem("imposter.round.v1"), localStorage.getItem("imposter.session.v1")]);
  await go(local, "/setup");
  await waitText(local, "Players");
  await click(local, "മലയാളം", { exact: true });
  assert.deepEqual(await local.evaluate(() => [localStorage.getItem("imposter.round.v1"), localStorage.getItem("imposter.session.v1")]), saved);
  await go(local, "/play");
  await waitText(local, "Pass the phone to A");
  await click(local, "Tap to reveal");
  await waitText(local, "കപ്പ");
  await go(local, "/setup");
  await waitText(local, "Players");
  await click(local, "English", { exact: true });
  assert.deepEqual(await local.evaluate(() => [localStorage.getItem("imposter.round.v1"), localStorage.getItem("imposter.session.v1")]), saved);
  await local.evaluate(() => {
    const round = JSON.parse(localStorage.getItem("imposter.round.v1"));
    localStorage.setItem("imposter.round.v1", JSON.stringify({ ...round, phase: "vote", votes: [null, null, null] }));
  });
  await go(local, "/play");
  await waitText(local, "0 of 3 players voted");
  for (const [index, target] of [[0, "B"], [1, "A"], [2, "A"]]) {
    await click(local, `I'm ${["A", "B", "C"][index]} — show my ballot`);
    await local.evaluate((name) => [...document.querySelectorAll("button")].find((button) => button.innerText.trim().split("\n").at(-1) === name).click(), target);
    await waitText(local, `${index + 1} of 3 players voted`);
    if (index === 0) {
      await go(local, "/play");
      await waitText(local, "1 of 3 players voted");
      assert.deepEqual(await pending(local), ["B", "C"]);
    }
  }
  await waitText(local, "All players have voted");
  await click(local, "Vote out A — reveal");
  await click(local, "Reveal the truth");
  await waitText(local, "Tapioca");
  assert(!malayalam.test(await local.$eval("body", (element) => element.innerText)));
  await shot(local, ".e2e-shots/language-local-english-reveal.png");
  console.log("  ✓ legacy words translate, language switches preserve scores/history, restored secret ballots show correct pending/completed states");
  assert.deepEqual(errors, []);
  console.log("ALL LANGUAGE AND VOTING CHECKS PASSED");
} finally {
  await browser.close();
  for (const player of players.reverse()) {
    try { await act(player, { type: "leave" }); } catch { /* Best effort for this test room only. */ }
  }
}
