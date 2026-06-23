@echo off
cd /d "C:\Users\asus\Desktop\Portfolio Website\Portfolio website"
git add package-lock.json
git commit -m "Add package-lock.json with Supabase dependency"
git push
echo.
echo Done! Railway will redeploy automatically.
pause
