@echo off
cd /d "C:\Users\asus\Desktop\Portfolio Website\Portfolio website"
git add -A
git commit -m "Add Supabase storage and DB integration"
git push
echo.
echo Done! Railway will redeploy automatically.
pause
