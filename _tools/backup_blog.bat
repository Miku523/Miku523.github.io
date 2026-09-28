@echo off
rem Hexo 博客自动备份入口(供计划任务与 npm run backup 调用)
rem 日志追加写入 _tools\backup.log (*.log 已被 .gitignore 排除)
"C:\Program Files\Git\bin\bash.exe" "D:\hexo_blog\_tools\backup_blog.sh" >> "D:\hexo_blog\_tools\backup.log" 2>&1
