# Test Case / Test Scenario (ระบบจริงเท่านั้น) — หัวข้อ 1–10

> รูปแบบตาราง (Copy ไปวาง Word/Google Docs ได้เลย)

คอลัมน์: `TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง`

---

## 1) Intern Feedback + แนบไฟล์/วิดีโอ

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| IF-01 | Feedback Submission (reflection + program feedback + rating) | Intern | ล็อกอินแล้ว (Role=INTERN) | เข้าเมนู `Feedback` > เลือกช่วงประเมิน (milestone) > กรอกข้อความ reflection + program feedback + เลือกดาว > กด Submit | เกิดการบันทึกข้อมูลสำเร็จ และสถานะ milestone เป็น `submitted` |
| IF-02 | Feedback Attachments Upload | Intern | ล็อกอินแล้ว | ในหน้า `Feedback` เลือกแนบไฟล์ (1+ ไฟล์) > กด Submit | ไฟล์ถูกอัปโหลดขึ้น Storage และมีรายการ attachments แสดง/เปิดได้ |
| IF-03 | Feedback Video Upload | Intern | ล็อกอินแล้ว | ในหน้า `Feedback` เลือกอัปโหลดวิดีโอ > กด Submit | วิดีโอถูกอัปโหลดขึ้น Storage และสามารถกด OPEN เพื่อดูได้ |
| IF-04 | Feedback Review View | Supervisor | ล็อกอินแล้ว (Role=SUPERVISOR) และมี intern ในความรับผิดชอบ | Supervisor เปิด intern > ไปแท็บ `Feedback` > เลือกช่วงประเมิน | เห็นข้อมูลที่ intern ส่งครบ (ข้อความ/ดาว/ไฟล์แนบ/วิดีโอ) |
| IF-05 | Mentor Evaluation Save (score/comment) | Supervisor | มี submission แล้ว | กรอกคะแนน (technical score) + กรอก comment > กด Save/Deploy | บันทึก `supervisorScore` + `supervisorComments` และสถานะเป็น `reviewed` |
| IF-06 | Feedback Result View | Intern | Supervisor รีวิวแล้ว | Intern เปิดช่วงประเมินเดิม | เห็นคะแนน + คอมเม้นจาก supervisor แสดงในหน้าฝั่ง intern |
| IF-07 | Feedback Result View (read-only) | Admin | ล็อกอินแล้ว (Role=HR_ADMIN) | Admin เข้า `Intern Management` > เลือก intern > เปิดแท็บ feedback | เห็นข้อมูล feedback + ไฟล์/วิดีโอ + คะแนน/คอมเม้น (โหมดอ่านอย่างเดียว) |

---

## 2) Self Evaluation

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| SE-01 | Self Evaluation Save (selfPerformance/selfSummary) | Intern | ล็อกอินแล้ว (Role=INTERN) | เข้าเมนู `Self Evaluation` > ใส่คะแนน 4 หมวด + summary > กด Save | บันทึก `selfPerformance`, `selfSummary`, `selfEvaluatedAt` ลง `users/{uid}` สำเร็จ |
| SE-02 | Overall Rating Calculation (AVG) | Intern | กรอกคะแนนแล้ว | ปรับคะแนนขึ้น/ลง 4 หมวด | ค่าเฉลี่ย/overall ถูกคำนวณและแสดงผลตามคะแนนล่าสุด |
| SE-03 | Supervisor Evaluation Save (supervisorPerformance/supervisorSummary) | Supervisor | ล็อกอินแล้ว และเลือก intern ได้ | Supervisor เปิดหน้า intern (overview) > กรอกคะแนน + summary > กด Save Evaluation | บันทึก `supervisorPerformance`, `supervisorSummary`, `supervisorEvaluatedAt` ลง `users/{internId}` สำเร็จ |
| SE-04 | Admin View Evaluation Source (SELF/SUPERVISOR) | Admin | ล็อกอินแล้ว (Role=HR_ADMIN) | Admin เข้า `Intern Management` > เลือก intern > สลับแท็บดู `Intern(SELF)` และ `Supervisor` | แสดงคะแนน/summary ตรงตามแหล่งข้อมูลที่เลือก |

---

## 3) เพิ่มแท็บ Policy & Training ใน System Settings (Admin)

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| PT-TAB-01 | Policy & Training Tab Rendering | Admin | ล็อกอินแล้ว (Role=HR_ADMIN) | เข้าเมนู `System Settings` | เห็นแท็บ `Policy & Training` ในหน้า settings |
| PT-TAB-02 | Policy & Training Manager Mount | Admin | ล็อกอินแล้ว | คลิกแท็บ `Policy & Training` | แสดงหน้า manager และโหลดรายการหัวข้อจากฐานข้อมูลได้ |

---

## 4) Policy & Training Manager (Admin)

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| PT-ADM-01 | Create Topic | Admin | ล็อกอินแล้ว (Role=HR_ADMIN) | Add Topic > ใส่ Title + Content > Save | สร้างหัวข้อสำเร็จ และแสดงในรายการ |
| PT-ADM-02 | Edit Topic | Admin | มีหัวข้อแล้ว | Edit หัวข้อ > เปลี่ยน Title/Content > Save | อัปเดตหัวข้อสำเร็จ |
| PT-ADM-03 | Delete Topic | Admin | มีหัวข้อแล้ว | Delete > Confirm | หัวข้อถูกลบออกจากฐานข้อมูลและ UI |
| PT-ADM-04 | Publish Toggle | Admin | มีหัวข้อแล้ว | ตั้ง `Published=true` แล้ว Save | หัวข้อถูก mark เป็น published (พร้อมแสดงฝั่ง intern) |
| PT-ADM-05 | Video Mode = LINK (Save/Open) | Admin | มีหัวข้อแล้ว | เลือก Video Mode = LINK > ใส่ URL > Save > กด Open | บันทึกลิงก์สำเร็จ และเปิด URL ได้ |
| PT-ADM-06 | Video Mode = UPLOAD (Save/Open) | Admin | มีหัวข้อแล้ว | เลือก Video Mode = UPLOAD > เลือกไฟล์วิดีโอ > Save > กด Open | อัปโหลดวิดีโอขึ้น Storage + บันทึก path และเปิดดูได้ |
| PT-ADM-07 | Attachments Upload (Assets Subcollection) | Admin | มีหัวข้อแล้ว | แนบไฟล์ 1+ ไฟล์ > Save/Upload | ไฟล์ขึ้น Storage และมีรายการ assets ในหน้า |
| PT-ADM-08 | Field Cleanup (No undefined in Firestore) | Admin | เคยมี field เดิม | ล้างค่า content/videoUrl หรือเปลี่ยน mode แล้ว Save | ไม่เกิด error `Unsupported field value: undefined` และค่าถูกลบ/อัปเดตถูกต้อง |

---

## 5) Intern: แสดง Policy & Training (ฝั่งผู้ใช้)

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| PT-IN-01 | Published Topic Listing | Intern | มี topic ที่ `published=true` อย่างน้อย 1 รายการ | Intern เข้าเมนู `Policy & Training` | เห็นเฉพาะหัวข้อที่ published เท่านั้น |
| PT-IN-02 | Topic Modal View | Intern | มี topic ที่ published | คลิกหัวข้อ 1 รายการ | เปิด modal และเห็น Title/Content |
| PT-IN-03 | Open Video (LINK/UPLOAD) | Intern | หัวข้อมี video (แบบ link หรือ upload) | กด Open Video | ถ้าเป็น LINK เปิด URL ได้ / ถ้าเป็น UPLOAD เปิดไฟล์จาก Storage ได้ |
| PT-IN-04 | Open/Download Attachments | Intern | หัวข้อมีไฟล์แนบ | กดเปิดไฟล์แนบ | เปิด/ดาวน์โหลดได้ทุกไฟล์แนบ |

---

## 6) Confirm & Sign + วาดลายเซ็น (Intern)

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| SIGN-01 | Start Signing Flow | Intern | หัวข้อยังไม่ถูกเซ็น | เปิดหัวข้อ > กด `Sign Now` | แสดงส่วนวาดลายเซ็นและขั้นตอนยืนยัน |
| SIGN-02 | Confirm Checkbox Validation | Intern | ยังไม่ติ๊ก confirm | กด `Confirm & Sign` | ระบบแจ้งเตือนให้ติ๊ก confirm ก่อน |
| SIGN-03 | Signature Required Validation | Intern | ติ๊ก confirm แล้วแต่ยังไม่วาด | กด `Confirm & Sign` | ระบบแจ้งเตือนให้วาดลายเซ็น |
| SIGN-04 | Save Signature + Acknowledgement | Intern | ติ๊ก confirm + วาดลายเซ็นแล้ว | กด `Confirm & Sign` | อัปโหลดรูปเซ็นขึ้น Storage + บันทึก acknowledgement สำเร็จ และ UI แสดงว่า signed แล้ว |

---

## 7) Download All (Intern)

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| DL-01 | Download All Attachments | Intern | มี topic ที่มีไฟล์แนบ 1+ ไฟล์ | กด `Download All` | ดาวน์โหลดไฟล์แนบทั้งหมดได้ |
| DL-02 | Download Uploaded Video | Intern | มี topic ที่ video mode เป็น upload | กด `Download All` | วิดีโอถูกดาวน์โหลดได้ (หรือเปิด URL ที่ดาวน์โหลดได้) |
| DL-03 | Open External Video Links | Intern | มี topic ที่ video mode เป็น link | กด `Download All` | เปิดลิงก์วิดีโอในแท็บใหม่ได้ |

---

## 8) UX/UI Refactor + แยกไฟล์

> หมายเหตุ: ข้อนี้เป็น “งานปรับโครงสร้าง/คุณภาพโค้ด” ไม่ใช่ระบบฟังก์ชันธุรกิจโดยตรง แต่เป็นการทดสอบคุณภาพการใช้งานหลัง refactor

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| UX-01 | Build Validation (หลัง refactor) | Dev | โค้ดล่าสุด | รัน build | Build ผ่าน ไม่มี error |
| UX-02 | Smoke Test (หน้าหลักต่อ role) | Intern/Supervisor/Admin | Build ผ่าน | เปิดหน้าหลักของแต่ละ role และลองใช้งานเมนูสำคัญ | หน้าไม่พัง/ไม่ error และ routing ทำงานถูกต้อง |

---

## 9) Authentication

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| AUTH-01 | Login Success | User (ทุก role) | มีบัญชีใน Firebase Auth | ล็อกอินด้วย email/password | ล็อกอินสำเร็จ และโหลดโปรไฟล์ผู้ใช้ได้ |
| AUTH-02 | Session Persistence | User (ทุก role) | ล็อกอินแล้ว | refresh หน้าเว็บ | ยังอยู่ในระบบ (session ยัง valid) |
| AUTH-03 | Login Failure | User (ทุก role) | ใส่รหัสผิด/อีเมลไม่ถูก | ล็อกอิน | แจ้ง error และไม่ให้เข้าใช้งาน |

---

## 10) Role-based Access

| TC ID | ระบบ/ฟังก์ชัน (ของจริง) | ผู้ใช้ที่เกี่ยวข้อง | เงื่อนไขก่อนทดสอบ | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง |
|---|---|---|---|---|---|
| RBAC-01 | Route Guard: Intern blocked from admin pages | Intern | role=INTERN | เปิด URL ที่เป็น `/admin/...` | ถูก redirect หรือ blocked ไม่สามารถเข้าหน้า admin ได้ |
| RBAC-02 | Route Guard: Supervisor allowed pages | Supervisor | role=SUPERVISOR | เปิดเมนูใน supervisor | เข้าได้เฉพาะหน้าที่อนุญาต |
| RBAC-03 | Route Guard: Admin access system settings | Admin | role=HR_ADMIN | เปิดเมนู `System Settings` | เข้าได้ตามปกติ |
| RBAC-04 | Menu Visibility by Role | ทุก role | ล็อกอินแล้ว | ตรวจ sidebar/topnav | เห็นเมนูเฉพาะ role ที่ได้รับสิทธิ์ |
