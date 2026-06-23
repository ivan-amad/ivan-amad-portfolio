@echo off
cd /d "C:\Users\asus\Desktop\Portfolio Website\Portfolio website"
echo === Installing packages (updating lock file) ===
npm install
echo.
echo === Pushing to GitHub ===
git add -A
git commit -m "Update package-lock.json with Supabase dependency"
git push
echo.
echo Done! Railway will redeploy automatically.
pause
