@echo off
setlocal
cd /d "%~dp0"

echo ==============================
echo  KruKhayan Physics - Deploy
echo ==============================
echo.

set /p MSG=พิมพ์คำอธิบายการแก้ไข (Enter เพื่อใช้ค่าเริ่มต้น):
if "%MSG%"=="" set MSG=Update site

echo.
echo กำลังบันทึกและอัปโหลดโค้ด...
git add .
git commit -m "%MSG%"
git push

echo.
echo เสร็จแล้ว! Vercel จะ build และอัปเดตเว็บให้อัตโนมัติ
echo ตรวจสอบสถานะได้ที่ https://vercel.com/urrw/krukhayan-physics/deployments
echo.
pause
