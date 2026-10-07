# Pixel Rig Style — 3D Map Editor

Web-based 3D map editor สำหรับต่อบ้าน/หมู่บ้านจากชุด Medieval Village MegaKit
บน grid 2 เมตร มองมุมสูง 40–55° ซูม/หมุนกล้องได้ บันทึก/เปิด map เป็นไฟล์ JSON

## ติดตั้ง

```bash
npm install
python3 scripts/gen_manifest.py   # หลังจากขั้นตอน copy asset ด้านล่าง
npm run dev                       # http://localhost:5173
```

## เตรียม asset (ครั้งเดียว)

asset ไม่ได้อยู่ใน git (license + ขนาด) — copy จาก zip เอง:

```bash
mkdir -p public/kit assets
ditto -x -k "/path/to/Medieval Village MegaKit[Standard].zip" assets/
ditto "assets/Medieval Village MegaKit[Standard]/glTF" public/kit
python3 scripts/gen_manifest.py
```

## การใช้งาน

- **กล้อง:** ลากซ้าย = หมุน (ล็อกมุม 40–55°), ลากขวา = แพน, ล้อเมาส์ = ซูม, ปุ่มรีเซ็ตกล้อง
- **วาง:** เลือกชิ้นจาก palette ซ้าย (ค้นหาได้) → ghost เดินตามเมาส์ → คลิกวาง (วางซ้ำได้เรื่อย ๆ)
- `R` หมุน 90°, `Esc` ยกเลิก/ยกเลิกเลือก, `Del` ลบ
- **แก้ไข:** คลิกชิ้น → แผงขวา (ตำแหน่ง/หมุน/สเกล) — ลากชิ้นที่เลือกเพื่อย้ายแบบ snap
- **ไฟล์:** บันทึก = ดาวน์โหลด .json, เปิดไฟล์ = เลือก .json, มี autosave ในเบราว์เซอร์ทุกครั้งที่แก้

## ทดสอบ

```bash
npm test   # node:test — snap/rotY/serialize logic
```
