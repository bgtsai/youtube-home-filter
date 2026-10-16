# YouTube Home Filter: Industrial Standard

**English** | [繁體中文](README.zh.md)

A Tampermonkey userscript that filters the YouTube home feed. Hide videos by age, type, or watch progress; keep the channels you care about with whitelists; and act on recommendations without opening the three-dot menu.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Firefox or Chrome).
2. [**Install the script**](https://raw.githubusercontent.com/bgtsai/youtube-home-filter/main/youtube-home-filter.user.js)
3. Reload the YouTube home page. A control pill appears at the bottom of the screen.

Auto-update is enabled, so Tampermonkey will prompt you when a new version is pushed.

## Features

### Filter by age

Hide anything older than a given threshold — any value from seconds to years. The script reads the "x months ago" metadata on each card, so it works in every interface language.

### Filter by video type

Each type has its own toggle:

| Type | Notes |
|---|---|
| Regular videos | Hides everything *except* the special types below — useful for a feed of only live streams or playlists |
| Live streams | Currently broadcasting |
| Scheduled / premieres | Detected by the "Notify me" button on the card, not by keywords, so it is language-independent |
| Music | Detected by the music badge icon |
| Members-only | Detected by the members badge icon |
| Podcasts | |
| Mixes | |
| Playlists | |

### Filter by watch progress

Hide videos you have already watched, based on the progress bar YouTube draws on the thumbnail. Two independent thresholds, either of which marks a video as watched:

- **Percentage** — e.g. hide anything past 3% of its length
- **Absolute seconds** — e.g. hide anything past 15 seconds

The second threshold exists because a 3% threshold on a three-hour video is over five minutes.

### Title keyword filter

Hide videos whose titles match your own list of keywords or regular expressions.

### Channel whitelists

Two separate whitelists that override the type filters, so you can hide a whole category while keeping specific channels:

- **Music whitelist** — keeps these channels even when music is hidden
- **Members-only whitelist** — keeps these channels even when members-only content is hidden

Add channels by hovering a card and clicking the avatar button, or type them into the whitelist panel.

### Quick feedback buttons

Hovering a card shows buttons that send YouTube's own feedback actions directly, without opening the three-dot menu:

- **Don't recommend this channel**
- **I don't like this video** — sends the dismissal plus the reason, in one click
- **Not interested**
- **Already watched** — sends the dismissal plus the reason, in one click

Every action shows an undo card. Which buttons appear is configurable; by default only the first two are shown.

Videos you remove stay removed for the rest of the page session, even if the feed re-renders.

### Other

- **Auto-fetch** — scrolls to load more videos when filtering leaves the feed too sparse
- **Grid columns** — override how many videos per row (default 4)
- **Enhanced tooltips** — full, untruncated video titles on hover
- **Open links in a new tab**
- **Light / dark / auto theme**
- **Multi-language UI** with a custom-language editor, plus a custom keyword editor for the detection patterns

## Compatibility

Developed and tested on **Firefox + Tampermonkey**. **Chrome** is supported: the script installs a Trusted Types policy so its UI renders under YouTube's Chrome-only Trusted Types enforcement.

All DOM selectors live in a single `YT_SELECTORS` object near the top of the file. When YouTube changes its markup, that object is usually the only thing that needs updating.

## Credits

Written by BGTsai with Gemini and Claude.

## License

[MIT](LICENSE)
