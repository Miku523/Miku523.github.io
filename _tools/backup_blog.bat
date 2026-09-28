@echo off
rem Hexo blog auto backup entry (for Task Scheduler and npm run backup)
rem Log appends to _tools\backup.log (excluded by .gitignore via *.log)
"C:\Program Files\Git\bin\bash.exe" "D:\hexo_blog\_tools\backup_blog.sh" >> "D:\hexo_blog\_tools\backup.log" 2>&1
