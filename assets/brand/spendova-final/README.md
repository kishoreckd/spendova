# Spendova Logo Package

## Primary assets

- `spendova-logo-light.png` — horizontal lockup for white and light-neutral surfaces.
- `spendova-logo-dark.png` — horizontal lockup with an off-white wordmark for dark surfaces.
- `spendova-icon-dark.png` — icon-only dark-mode master with a midnight tile.
- `spendova-icon-light.png` — icon-only light-mode master with a cool-white tile.
- `spendova-icon-master.png` — original icon master; currently identical to the dark-mode master.

## Generated application assets

- `apple-touch-icon.png` — 180×180.
- `pwa-icon-192.png` — 192×192.
- `pwa-icon-512.png` — 512×512.
- `pwa-icon-dark-192.png` and `pwa-icon-dark-512.png` — dark-mode application icons.
- `pwa-icon-light-192.png` and `pwa-icon-light-512.png` — light-mode application icons.
- `favicon-16.png` — 16×16.
- `favicon-32.png` — 32×32.
- `favicon-48.png` — 48×48.

## Usage

Use the horizontal light logo in light navigation bars, authentication screens, reports, and marketing pages. Use the horizontal dark logo only over dark navy/slate surfaces. Use the icon-only version for mobile launchers, PWA installation, browser tabs, compact navigation, loading screens, and social avatars.

Do not place the horizontal wordmark at favicon or mobile-launcher sizes.

## HTML favicon example

```html
<link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon-16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

## PWA manifest example

```json
{
  "name": "Spendova",
  "short_name": "Spendova",
  "theme_color": "#071B33",
  "background_color": "#071B33",
  "display": "standalone",
  "icons": [
    {
      "src": "/brand/pwa-icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/brand/pwa-icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## Clear space and sizing

- Maintain clear space around the horizontal lockup equal to at least half the icon height.
- Do not display the horizontal lockup below approximately 140 CSS pixels wide.
- Use the icon-only mark below that size.
- Do not stretch, recolor, rotate, add effects, or place text inside the app icon.

## Production note

These files are polished raster masters derived with the built-in image generator. Before commercial release, recreate the approved geometry as SVG/vector artwork so edges, exact colors, one-color variants, print usage, and responsive scaling are fully controlled.
