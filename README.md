# MarkdownNotes

A self-hosted, file-based Zettelkasten notes app that replicates [Logseq](https://logseq.com/)'s day-to-day UX — daily journals, a block outliner, hashtags, full-text search — while keeping plain markdown files as the source of truth. No proprietary database, no lock-in: your notes are just `.md` files on disk that any tool (or sync service) can read.

## Features

- **Daily journals** — a continuous, windowed feed of dated entries, just like Logseq's journal view
- **Block outliner editor** — indent/outdent, collapse/expand, markers (`TODO`/`DOING`/`NOW`/`LATER`/`WAITING`/`DONE`/`CANCELED`), matching Logseq's keyboard model
- **Pages** — freeform named pages alongside journals, with a namespace convention (`Parent/Child`)
- **Hashtags** — `#tag` chips with a dedicated tag view and fast lookup
- **Full-text search** — SQLite FTS5, embedded (no extra services), reachable via Cmd+K
- **To Dos dashboard** — every open to-do across your vault, grouped by category tag (any hashtag ending in `ToDo`, e.g. `#WWTToDo`), with click-to-check-off that toggles the marker without deleting history
- **Images** — paste or drag-and-drop, with drag-to-resize persisted back into the markdown
- **Mobile-friendly** — responsive layout with an off-canvas sidebar, usable from a phone browser
- **Live sync across devices** — if you run multiple instances against the same vault (e.g. via [Resilio Sync](https://www.resilio.com/individuals/), Syncthing, Dropbox), each instance polls for external changes and updates in place, with conflict detection if the same block was edited on both sides
- **Optional spellcheck** — via a self-hosted or public [LanguageTool](https://languagetool.org/) server; disabled by default, nothing is sent externally unless you configure it

## On-disk format

```
vault/
  journals/2026_09_21.md          # YYYY_MM_DD.md
  pages/My_Page.md
  pages/N___P___Apple.md          # "___" encodes a "/" namespace separator, e.g. "N/P/Apple"
  assets/image_1760108782511_0.png
  .markdownnotes/config.json      # favorites, recents, open tabs, theme
```

Blocks are tab-indented `- ` list items — the same convention Logseq itself uses on disk — so an existing Logseq graph can be dropped straight into `vault/` and should just work, and files stay readable/editable outside the app.

## Quick start (Docker)

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
git clone https://github.com/DennisFaucher/MarkdownNotes.git
cd MarkdownNotes
cp .env.example .env
# edit .env — at minimum, set TZ to your timezone
docker compose up -d --build
```

Open `http://localhost:3000` (or whatever `PORT` you set). Your notes are written to `./vault` (or wherever `VAULT_HOST_PATH` in `.env` points).

## Configuration

All configuration lives in `.env` (see `.env.example` for the full list with explanations):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the app is reachable on |
| `BIND_ADDR` | `127.0.0.1` | Host interface to bind — set to `0.0.0.0` to expose on your LAN. **There is no authentication on the app itself**, so only do this on a trusted network |
| `VAULT_HOST_PATH` | `./vault` | Where your markdown vault lives on the host |
| `PUID` / `PGID` | `1000` / `1000` | Host user/group to run as on Linux, so vault files aren't written as root |
| `TZ` | `UTC` | Your IANA timezone — needed so "today" in Journals matches your local date |
| `LANGUAGETOOL_URL` | unset | Optional LanguageTool server for spell/grammar checking; feature is off unless set |
| `LANGUAGETOOL_LANGUAGE` | `en-US` | Language code passed to LanguageTool |

## Usage

- **Journals**: the default view — scroll back through past days, or jump to today. Type `TODO`, `DOING`, `NOW`, `LATER`, `WAITING`, or `DONE` at the start of a block to mark it, then click the marker badge to toggle it done/open without deleting the block.
- **Tagging**: type `#` anywhere in a block to tag it; typing `#SomethingToDo` (any tag ending in `ToDo`) automatically groups that block under **To Dos** in the sidebar, sorted by category.
- **Pages**: create a page by linking to it or via **All pages** in the sidebar; star any page or journal day to pin it under **Favorites**.
- **Search**: press `Cmd+K` (or `Ctrl+K`) to full-text search across your whole vault.
- **Images**: paste from your clipboard or drag a file into a block; drag the image's corner handle to resize (persists as `{:height H, :width W}` in the markdown, Logseq-compatible).
- **Multiple devices**: point two or more MarkdownNotes instances (e.g. one on a desktop, one on a home server) at the same vault directory via a file-sync tool. Each instance polls for changes made elsewhere and refreshes automatically; if the exact same block is edited on both sides before syncing, you'll see a conflict banner rather than a silent overwrite.

## Local development (without Docker)

```bash
npm install                 # installs both server/ and web/ workspaces
npm run dev:server          # server on :3000, watching server/src
npm run dev:web             # Vite dev server on :5173, proxied to the API
```

Or use the dev Compose override, which does the same inside containers with hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Testing

```bash
npm run test              # unit + fixture-based round-trip tests (server workspace)
npm run test:roundtrip    # additional round-trip test against a real vault path,
                           # set VAULT_PATH to point at your own — skipped if unset
```

The round-trip suite is the load-bearing one: it asserts that parsing and re-serializing a markdown file reproduces it byte-for-byte, which is what makes it safe for this app and Logseq (or any other tool) to edit the same files.

## Architecture

- **Backend** (`server/`): Node.js + TypeScript + Express, serving both the JSON API and the built frontend. A file watcher (chokidar) keeps an embedded SQLite (FTS5) index in sync with the vault for search/tags; the index is disposable and rebuilt from the markdown on startup.
- **Frontend** (`web/`): React + Vite. Unfocused blocks render as static parsed HTML; the currently-focused block mounts a single auto-growing `<textarea>` — the same approach Logseq itself uses, chosen to avoid the IME/mobile-composition problems of a `contenteditable`-based editor.
- Writes use targeted line-splicing (only the edited block's lines are rewritten), plus a pre-write round-trip assertion, so a parser bug can't silently corrupt an entire file.

## License

No license file yet — treat this as source-available, personal-use software unless/until one is added.
