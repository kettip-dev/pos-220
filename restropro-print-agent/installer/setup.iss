; Restro PRO print agent: Windows installer (Inno Setup 6).
; Built by installer\build.ps1, which passes /DAppVersion and /DDefaultServer.
;
; Silent install for many PCs:
;   RestroPrintAgent-Setup-1.0.0.exe /VERYSILENT /SERVER=https://pos.example.com /TOKEN=rpa_xxx

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef DefaultServer
  #define DefaultServer ""
#endif
#define AppName "Restro Print Agent"
#define ExeName "restro-print-agent.exe"

[Setup]
AppId={{8C3E6F1A-5B2D-4F7E-9A41-2D7C9B0E6A53}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Restro PRO
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\Restro Print Agent
DefaultGroupName=Restro Print Agent
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=RestroPrintAgent-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#ExeName}
UninstallDisplayName={#AppName}
; The agent is stopped by service.ps1 before files are replaced.
CloseApplications=no
SetupLogging=yes

[Files]
Source: "..\dist\{#ExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\RestroRawPrint.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "service.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "Put a Printer Tools shortcut on the desktop"; GroupDescription: "Shortcuts:"

; Internet shortcut to the agent's local Printer Tools page.
[INI]
Filename: "{app}\Printer Tools.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://localhost:17171/"
Filename: "{app}\Printer Tools.url"; Section: "InternetShortcut"; Key: "IconFile"; String: "{sys}\shell32.dll"
Filename: "{app}\Printer Tools.url"; Section: "InternetShortcut"; Key: "IconIndex"; String: "16"

[Icons]
Name: "{group}\Restro Printer Tools"; Filename: "{app}\Printer Tools.url"; IconFilename: "{sys}\shell32.dll"; IconIndex: 16
Name: "{autodesktop}\Restro Printer Tools"; Filename: "{app}\Printer Tools.url"; IconFilename: "{sys}\shell32.dll"; IconIndex: 16; Tasks: desktopicon
Name: "{group}\View print agent log"; Filename: "{win}\notepad.exe"; Parameters: """{commonappdata}\RestroPrintAgent\logs\agent.log"""
Name: "{group}\Uninstall Restro Print Agent"; Filename: "{uninstallexe}"

[UninstallDelete]
Type: files; Name: "{app}\Printer Tools.url"

[Run]
Filename: "http://localhost:17171/"; Description: "Open Printer Tools (find and test printers)"; Flags: postinstall nowait skipifsilent shellexec

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\service.ps1"" uninstall -Exe ""{app}\{#ExeName}"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveAgentTask"

[Code]
const
  AlphaNum = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

var
  ConnPage: TInputQueryWizardPage;
  ServerUrl, Token: String;
  HasSavedConfig: Boolean;

function DataDir: String;
begin
  Result := ExpandConstant('{commonappdata}\RestroPrintAgent');
end;

function ConfigFile: String;
begin
  Result := DataDir + '\config.json';
end;

function PowerShellExe: String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

function AgentExe: String;
begin
  Result := ExpandConstant('{app}\{#ExeName}');
end;

{ Only plain characters reach a command line, so nothing can be injected. }
function OnlyChars(const S, Allowed: String): Boolean;
var
  I: Integer;
begin
  Result := Length(S) > 0;
  for I := 1 to Length(S) do
    if Pos(S[I], Allowed) = 0 then
    begin
      Result := False;
      Exit;
    end;
end;

function IsValidUrl(const S: String): Boolean;
var
  L: String;
begin
  L := Lowercase(S);
  Result := ((Pos('https://', L) = 1) or (Pos('http://', L) = 1)) and (Length(S) > 8) and
    OnlyChars(S, AlphaNum + ':/.-_');
end;

function IsValidToken(const S: String): Boolean;
begin
  Result := OnlyChars(S, AlphaNum + '_-');
end;

{ Reads "serverUrl" from an existing config.json, so upgrades keep the address. }
function SavedServerUrl: String;
var
  Raw: AnsiString;
  Text: String;
  P: Integer;
begin
  Result := '';
  if not LoadStringFromFile(ConfigFile, Raw) then Exit;
  Text := String(Raw);
  P := Pos('"serverUrl"', Text);
  if P = 0 then Exit;
  Delete(Text, 1, P + Length('"serverUrl"') - 1);
  P := Pos('"', Text);
  if P = 0 then Exit;
  Delete(Text, 1, P);
  P := Pos('"', Text);
  if P = 0 then Exit;
  Result := Copy(Text, 1, P - 1);
end;

function AgentArgs: String;
begin
  Result := '--server "' + ServerUrl + '"';
  if Token <> '' then
    Result := Result + ' --token "' + Token + '"';
end;

{ Runs the agent once (from the setup's temp folder) to check the address and token. }
function TestConnection(var Output: String): Boolean;
var
  Exe, OutFile: String;
  Code: Integer;
  Raw: AnsiString;
begin
  ExtractTemporaryFile('{#ExeName}');
  Exe := ExpandConstant('{tmp}\{#ExeName}');
  OutFile := ExpandConstant('{tmp}\agent-test.txt');
  DeleteFile(OutFile);
  Result := False;
  if not Exec(ExpandConstant('{cmd}'), '/C ""' + Exe + '" --test ' + AgentArgs + ' > "' + OutFile + '" 2>&1"',
    '', SW_HIDE, ewWaitUntilTerminated, Code) then
  begin
    Output := 'Could not run the agent: ' + SysErrorMessage(Code);
    Exit;
  end;
  if LoadStringFromFile(OutFile, Raw) then
    Output := Trim(String(Raw))
  else
    Output := 'No output (exit code ' + IntToStr(Code) + ').';
  Result := Code = 0;
end;

procedure InitializeWizard;
begin
  HasSavedConfig := FileExists(ConfigFile);

  ServerUrl := Trim(ExpandConstant('{param:SERVER|}'));
  if ServerUrl = '' then ServerUrl := SavedServerUrl;
  if ServerUrl = '' then ServerUrl := '{#DefaultServer}';
  Token := Trim(ExpandConstant('{param:TOKEN|}'));

  ConnPage := CreateInputQueryPage(wpWelcome,
    'Connect to Restro PRO',
    'Enter your POS address and the agent token.',
    'In Restro PRO open Settings > Thermal Printers > Print Agents, click Add Agent and copy the token.');
  ConnPage.Add('POS address (for example https://pos.example.com):', False);
  ConnPage.Add('Agent token:', True);
  ConnPage.Values[0] := ServerUrl;
  ConnPage.Values[1] := Token;
  if HasSavedConfig then
    ConnPage.SubCaptionLabel.Caption := ConnPage.SubCaptionLabel.Caption + #13#10#13#10 +
      'This computer already has a token. Leave the token empty to keep it.';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Output: String;
begin
  Result := True;
  { Silent installs use /SERVER and /TOKEN as given (checked in CurStepChanged). }
  if WizardSilent or (ConnPage = nil) or (CurPageID <> ConnPage.ID) then Exit;

  ServerUrl := Trim(ConnPage.Values[0]);
  while (Length(ServerUrl) > 0) and (ServerUrl[Length(ServerUrl)] = '/') do
    Delete(ServerUrl, Length(ServerUrl), 1);
  Token := Trim(ConnPage.Values[1]);

  if not IsValidUrl(ServerUrl) then
  begin
    MsgBox('Enter the POS address starting with https://, for example https://pos.example.com', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if (Token = '') and not HasSavedConfig then
  begin
    MsgBox('Paste the agent token from Settings > Thermal Printers > Print Agents.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if (Token <> '') and not IsValidToken(Token) then
  begin
    MsgBox('The token contains unexpected characters. Copy it again from Restro PRO.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  WizardForm.NextButton.Enabled := False;
  try
    Result := TestConnection(Output);
  finally
    WizardForm.NextButton.Enabled := True;
  end;
  if not Result then
    Result := MsgBox('Could not confirm the connection:' + #13#10#13#10 + Output + #13#10#13#10 +
      'Install anyway? The agent keeps retrying in the background.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
end;

{ Stop a running agent before its files are replaced (upgrade). }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Script: String;
  Code: Integer;
begin
  Result := '';
  Script := ExpandConstant('{app}\service.ps1');
  if FileExists(Script) then
    Exec(PowerShellExe, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + Script + '" stop -Exe "' + AgentExe + '"',
      '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
begin
  if CurStep <> ssPostInstall then Exit;

  { Save the address and token (skipped for a silent upgrade without /SERVER). }
  if IsValidUrl(ServerUrl) and ((Token = '') or IsValidToken(Token)) and ((Token <> '') or HasSavedConfig) then
  begin
    WizardForm.StatusLabel.Caption := 'Saving settings...';
    if not Exec(AgentExe, '--configure ' + AgentArgs, '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
      SuppressibleMsgBox('Could not save the agent settings (error ' + IntToStr(Code) + ').', mbError, MB_OK, IDOK);
  end
  else if not HasSavedConfig then
    Log('No valid /SERVER and /TOKEN given; the agent will wait for config.json.');

  WizardForm.StatusLabel.Caption := 'Starting the print agent...';
  if not Exec(PowerShellExe, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\service.ps1') +
    '" install -Exe "' + AgentExe + '"', '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
    SuppressibleMsgBox('The print agent was installed but could not be set to start automatically (error ' + IntToStr(Code) + ').' + #13#10 +
      'Run the installer again, or contact support.', mbError, MB_OK, IDOK);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and DirExists(DataDir) then
    if SuppressibleMsgBox('Also delete the saved agent token and logs from this computer?', mbConfirmation, MB_YESNO, IDNO) = IDYES then
      DelTree(DataDir, True, True, True);
end;
