# Vendored third-party libraries

These files are bundled locally (not loaded from a CDN) so the app keeps
working offline and in restricted networks. Both are open source:

## qrcode.min.js

- Source: [`qrcode`](https://www.npmjs.com/package/qrcode) npm package, v1.5.4
  (by Ryan Day), bundled from its browser entry point into a single
  self-contained file exposing a global `QRCode`.
- License: MIT — Copyright (c) 2012 Ryan Day.
- Used for: generating QR codes on ID cards, book labels, and the QR
  Codes admin page.
- Includes a small bundled dependency, `dijkstrajs` (MIT, Andrei Karpushonak).

## jsQR.min.js

- Source: [`jsqr`](https://www.npmjs.com/package/jsqr) npm package, v1.4.0
  (by Cosmo Wolfe), official `dist/jsQR.js` build, exposing a global `jsQR`.
- License: Apache License 2.0.
- Used for: the camera-based QR scanner (Attendance/Library "Scan" pages) —
  decodes QR codes from video frames entirely on-device, nothing is
  uploaded anywhere.

Neither library was modified beyond bundling/minification of the official
source.
