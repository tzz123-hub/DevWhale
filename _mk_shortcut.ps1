$WshShell = New-Object -ComObject WScript.Shell
$s = $WshShell.CreateShortcut('C:\Users\DELL\Desktop\DevWhale.lnk')
$s.TargetPath = 'C:\Users\DELL\bob-desk\bob-desk.exe'
$s.WorkingDirectory = 'C:\Users\DELL\bob-desk'
$s.Description = 'DevWhale - AI Development Workbench'
$s.Save()
Write-Output 'DevWhale shortcut on Desktop'
