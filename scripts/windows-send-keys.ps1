param(
  [Parameter(Mandatory = $true)]
  [string]$WindowTitle,

  [Parameter(Mandatory = $true)]
  [string]$Keys
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class CacabluWindowInput
{
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
Add-Type -AssemblyName System.Windows.Forms

$process = Get-Process msedge -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$WindowTitle*" } |
  Select-Object -First 1

if (-not $process) {
  throw "Could not find a visible Microsoft Edge window containing title '$WindowTitle'."
}

[CacabluWindowInput]::ShowWindow($process.MainWindowHandle, 9) | Out-Null
$shell = New-Object -ComObject WScript.Shell
$activated = $shell.AppActivate($process.Id)
if (-not $activated) {
  $activated = [CacabluWindowInput]::SetForegroundWindow($process.MainWindowHandle)
}
if (-not $activated) {
  throw "Could not focus Microsoft Edge window '$($process.MainWindowTitle)'."
}

Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Start-Sleep -Milliseconds 250
