@echo off
echo "测试编译 ACGStation 游戏文件同步器..."
echo.

echo "1. 安装前端依赖..."
call npm install
if %ERRORLEVEL% neq 0 (
    echo "前端依赖安装失败"
    pause
    exit /b 1
)

echo.
echo "2. 检查 Rust 代码..."
cd src-tauri
call cargo check
if %ERRORLEVEL% neq 0 (
    echo "Rust 代码检查失败"
    cd ..
    pause
    exit /b 1
)

echo.
echo "3. 编译 Rust 代码..."
call cargo build
if %ERRORLEVEL% neq 0 (
    echo "Rust 编译失败"
    cd ..
    pause
    exit /b 1
)

cd ..
echo.
echo "✅ 所有检查通过！可以运行 'npm run tauri dev' 启动应用。"
pause
