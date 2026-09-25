# ORB RUSH

Game Line 98 neon cho YouTube Playables. Nối 5 quả cầu cùng màu (ngang, dọc, chéo), nổ combo, phá kỷ lục.

## Chơi local

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`.

## Build nộp YouTube

```bash
npm run build
```

Zip toàn bộ thư mục `dist/` (phải có `index.html` ở gốc zip). Nộp qua [YouTube Playables](https://developers.google.com/youtube/gaming/playables).

SDK được load trước game code, có `firstFrameReady` / `gameReady`, pause-resume, mute, save/load và `sendScore`.
