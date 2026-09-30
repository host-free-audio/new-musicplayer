#!/usr/bin/env node
/**
 * Scans the songs/ folder and (re)writes manifest.json listing every audio
 * file found, so you don't have to hand-type entries for 50 tracks.
 *
 * Usage:
 *   node generate-manifest.js
 *
 * - Filenames like "Artist - Title.mp3" are split into artist/title automatically.
 * - Anything else uses the filename as the title with "Unknown artist".
 * - If manifest.json already has a custom artist/title for a file, this keeps
 *   it as-is instead of overwriting it — safe to re-run after adding more songs.
 */

const fs = require('fs');
const path = require('path');

const SONGS_DIR = path.join(__dirname, 'songs');
const MANIFEST_PATH = path.join(SONGS_DIR, 'manifest.json');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac']);

function guessArtistAndTitle(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  const parts = base.split(/\s*-\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: 'Unknown artist', title: base };
}

function main() {
  if (!fs.existsSync(SONGS_DIR)) {
    console.error(`No songs/ folder found at ${SONGS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SONGS_DIR)
    .filter(f => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log('No audio files found in songs/. Add some, then re-run this script.');
    return;
  }

  let existing = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      if (!Array.isArray(existing)) existing = [];
    } catch (err) {
      console.warn('Could not parse existing manifest.json — starting fresh.');
    }
  }
  const existingByFile = new Map(existing.map(e => [e.file, e]));

  const manifest = files.map(file => {
    if (existingByFile.has(file)) return existingByFile.get(file);
    const { artist, title } = guessArtistAndTitle(file);
    return { file, artist, title };
  });

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${manifest.length} track(s) to songs/manifest.json`);
}

main();
