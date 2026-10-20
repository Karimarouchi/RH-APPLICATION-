@REM Maven Wrapper script for Windows
@REM Downloads Maven if not cached, then runs it

@echo off
setlocal

@REM Set JAVA_HOME to Oracle JDK 17
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"

set "MAVEN_PROJECTBASEDIR=%~dp0"
set "MAVEN_WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties"
set "MAVEN_VERSION=3.9.9"
set "DIST_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip"
set "MAVEN_HOME=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%"
set "MVN_CMD=%MAVEN_HOME%\bin\mvn.cmd"

if exist "%MVN_CMD%" goto runMaven

echo Downloading Maven %MAVEN_VERSION%...
if not exist "%MAVEN_HOME%" mkdir "%MAVEN_HOME%"

set "DOWNLOAD_DIR=%TEMP%\maven-wrapper-download"
if not exist "%DOWNLOAD_DIR%" mkdir "%DOWNLOAD_DIR%"
set "DOWNLOAD_FILE=%DOWNLOAD_DIR%\maven.zip"

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DIST_URL%' -OutFile '%DOWNLOAD_FILE%' -UseBasicParsing"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to download Maven. Check your internet connection.
    exit /b 1
)

echo Extracting Maven...
powershell -Command "Expand-Archive -Path '%DOWNLOAD_FILE%' -DestinationPath '%USERPROFILE%\.m2\wrapper\dists' -Force"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to extract Maven.
    exit /b 1
)

del /q "%DOWNLOAD_FILE%" 2>nul

if exist "%MVN_CMD%" goto runMaven
echo ERROR: Maven extraction succeeded but mvn.cmd not found at %MVN_CMD%
exit /b 1

:runMaven
"%MVN_CMD%" %*
