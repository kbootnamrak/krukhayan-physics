@echo off
setlocal
cd /d "%~dp0"

echo ==============================
echo  KruKhayan Physics - Dev Server
echo ==============================
echo.
echo กำลังเปิดเว็บทดสอบในเครื่อง...
echo เปิดเบราว์เซอร์ไปที่ http://localhost:3000
echo (กด Ctrl+C ในหน้าต่างนี้เพื่อหยุดเซิร์ฟเวอร์)
echo.

call npm run dev

pause
