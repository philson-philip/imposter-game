// Run with: pnpm smoke  (BASE=https://your-deployment to target a deployment)
// End-to-end smoke test for the room API: plays two full rounds with four players.
const BASE = process.env.BASE ?? "http://localhost:3100";
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log("  ✓", msg); else { failures++; console.log("  ✗", msg); } };

async function api(path, { method = "GET", body, id } = {}) {
  const headers = { "content-type": "application/json" };
  if (id) { headers["x-player-id"] = id.playerId; headers["x-player-token"] = id.token; }
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json };
}
const view = async (id, v = 0) => api(`/api/rooms/${id.code}?v=${v}`, { id });
const act = (id, action) => api(`/api/rooms/${id.code}/actions`, { method: "POST", body: action, id });

console.log("1. create + join");
const created = await api("/api/rooms", { method: "POST", body: { name: "  Host  " } });
ok(created.status === 201 && /^[A-Z0-9]{5}$/.test(created.json.code), `room created ${created.json?.code}`);
const code = created.json.code;
const host = { code, playerId: created.json.playerId, token: created.json.token };
const players = [host];
for (const name of ["Anu", "Biju", "Chinnu"]) {
  const j = await api(`/api/rooms/${code}/join`, { method: "POST", body: { name } });
  ok(j.status === 201, `${name} joined`);
  players.push({ code, playerId: j.json.playerId, token: j.json.token, name });
}
const dup = await api(`/api/rooms/${code}/join`, { method: "POST", body: { name: "anu" } });
ok(dup.status === 201 && dup.json.view.players.some(p => p.name === "anu 2"), "duplicate name made unique");
const dupId = { code, playerId: dup.json.playerId, token: dup.json.token };
ok((await act(dupId, { type: "leave" })).json?.left === true, "extra player left");

console.log("2. auth + validation");
ok((await api(`/api/rooms/${code}`, { id: { ...host, token: "nope" } })).status === 403, "bad token rejected");
ok((await api(`/api/rooms/ZZZZZ`, { id: host })).status === 404, "unknown room 404");
ok((await api(`/api/rooms/bad!`, { id: host })).status === 400, "bad code 400");
ok((await act(players[1], { type: "startRound" })).status === 403, "non-host cannot start");
ok((await act(host, { type: "nonsense" })).status === 400, "unknown action rejected");
const v0 = await view(host);
ok(v0.status === 200 && v0.json.view.players.length === 4 && v0.json.view.status === "lobby", "lobby view has 4 players");
ok((await view(host, v0.json.view.version)).status === 204, "unchanged version → 204");

console.log("3. settings + round 1 (typed clues)");
const s = await act(host, { type: "setSettings", settings: { categoryIds: ["food"], wordDisplay: "en", bogus: 1 } });
ok(s.status === 200 && s.json.view.settings.categoryIds.join() === "food" && s.json.view.settings.wordDisplay === "en", "settings applied");
const start = await act(host, { type: "startRound" });
ok(start.status === 200 && start.json.view.round?.phase === "clues" && start.json.view.round.number === 1, "round 1 started");
const views = {};
for (const p of players) views[p.playerId] = (await view(p)).json.view;
const imposterId = Object.values(views).find(v => v.round.you.isImposter)?.youId;
ok(Boolean(imposterId) && Object.values(views).filter(v => v.round.you.isImposter).length === 1, "exactly one imposter");
const crewView = Object.values(views).find(v => !v.round.you.isImposter);
const word = crewView.round.you.word;
ok(word && word.ml && word.en, `crew sees the word (${word?.en})`);
ok(views[imposterId].round.you.word === null && views[imposterId].round.imposterId === null && views[imposterId].round.category === null, "imposter sees no word/category");
ok(crewView.round.imposterId === null && crewView.round.word === null, "crew doesn't see imposter or public word yet");
ok(!JSON.stringify(views).includes('"token"'), "no tokens in views");
// clues in turn order
for (let i = 0; i < 4; i++) {
  const cur = (await view(host)).json.view.round;
  const turn = cur.turnId;
  const wrong = players.find(p => p.playerId !== turn);
  ok((await act(wrong, { type: "submitClue", text: "x" })).status === 409, `out-of-turn clue rejected (${i + 1})`);
  const who = players.find(p => p.playerId === turn);
  const r = await act(who, { type: "submitClue", text: `clue ${i + 1}` });
  ok(r.status === 200, `clue ${i + 1} accepted`);
}
let cur = (await view(host)).json.view.round;
ok(cur.phase === "vote" && cur.clues.length === 4, "all clues in → vote phase");
// everyone votes for the imposter; imposter votes for someone else
for (const p of players) {
  const target = p.playerId === imposterId ? players.find(x => x.playerId !== imposterId).playerId : imposterId;
  const r = await act(p, { type: "vote", targetId: target });
  ok(r.status === 200, `${p.name ?? "Host"} voted`);
}
cur = (await view(host)).json.view.round;
ok(cur.phase === "guess" && cur.eliminatedId === imposterId, "imposter caught → guess phase");
const imp = players.find(p => p.playerId === imposterId);
const impView = (await view(imp)).json.view.round;
ok(Array.isArray(impView.you.guessOptions) && impView.you.guessOptions.length === 5, "imposter gets 5 options");
ok((await view(players.find(p => p.playerId !== imposterId))).json.view.round.you.guessOptions === null, "crew gets no options");
const correct = impView.you.guessOptions.findIndex(w => w.ml === word.ml);
ok(correct >= 0, "real word is among the options");
const g = await act(imp, { type: "guess", index: correct });
ok(g.status === 200 && g.json.view.round.phase === "reveal" && g.json.view.round.guessedWord === true, "correct guess → reveal");
const rv = g.json.view;
ok(rv.round.imposterId === imposterId && rv.round.word.ml === word.ml, "reveal shows imposter and word");
ok(rv.players.find(p => p.id === imposterId).score === 2 && rv.players.filter(p => p.id !== imposterId).every(p => p.score === 1), "scores: imposter 2, crew 1 each");
ok(rv.roundsPlayed === 1, "roundsPlayed = 1");

console.log("4. round 2 (spoken, movies) + no repeats");
ok((await act(host, { type: "setSettings", settings: { clueMode: "spoken", imposterHint: true } })).status === 200, "switched to spoken + hint");
const r2 = await act(host, { type: "startRound", categoryIds: ["movies"] });
ok(r2.status === 200 && r2.json.view.round.number === 2 && r2.json.view.round.category?.id === "movies", "round 2 started in movies with hint visible");
ok((await act(host, { type: "submitClue", text: "x" })).status === 409, "typed clues rejected in spoken mode");
ok((await act(host, { type: "startVoting" })).json.view.round.phase === "vote", "host started voting");
const impId2 = (await Promise.all(players.map(async p => [(await view(p)).json.view.round.you.isImposter, p.playerId]))).find(([i]) => i)[1];
const victim = players.find(p => p.playerId !== impId2).playerId;
for (const p of players) if (p.playerId !== victim) await act(p, { type: "vote", targetId: victim });
const end2 = await act(host, { type: "endVoting" });
ok(end2.status === 200 && end2.json.view.round.phase === "reveal" && end2.json.view.round.eliminatedId === victim, "innocent voted out → reveal");
ok(end2.json.view.players.find(p => p.id === impId2).score >= 3, "imposter earned 3 for escaping");
// no repeat check across many rounds in a tiny selection would need many rounds; check keys differ so far
const w1 = word.ml, w2 = end2.json.view.round.word.ml;
ok(w1 !== w2, "different words in the two rounds");

console.log("5. continue through 25 rounds; only the host can finish the game");
ok((await act(players[1], { type: "endGame" })).status === 403, "another player cannot end the game");
let previous = end2.json.view;
for (let number = 3; number <= 25; number++) {
  const next = await act(host, { type: "startRound" });
  ok(next.status === 200 && next.json.view.round.number === number && next.json.view.status === "playing", `round ${number} started in the same room`);
  ok(next.json.view.players.every(p => p.score === previous.players.find(old => old.id === p.id).score), `round ${number} carries previous scores`);
  await act(host, { type: "startVoting" });
  const completed = await act(host, { type: "endVoting" });
  const current = completed.json.view;
  ok(completed.status === 200 && current.code === code && current.status === "playing" && current.round.phase === "reveal" && current.roundsPlayed === number, `round ${number} finishes without ending or losing the room`);
  ok(current.players.every(p => p.score === previous.players.find(old => old.id === p.id).score + (p.id === current.round.imposterId ? 3 : 0)), `round ${number} adds points exactly once`);
  previous = current;
}
const ended = await act(host, { type: "endGame" });
ok(ended.status === 200 && ended.json.view.status === "ended", "game ended");
ok(ended.json.view.players.every(p => p.score === previous.players.find(old => old.id === p.id).score), "host ending the game preserves final points");
ok((await view(host)).status === 200, "finished room remains available for the final standings");
ok((await api(`/api/rooms/${code}/join`, { method: "POST", body: { name: "Late" } })).status === 410, "cannot join an ended game");
const again = await act(host, { type: "backToLobby", resetScores: true });
ok(again.json.view.status === "lobby" && again.json.view.players.every(p => p.score === 0), "back to lobby with scores reset");

console.log("6. concurrency: 6 simultaneous joins");
const joins = await Promise.all(Array.from({ length: 6 }, (_, i) => api(`/api/rooms/${code}/join`, { method: "POST", body: { name: `P${i}` } })));
ok(joins.every(j => j.status === 201), "all concurrent joins succeeded");
const final = (await view(host)).json.view;
ok(final.players.length === 10, `room has 10 players (${final.players.length})`);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
