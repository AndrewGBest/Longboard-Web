# Longboard-Web

The website for [Longboard](https://github.com/AndrewGBest/Longboard), a web
browser for the TV.

Plain files, no build step, nothing loaded from anywhere else:

| File | What |
|---|---|
| `index.html` | The page |
| `styles.css` | How it looks |
| `main.js` | The download picker and the demonstration TV |
| `assets/icon.svg` | Longboard's icon, copied from the Longboard repository |

## Downloads

The download buttons point at Longboard's latest GitHub release. As written
in the HTML they use GitHub's `releases/latest/download/<file>` addresses for
the two AppImages, so they work with scripts turned off. With scripts on,
`main.js` asks GitHub's public API for the latest release once and fills in
the version, the sizes and the exact address of every package (AppImage,
Flatpak, tar.gz, for x86-64 and ARM64). It picks the processor from the
visitor's browser. If the request fails, the page keeps the addresses it
started with.

## Looking at it

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Publishing

`.github/workflows/pages.yml` publishes the repository to GitHub Pages on a
push to `main`, once Pages is set to "GitHub Actions" in the repository's
settings.
