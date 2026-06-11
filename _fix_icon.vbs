Set WshShell = CreateObject("WScript.Shell")
Set sc = WshShell.CreateShortcut("C:\Users\DELL\Desktop\DevWhale.lnk")
sc.TargetPath = "C:\Users\DELL\bob-desk\bob-desk.exe"
sc.WorkingDirectory = "C:\Users\DELL\bob-desk"
sc.IconLocation = "C:\Users\DELL\Desktop\w.ico,0"
sc.Description = "DevWhale"
sc.Save()
