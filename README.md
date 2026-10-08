# Pixel Rig Style — 3D Map Editor

Web-based 3D map editor สำหรับวาง object สำเร็จรูป (บ้าน รั้ว โคม สิ่งประดับ) จากหลาย pack ลงบนพื้น
วางอิสระหรือสลับ snap 1m ได้ มองมุมสูง 40–55° บันทึก/เปิด Project เป็นไฟล์ `.project.json`

## ติดตั้ง

```bash
npm install
python3 scripts/gen_manifest.py   # หลังจากขั้นตอน copy asset ด้านล่าง
npm run dev                       # http://localhost:5173
```

## เตรียม asset (ครั้งเดียว)

ไฟล์ asset ใน `assets/` และ `public/packs/` รวมไว้ใน `village-pack-assets.zip` ซึ่งเป็นไฟล์ local-only และไม่อยู่ใน Git หากมี ZIP นี้ให้แตกจาก root ของ repo; หากไม่มี ให้ติดตั้ง base pack จากไฟล์ต้นฉบับที่คุณมีสิทธิ์ใช้:

```bash
unzip -o village-pack-assets.zip -d .
mkdir -p public/packs/japan-village public/packs/village-pack
# Japan Village (zip): ใช้โฟลเดอร์ GLTF ข้างใน
ditto -x -k "/path/to/Free_JapanVillage.zip" /tmp/pack && ditto /tmp/pack/FreePack/GLTF public/packs/japan-village
# Village Pack (rar): ไฟล์ VillagePack.glb ไฟล์เดียว
bsdtar -xf "/path/to/VillagePack.rar" -C /tmp/pack && cp /tmp/pack/VillagePack.glb public/packs/village-pack/
python3 scripts/generate_village_roads.py  # เพิ่มถนน 5 ชิ้นใน Village Pack
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/generate_village_environment.py
python3 scripts/gen_manifest.py            # สแกน packs → manifest (35 + 110 objects)
python3 scripts/create_asian_village_reference.py # สร้าง maps/asian-village-reference.json
```

## การใช้งาน

- **กล้อง:** ลากเมาส์ปุ่มซ้ายหรือปุ่มขวา = หมุนรอบจุดกลางได้ 360° (ล็อกมุมสูง 40–55°), ปัดนิ้วเดียว = หมุน, ล้อเมาส์ = ซูม, ปุ่มรีเซ็ตกล้อง; ใช้ Pan tool แล้วลากปุ่มซ้ายเพื่อแพน
- **วาง:** เลือก pack → หมวด → object จาก palette ซ้าย (มี thumbnail, ค้นหาได้) → ghost เดินตามเมาส์ → คลิกวาง (วางซ้ำได้เรื่อย ๆ)
- **ตำแหน่ง:** วางอิสระเป็นค่าเริ่มต้น — ปุ่ม **Snap 1m** บน toolbar สลับการล็อกตำแหน่งลง grid 1 เมตร (ใช้กับการลากย้ายชิ้นที่เลือกด้วย)
- `R` หมุน 90°, `Esc` ยกเลิก/ยกเลิกเลือก, `Del` ลบ
- **แก้ไข:** คลิกชิ้น → แผงขวา (ตำแหน่ง/หมุน/สเกล)
- **Project:** บันทึกเป็น `<ชื่อแผนที่>.project.json` พร้อม object, layer/group, จุดเกิด และรหัส Asset Pack; โมเดลยังโหลดจาก pack ที่ติดตั้งใน web app
- **Play mode:** ตั้งจุดเกิดโดยเลือกปุ่มแล้วคลิกพื้น, กด **เล่น**, ใช้ WASD/ปุ่มลูกศรเดินและเมาส์หมุนมุมมอง; Esc ปล่อยเมาส์ แล้วกดกลับไปแก้ไขเพื่อออก
- **ไฟล์:** เปิด Project ได้ทั้ง `.project.json` และ map `.json` รุ่นเดิม; มี autosave ในเบราว์เซอร์ทุกครั้งที่แก้
- **ฉากตัวอย่าง:** เปิด `maps/asian-village-reference.json` เพื่อโหลดหมู่บ้านที่ประกอบจาก Village Pack

## Layers, Group และเครื่องมือแก้ไข

- แผงขวาแสดง tree `Layer > Group > Obj` ตลอดเวลา คลิก Obj หรือ Group ใน tree เพื่อเลือกและแก้ transform ใน Inspector
- ปุ่มวงกลม/เครื่องหมายถูกหน้า Layer ใช้ตั้ง active layer สำหรับ object ที่จะวางครั้งถัดไป การเลือก active layer ไม่เปลี่ยน selection ในฉาก
- ปุ่ม Layer สร้าง layer ใหม่; ปุ่มตาใช้ซ่อน/แสดง และปุ่มกุญแจใช้ล็อก/ปลดล็อก layer, group หรือ object
- เลือก checkbox ของ Obj ตั้งแต่ 2 ชิ้น แล้วกด Group เพื่อจัดกลุ่ม; ปุ่มลูกศรที่แถว Group ใช้ Ungroup โดยคงตำแหน่งเดิม
- Group ใหม่ปรับสเกลเท่ากันทั้งสามแกน; Group จากไฟล์ที่มีสเกลแต่ละแกนไม่เท่ากันจะคงค่าเดิมไว้ ต้องกด **สเกล 1:1:1** ก่อน Ungroup หรือย้าย Obj ออกจาก Group นั้น
- ปุ่มดินสอเปลี่ยนชื่อ และปุ่ม × ลบ object; การลบ layer จะย้ายรายการข้างในไป Default Layer
- ลากแถวใน tree เพื่อเรียงลำดับ หรือย้าย object/group ไปยัง layer และ group ที่รองรับ
- **Select / Pan / Move:** Select ใช้เลือก object, Pan ใช้ลากเลื่อนมุมมอง, Move ใช้ลาก object หรือ group ที่เลือก; ใน Select/Move ปัดหนึ่งนิ้วบนพื้นที่ว่างเพื่อหมุนกล้อง และ pinch สองนิ้วเพื่อซูม/แพน; เลือก Pan เพื่อใช้หนึ่งนิ้วเลื่อนมุมมอง
- ปุ่มลูกศรวนซ้าย/ขวาและคีย์ลัด `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` ใช้ Undo/Redo การแก้ไข map
- ไอคอน Move: [Designed by Grand Iconic from Flaticon](https://www.flaticon.com/free-icon/four-arrows_11310854)

## ทดสอบ

```bash
npm test   # node:test — snap/rotY/serialize logic
```
