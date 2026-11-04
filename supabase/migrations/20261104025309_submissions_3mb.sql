-- ไฟล์งานนักเรียนไม่เกิน 3 MB ต่อไฟล์ (เดิม 8 MB)
-- รูปถูกย่อในเครื่องเหลือราว 150–250 KB อยู่แล้ว ข้อจำกัดนี้มีผลกับ PDF เป็นหลัก — PDF ใหญ่ให้ส่งเป็นลิงก์
-- (ไฟล์ที่ครูแนบ bucket "assignment-files" ยังเป็น 20 MB เท่าเดิม)
update storage.buckets set file_size_limit = 3145728 where id = 'submissions';
