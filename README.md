# Spool

A personal music player, built mobile-first, that you host for free on GitHub Pages. Bundle your own songs into the site so they're always there when you open it on your phone — no upload step, no backend, no account.

## How it works

Spool is a static site (HTML/CSS/JS only, no server, no database), so it runs entirely for free on GitHub Pages. Your songs live as actual files in the repo, listed in `songs/manifest.json`. When you open the site, it reads that list and loads them automatically — the same library shows up every time, on any device, because the songs are shipped with the site itself.

Playlists you create are saved in your phone's browser storage, so they survive closing the tab or restarting your phone — but they're local to that one browser (Safari, Chrome, etc. each have separate storage, and clearing browser data wipes them).

## Adding your songs (works for 1 or 50+ at once)

1. **Drop your audio files into the `songs/` folder** — mp3, m4a, wav, ogg, flac, or aac. Name them `Artist - Title.mp3` if you want that split automatically; otherwise the filename becomes the title.
2. **Run the manifest generator** from a terminal inside the project folder:
   ```bash
   node generate-manifest.js
   ```
   This scans `songs/` and writes `songs/manifest.json` for you — no manual JSON editing, even for 50 files. Re-run it any time after adding more songs; it won't overwrite artist/title you've already customized for existing files.
3. **Commit and push** everything (the audio files and the updated `manifest.json`).

No Node.js on hand? You can also hand-edit `songs/manifest.json` directly — see the format further down.

**Copyright note:** GitHub repos are public, so only bundle audio you actually have the rights to use (your own recordings, royalty-free tracks, purchased/licensed files) — not commercial tracks you don't own.

## Deploying to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```
Then on GitHub: **Settings → Pages** → Source: "Deploy from a branch" → branch `main`, folder `/ (root)` → Save. Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/` within a minute or two.

For a **private** GitHub repo, Pages requires a paid GitHub plan. On the free plan, the repo (and therefore your songs) is public — anyone with the link can view/download them.

## Using it on your phone

- Open your `github.io` link in your phone's browser.
- **iPhone (Safari):** tap the Share icon → "Add to Home Screen".
- **Android (Chrome):** tap the ⋮ menu → "Add to Home screen" or "Install app".
- **Installing it this way matters, not just for convenience:** browsers give installed (standalone) apps much better treatment for continuing audio playback in the background — including automatically advancing to the next track when your screen is off. A regular browser tab can get its background execution throttled by the OS in ways that occasionally interrupt that. If you notice tracks pausing instead of advancing with the screen off, installing via "Add to Home Screen" is the main thing that helps.
- Playback shows lock-screen/notification controls (play, pause, skip) on supported browsers.

## After you push updates

Mobile browsers cache JS/CSS aggressively. If you edit the code and push to GitHub but your phone doesn't seem to pick up the change, do a hard refresh (in Chrome: Settings → Privacy → Clear browsing data → Cached images and files), or bump the `?v=2` query strings on the `<link>`/`<script>` tags in `index.html` to `?v=3`, etc. — a version bump forces the browser to treat it as a new file.

## Features

- Bundled library, loaded automatically from `songs/manifest.json`
- Manual upload also still works (adds tracks for that browsing session only)
- Play all / shuffle all from the library
- Playlists: create, add tracks, remove tracks, delete playlists — all saved locally
- Full-screen "Now Playing" view on mobile (tap the mini player to open it)
- Search by title or artist
- Bottom tab bar and large touch targets for one-handed phone use

## Updating your manifest by hand (optional)

If you'd rather skip the script, `songs/manifest.json` is a plain list:
```json
[
  { "file": "midnight-drive.mp3", "artist": "Your Artist", "title": "Midnight Drive" },
  { "file": "sunday-morning.mp3" }
]
```
`artist` and `title` are optional per entry — omit them and the app guesses from the filename. Just make sure `"file"` matches the filename in `songs/` **exactly, including capitalization** — GitHub Pages' server is case-sensitive, even if your computer isn't, so `Song.mp3` and `song.mp3` are different files there. There's a comma between entries but not after the last one.

Filenames with spaces, apostrophes, or other special characters are handled automatically (URL-encoded internally) — no need to rename your files to avoid spaces.

## Running it locally

```bash
python3 -m http.server 8000
# or, if you don't have Python:
npx serve
```
Then visit the printed `localhost` URL. Note: bundled songs only load over `http://`/`https://` (not by double-clicking `index.html`), since the browser blocks that kind of file access from `file://` pages.

## Design notes

The visual identity is its own thing rather than a copy of any existing app — deep ink background, warm amber accent, Space Grotesk/Inter type. Adjust the palette in `css/style.css` under the `:root` variables at the top.

## Going further

If you ever want your library shared across multiple people (not just synced to your own phone), the next step is a small backend — Firebase or Supabase are the easiest ways to add shared storage and accounts without running your own server. The current bundled-songs approach is simpler and free, and fits a single-person library perfectly.
