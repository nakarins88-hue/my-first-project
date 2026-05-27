# Prompt ส่งไม้ต่อให้ Antigravity

โปรเจกต์: `nakarins88-hue/my-first-project` / Jeff Bernat Cozy Music Lounge

โปรดอ่าน `AGENT_HANDOVER.md` ก่อน แล้วทำงานต่อจากสถานะปัจจุบันนี้ โดยอย่ารื้อสถาปัตยกรรมเดิมของ `player-v8.js` ที่มี Tri-Engine Audio, IndexedDB, Ambient Mixer, Dark/Light Mode และ dashboard จัดการเพลง

## สิ่งที่ Codex ทำไปแล้ว

แก้/เพิ่มไฟล์เหล่านี้:

- `index.html`
- `player-v8.js`
- `style.css`
- เพิ่มไฟล์นี้ `ANTIGRAVITY_NEXT_PROMPT.md`

ฟีเจอร์ที่เพิ่มแล้ว:

1. เพิ่มแผง `Cozy Sessions` ใต้ Ambient Sound Mixer มี 4 preset:
   - `Rainy Night`
   - `Cafe Focus`
   - `Study Glow`
   - `Pure Music`
2. แต่ละ preset จะตั้งค่า mood theme, ambient channel volumes, visual intensity และสถานะเปิด/ปิด ambient ให้ในคลิกเดียว
3. บันทึก mood/session ลง `localStorage` ด้วย key:
   - `jeff_bernat_mood_theme`
   - `jeff_bernat_session_preset`
4. แก้บั๊ก light mode หลุดตอนเปลี่ยน mood โดยเปลี่ยนจากการ set `body.className = ...` เป็นการ add/remove เฉพาะ class `theme-*`
5. แก้บั๊ก seek/progress ของ Local/iTunes audio ให้ดู `currentEngine` ผ่าน helper `isHtml5AudioEngine()` แทนการอิง `useFallbackAudio` อย่างเดียว
6. แก้บั๊ก visualizer canvas ที่ใช้ `rgba(var(--accent-rgb), ...)` ตรง ๆ ใน Canvas API ซึ่งทำให้ console error ซ้ำทุกเฟรม โดยเปลี่ยนเป็นอ่าน CSS variable ผ่าน `getComputedStyle`
7. bump cache busting ใน `index.html` จาก `style.css?v=12` / `player-v8.js?v=12` เป็น `v=13`

## สิ่งที่ต้องทำต่อ

โปรดทำต่อดังนี้:

1. รัน static server ใน root โปรเจกต์ เช่น:
   ```bash
   python -m http.server 8000 --bind 127.0.0.1
   ```
   ถ้า port 8000 ใช้งานอยู่ ให้ใช้ port อื่น
2. เปิดเว็บใน browser แล้ว verify:
   - หน้าโหลดได้ ไม่มี syntax error
   - console ไม่มี error จาก `drawPlayerVisualizer`
   - ปุ่ม `Cozy Sessions` ทั้ง 4 ปุ่มแสดงครบและไม่ล้นบน desktop/mobile
   - กด `Rainy Night` แล้ว `body.dataset.session` เป็น `rainy-night`, rain slider เป็น `42`, fireplace เป็น `8`, cafe เป็น `0`, ambient master active
   - กด `Cafe Focus`, `Study Glow`, `Pure Music` แล้วค่า slider/theme/active state เปลี่ยนถูก
   - กดปุ่ม mood เดิมด้าน header แล้ว session preset active ถูก clear ออก
   - เปิด light mode แล้วกด mood/session แล้ว class `light-mode` ยังอยู่
   - เล่น Local File แล้ว progress/seek bar ใช้งานกับ `<audio>` จริง ไม่พยายาม seek YouTube
3. ถ้าเจอ layout mobile แน่นเกิน ให้ปรับ CSS เฉพาะ `.session-preset-*` แบบ responsive
4. ถ้า browser ยังโหลด `player-v8.js?v=12` ให้ hard reload หรือ clear cache เพราะ Codex bump เป็น `v=13` แล้ว
5. รันอย่างน้อย:
   ```bash
   node --check player-v8.js
   git diff --check
   ```
6. สรุปผลและบอกไฟล์ที่แก้

## Prompt สั้นสำหรับวางให้ Antigravity

ช่วยทำงานต่อจากไฟล์ `ANTIGRAVITY_NEXT_PROMPT.md` นี้ใน root โปรเจกต์ อ่าน `AGENT_HANDOVER.md` ก่อน แล้ว verify/ปรับปรุงฟีเจอร์ `Cozy Sessions` ที่ Codex เพิ่งเพิ่มใน `index.html`, `player-v8.js`, `style.css` ให้สมบูรณ์ เช็ค console/browser/mobile/light mode/audio seek ให้ครบ ห้ามรื้อระบบ Tri-Engine Audio, IndexedDB, Ambient Mixer และ Dark/Light Mode เดิม ถ้าเจอบั๊กให้แก้แบบ scoped แล้วรัน `node --check player-v8.js` และ `git diff --check` ก่อนสรุปงาน

