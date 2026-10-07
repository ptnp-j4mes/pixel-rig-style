# Pixel Rig Style — 3D Map Editor

Web-based 3D map editor สำหรับวาง object สำเร็จรูป (บ้าน รั้ว โคม สิ่งประดับ) จากหลาย pack ลงบนพื้น
วางอิสระหรือสลับ snap 1m ได้ มองมุมสูง 40–55° บันทึก/เปิด map เป็นไฟล์ JSON

## ติดตั้ง

```bash
npm install
python3 scripts/gen_manifest.py   # หลังจากขั้นตอน copy asset ด้านล่าง
npm run dev                       # http://localhost:5173
```

## เตรียม asset (ครั้งเดียว)

asset pack ไม่ได้อยู่ใน git (สิทธิ์/ขนาด) — copy เอง:

```bash
mkdir -p public/packs/japan-village public/packs/village-pack
# Japan Village (zip): ใช้โฟลเดอร์ GLTF ข้างใน
ditto -x -k "/path/to/Free_JapanVillage.zip" /tmp/pack && ditto /tmp/pack/FreePack/GLTF public/packs/japan-village
# Village Pack (rar): ไฟล์ VillagePack.glb ไฟล์เดียว
bsdtar -xf "/path/to/VillagePack.rar" -C /tmp/pack && cp /tmp/pack/VillagePack.glb public/packs/village-pack/
python3 scripts/gen_manifest.py   # สแกน packs → manifest (คาดหวัง 35 + 84 objects)
```

## การใช้งาน

- **กล้อง:** ลากซ้าย = หมุน (ล็อกมุม 40–55°), ลากขวา = แพน, ล้อเมาส์ = ซูม, ปุ่มรีเซ็ตกล้อง
- **วาง:** เลือก pack → หมวด → object จาก palette ซ้าย (มี thumbnail, ค้นหาได้) → ghost เดินตามเมาส์ → คลิกวาง (วางซ้ำได้เรื่อย ๆ)
- **ตำแหน่ง:** วางอิสระเป็นค่าเริ่มต้น — ปุ่ม **Snap 1m** บน toolbar สลับการล็อกตำแหน่งลง grid 1 เมตร (ใช้กับการลากย้ายชิ้นที่เลือกด้วย)
- `R` หมุน 90°, `Esc` ยกเลิก/ยกเลิกเลือก, `Del` ลบ
- **แก้ไข:** คลิกชิ้น → แผงขวา (ตำแหน่ง/หมุน/สเกล)
- **ไฟล์:** บันทึก = ดาวน์โหลด .json, เปิดไฟล์ = เลือก .json, มี autosave ในเบราว์เซอร์ทุกครั้งที่แก้

## ทดสอบ

```bash
npm test   # node:test — snap/rotY/serialize logic
```
