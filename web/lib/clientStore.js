import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const CLIENTS_INDEX = path.join(DATA_DIR, "clients.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CLIENTS_INDEX)) {
    fs.writeFileSync(CLIENTS_INDEX, "[]", "utf-8");
  }
}

function readIndex() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(CLIENTS_INDEX, "utf-8"));
}

function writeIndex(clients) {
  fs.writeFileSync(CLIENTS_INDEX, JSON.stringify(clients, null, 2), "utf-8");
}

export function clientDir(id) {
  return path.join(DATA_DIR, "clients", id);
}

export function profilesDir(id) {
  return path.join(clientDir(id), "profiles");
}

export function listClients() {
  return readIndex().sort((a, b) => a.naam.localeCompare(b.naam));
}

export function createClient(naam) {
  const clients = readIndex();
  const id = crypto.randomUUID();
  const client = { id, naam, sector: null, createdAt: new Date().toISOString() };
  clients.push(client);
  writeIndex(clients);

  fs.mkdirSync(profilesDir(id), { recursive: true });
  writeAnswers(id, { sector: null, impact: {}, readiness: {} });

  return client;
}

export function getClientMeta(id) {
  return readIndex().find((c) => c.id === id) ?? null;
}

export function updateClientMeta(id, patch) {
  const clients = readIndex();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  clients[idx] = { ...clients[idx], ...patch };
  writeIndex(clients);
  return clients[idx];
}

export function deleteClient(id) {
  const clients = readIndex().filter((c) => c.id !== id);
  writeIndex(clients);
  fs.rmSync(clientDir(id), { recursive: true, force: true });
}

function answersPath(id) {
  return path.join(clientDir(id), "answers.json");
}

export function readAnswers(id) {
  const p = answersPath(id);
  if (!fs.existsSync(p)) return { sector: null, impact: {}, readiness: {} };
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function writeAnswers(id, answers) {
  fs.mkdirSync(clientDir(id), { recursive: true });
  fs.writeFileSync(answersPath(id), JSON.stringify(answers, null, 2), "utf-8");
}

export function rosterPath(id) {
  const dir = clientDir(id);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("roster."));
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

export function listProfileFiles(id) {
  const dir = profilesDir(id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

export function resultsPath(id) {
  return path.join(clientDir(id), "results.json");
}

export function readResults(id) {
  const p = resultsPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function writeResults(id, results) {
  fs.mkdirSync(clientDir(id), { recursive: true });
  fs.writeFileSync(resultsPath(id), JSON.stringify(results, null, 2), "utf-8");
}
