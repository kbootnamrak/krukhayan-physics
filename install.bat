@echo off
setlocal
cd /d "%~dp0"

echo ==============================
echo  KruKhayan Physics - Setup
echo ==============================
echo.
echo กำลังติดตั้ง dependencies (ทำครั้งแรกครั้งเดียว หรือหลัง pull โค้ดใหม่)...
echo.

call npm install

echo.
echo เสร็จแล้ว! รัน dev.bat เพื่อเปิดเว็บทดสอบในเครื่อง
echo.
pause
