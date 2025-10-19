# Minecraft 启动器使用说明

## 概述

本 Tauri 应用现已集成完整的 Minecraft 启动器功能，支持以下特性：

- ✅ Minecraft 版本下载和管理
- ✅ 官方源和 BMCLAPI 下载源切换
- ✅ Java 版本自动检测和兼容性管理
- ✅ Authlib-Injector 第三方登录支持
- ✅ Forge Mod 加载器安装
- ✅ Optifine 优化模组安装

## 安装依赖

### 1. 安装前端依赖

```bash
npm install
```

新增的依赖包括：
- `@radix-ui/react-select`: 下拉选择组件
- `@radix-ui/react-toast`: Toast 通知组件
- `uuid`: UUID 生成（Rust 后端）

### 2. 构建应用

```bash
npm run tauri build
```

或开发模式：

```bash
npm run tauri dev
```

## 功能说明

### 1. 启动游戏

在"启动游戏"标签页中：

1. **选择游戏版本**：从已安装的版本列表中选择
2. **选择 Java 版本**：系统会自动检测已安装的 Java，并显示兼容的 MC 版本
3. **配置内存**：
   - 最小内存：建议 512MB
   - 最大内存：建议 2048MB 或更高（根据你的系统配置）
4. 点击"启动游戏"按钮

**Java 版本兼容性说明**：
- Java 8/11: 适用于 MC 1.7.x - 1.16.x
- Java 16: 适用于 MC 1.16.x - 1.17.x
- Java 17: 适用于 MC 1.17.x - 1.20.x
- Java 21: 适用于 MC 1.20.5+

### 2. 版本管理

在"版本管理"标签页中：

1. **选择下载源**：
   - 官方源：直接从 Mojang 服务器下载
   - BMCLAPI：国内镜像，速度更快

2. **版本过滤**：
   - 全部：显示所有版本
   - 正式版：仅显示稳定版本
   - 快照版：显示测试版本

3. **下载版本**：
   - 点击版本列表中的"下载"按钮
   - 系统会自动下载客户端、依赖库和资源文件
   - 下载完成后版本会显示"已安装"标记

### 3. Mod 加载器

#### Forge 安装

1. 在"Mod 加载器"标签页的 Forge 卡片中
2. 选择 Minecraft 版本（必须已安装）
3. 系统会自动加载该版本可用的 Forge 版本
4. 选择 Forge 版本并点击"安装 Forge"
5. 下载完成后，需要手动运行安装器完成安装

#### Optifine 安装

1. 在 Optifine 卡片中选择 Minecraft 版本
2. 选择 Optifine 版本
3. 点击"安装 Optifine"
4. 安装完成后可直接使用

### 4. 账号管理（Authlib-Injector）

支持使用第三方验证服务器登录：

1. 在"账号管理"标签页中
2. 填写：
   - **验证服务器地址**：例如 `https://example.com/api/yggdrasil`
   - **用户名/邮箱**：你的账号用户名
   - **密码**：账号密码
3. 点击"登录"按钮
4. 登录成功后，用户信息会显示在页面上
5. 启动游戏时会自动使用此账号

## 技术架构

### 后端（Rust）

文件位置：`src-tauri/src/minecraft.rs`

主要功能：
- `get_version_manifest`: 获取版本清单
- `download_minecraft_version`: 下载 MC 版本
- `detect_java_versions`: 检测 Java 版本
- `get_forge_versions`: 获取 Forge 版本列表
- `install_forge`: 安装 Forge
- `get_optifine_versions`: 获取 Optifine 版本
- `install_optifine`: 安装 Optifine
- `authlib_login`: 第三方登录
- `download_authlib_injector`: 下载 authlib-injector
- `launch_minecraft`: 启动游戏
- `get_installed_versions`: 获取已安装版本

### 前端（React + TypeScript）

文件位置：`src/components/minecraft-launcher.tsx`

使用的 UI 组件：
- Tabs: 标签页切换
- Select: 下拉选择框
- Button: 按钮
- Card: 卡片容器
- Input: 输入框
- Progress: 进度条
- Toast: 通知提示

## 游戏文件位置

所有 Minecraft 相关文件存储在应用数据目录下：

```
{AppData}/minecraft/
├── versions/          # 游戏版本
│   └── 1.20.1/
│       ├── 1.20.1.json
│       └── 1.20.1.jar
├── libraries/         # 依赖库
├── assets/           # 资源文件
└── authlib-injector.jar  # 第三方登录工具
```

Windows 示例：
```
C:\Users\{用户名}\AppData\Roaming\{应用名称}\minecraft\
```

## 常见问题

### 1. 找不到 Java

**解决方法**：
- 确保已安装 Java（推荐使用 Java 17 或 21）
- 检查 JAVA_HOME 环境变量是否正确设置
- 手动安装 Java 后重启应用

### 2. 下载速度慢

**解决方法**：
- 切换到 BMCLAPI 下载源
- 检查网络连接
- 考虑使用代理

### 3. 启动失败

**解决方法**：
- 检查 Java 版本是否与 MC 版本兼容
- 确保内存设置合理（不要超过系统可用内存）
- 查看错误信息，检查是否缺少依赖文件

### 4. 第三方登录失败

**解决方法**：
- 检查验证服务器地址是否正确
- 确认用户名和密码正确
- 验证服务器是否在线

## 更新日志

### v1.3.0 (当前版本)

- ✨ 新增完整的 Minecraft 启动器功能
- ✨ 支持官方源和 BMCLAPI 双下载源
- ✨ 集成 Java 版本检测和兼容性管理
- ✨ 支持 Authlib-Injector 第三方登录
- ✨ 支持 Forge 和 Optifine 安装
- 🎨 全新的现代化 UI 设计

## 贡献

如果你有任何建议或发现了问题，欢迎提交 Issue 或 Pull Request。

## 许可证

本项目遵循原应用的许可证。

