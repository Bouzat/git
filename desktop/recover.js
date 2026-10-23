// Récupération de sauvegardes : lit (sans rien modifier) les fichiers LevelDB du « localStorage » de l'application
// (dossier Local Storage/leveldb du profil Electron) et en extrait toutes les versions encore présentes de la sauvegarde
// du jeu, y compris des versions anciennes ou effacées que LevelDB n'a pas encore compactées.
const fs = require("fs");
const path = require("path");

// ---------- Snappy (compression des blocs LevelDB) ----------
function snappy(buf) {
  let p = 0, len = 0, shift = 0, b;
  do { b = buf[p++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
  const out = Buffer.alloc(len); let o = 0;
  while (p < buf.length && o < len) {
    const tag = buf[p++], t = tag & 3;
    if (t === 0) {
      let l = tag >> 2;
      if (l >= 60) { const n = l - 59; l = 0; for (let i = 0; i < n; i++) l |= buf[p++] << (8 * i); }
      l += 1; buf.copy(out, o, p, p + l); p += l; o += l;
    } else {
      let l, off;
      if (t === 1) { l = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | buf[p++]; }
      else if (t === 2) { l = (tag >> 2) + 1; off = buf[p] | (buf[p + 1] << 8); p += 2; }
      else { l = (tag >> 2) + 1; off = buf.readUInt32LE(p); p += 4; }
      for (let i = 0; i < l; i++, o++) out[o] = out[o - off];
    }
  }
  return out;
}
function varint(buf, p) { let v = 0, s = 0, b; do { b = buf[p++]; v += (b & 0x7f) * Math.pow(2, s); s += 7; } while (b & 0x80); return [v, p]; }

// ---------- valeurs du localStorage ----------
// Chromium : clé « _file://\0\1<clé> », valeur préfixée par 0 (UTF-16LE) ou 1 (Latin-1)
const KEY = "esports-manager-save";
function decodeValue(v) {
  if (!v || !v.length) return null;
  if (v[0] === 0) return v.slice(1).toString("utf16le");
  if (v[0] === 1) return v.slice(1).toString("latin1");
  return null;
}
function addFound(found, key, val) {
  const k = key.toString("latin1");
  if (!k.includes(KEY)) return;
  const s = decodeValue(val);
  if (s && (s.startsWith("Z1:") || s.startsWith("{"))) found.push(s);
}
// fichier .log : enregistrements de 32 Ko regroupés en WriteBatch (put : type 1, clé, valeur)
function scanLog(buf, found) {
  const BLOCK = 32768; let p = 0, rec = [];
  const batches = [];
  while (p + 7 <= buf.length) {
    const left = BLOCK - (p % BLOCK);
    if (left < 7) { p += left; continue; }
    const len = buf.readUInt16LE(p + 4), type = buf[p + 6];
    if (!type && !len) { p += left; continue; }
    const data = buf.slice(p + 7, p + 7 + len); p += 7 + len;
    if (type === 1) batches.push(data);
    else if (type === 2) rec = [data];
    else if (type === 3) rec.push(data);
    else if (type === 4) { rec.push(data); batches.push(Buffer.concat(rec)); rec = []; }
  }
  for (const b of batches) {
    let q = 12;
    try {
      while (q < b.length) {
        const kind = b[q++]; let kl, vl;
        [kl, q] = varint(b, q); const key = b.slice(q, q + kl); q += kl;
        if (kind === 1) { [vl, q] = varint(b, q); const val = b.slice(q, q + vl); q += vl; addFound(found, key, val); }
      }
    } catch (e) { }
  }
}
// fichier .ldb / .sst : blocs de données (index en fin de fichier), compressés ou non
function scanTable(buf, found) {
  if (buf.length < 48) return;
  const foot = buf.length - 48;
  let p = foot; let x;
  [x, p] = varint(buf, p); [x, p] = varint(buf, p);           // metaindex
  let idxOff, idxSize; [idxOff, p] = varint(buf, p); [idxSize, p] = varint(buf, p);
  const readBlock = (off, size) => {
    const raw = buf.slice(off, off + size), ctype = buf[off + size];
    return ctype === 1 ? snappy(raw) : raw;
  };
  const entries = blk => {
    const n = blk.readUInt32LE(blk.length - 4), end = blk.length - 4 - 4 * n, out = [];
    let q = 0, last = Buffer.alloc(0);
    while (q < end) {
      let sh, ns, vl; [sh, q] = varint(blk, q); [ns, q] = varint(blk, q); [vl, q] = varint(blk, q);
      const key = Buffer.concat([last.slice(0, sh), blk.slice(q, q + ns)]); q += ns;
      const val = blk.slice(q, q + vl); q += vl; out.push([key, val]); last = key;
    }
    return out;
  };
  try {
    for (const [, handle] of entries(readBlock(idxOff, idxSize))) {
      let off, size, r = 0; [off, r] = varint(handle, r); [size, r] = varint(handle, r);
      try { for (const [key, val] of entries(readBlock(off, size))) addFound(found, key.slice(0, Math.max(0, key.length - 8)), val); } catch (e) { }
    }
  } catch (e) { }
}
// toutes les sauvegardes trouvées dans un dossier de profil (dédoublonnées)
function scanProfile(userData) {
  const found = [];
  for (const dir of [path.join(userData, "Local Storage", "leveldb")]) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { continue; }
    for (const f of files) {
      const full = path.join(dir, f);
      try {
        if (f.endsWith(".log")) scanLog(fs.readFileSync(full), found);
        else if (f.endsWith(".ldb") || f.endsWith(".sst")) scanTable(fs.readFileSync(full), found);
      } catch (e) { }
    }
  }
  return [...new Set(found)];
}
module.exports = { scanProfile };
