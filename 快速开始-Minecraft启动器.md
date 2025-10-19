# Minecraft 启动器 - 快速开始

## 🚀 立即开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run tauri dev
```

### 3. 构建生产版本

```bash
npm run tauri build
```

## 📋 主要功能清单

### ✅ 已实现功能

1. **版本下载和管理**
   - 支持官方源和 BMCLAPI（国内镜像）
   - 自动下载客户端、依赖库和资源文件
   - 版本筛选（正式版/快照版）

2. **Java 管理**
   - 自动检测系统已安装的 Java
   - 显示 Java 版本兼容性
   - 智能推荐合适的 Java 版本

3. **第三方登录**
   - 支持 Authlib-Injector
   - 自动下载 authlib-injector.jar
   - 支持多种第三方验证服务器

4. **Mod 加载器**
   - Forge 安装（所有版本）
   - Optifine 安装
   - 自动获取兼容版本列表

5. **游戏启动**
   - 自定义内存配置
   - 支持离线/在线模式
   - 游戏目录管理

## 🎯 使用流程

### 第一次使用

1. 打开应用，点击侧边栏的 "Minecraft" 图标
2. 切换到"版本管理"标签页
3. 选择下载源（推荐国内用户选择 BMCLAPI）
4. 选择一个版本并点击"下载"
5. 等待下载完成

### 启动游戏

1. 切换到"启动游戏"标签页
2. 选择已安装的游戏版本
3. 选择 Java 版本（自动检测）
4. 配置内存（根据需要）
5. 点击"启动游戏"

### 使用第三方登录

1. 切换到"账号管理"标签页
2. 输入验证服务器地址、用户名和密码
3. 点击"登录"
4. 登录成功后返回"启动游戏"页面即可使用

## 📁 项目结构

```
.
├── src-tauri/
│   └── src/
│       ├── main.rs           # 主入口（已更新）
│       └── minecraft.rs      # Minecraft 启动器核心逻辑（新增）
├── src/
│   ├── components/
│   │   ├── minecraft-launcher.tsx  # 启动器前端组件（新增）
│   │   └── ui/
│   │       ├── select.tsx    # 下拉选择组件（新增）
│   │       ├── toast.tsx     # Toast 组件（新增）
│   │       └── toaster.tsx   # Toaster 容器（新增）
│   ├── hooks/
│   │   └── use-toast.ts      # Toast Hook（新增）
│   └── App.tsx               # 主应用（已更新）
├── Cargo.toml                # Rust 依赖（已更新）
├── package.json              # 前端依赖（已更新）
└── Minecraft启动器使用说明.md  # 详细文档（新增）
```

## 🔧 新增依赖

### Rust (Cargo.toml)

```toml
uuid = { version = "1.10", features = ["v4", "serde"] }
```

### 前端 (package.json)

```json
{
  "@radix-ui/react-select": "^2.1.1",
  "@radix-ui/react-toast": "^1.2.1"
}
```

## 🎨 UI 预览

启动器包含 4 个主要标签页：

1. **启动游戏** - 配置和启动 Minecraft
2. **版本管理** - 下载和管理游戏版本
3. **Mod 加载器** - 安装 Forge 和 Optifine
4. **账号管理** - 第三方登录

## ⚙️ 配置说明

### Java 版本要求

- MC 1.7.x - 1.16.x: Java 8/11
- MC 1.16.x - 1.17.x: Java 16
- MC 1.17.x - 1.20.x: Java 17
- MC 1.20.5+: Java 21

### 内存建议

- 最小：512MB
- 推荐：2048MB (2GB)
- 大型整合包：4096MB (4GB) 或更高

### 下载源说明

- **官方源**：`launchermeta.mojang.com`
  - 优点：官方稳定
  - 缺点：国内速度较慢
  
- **BMCLAPI**：`bmclapi2.bangbang93.com`
  - 优点：国内访问快
  - 缺点：可能略有延迟

## 🐛 故障排除

### 问题：未检测到 Java

**解决**：
1. 安装 Java（推荐 Java 17）
2. 设置 JAVA_HOME 环境变量
3. 重启应用

### 问题：下载失败

**解决**：
1. 切换下载源
2. 检查网络连接
3. 重试下载

### 问题：启动失败

**解决**：
1. 检查 Java 版本兼容性
2. 增加内存配置
3. 查看错误日志

## 📞 获取帮助

- 查看完整文档：`Minecraft启动器使用说明.md`
- 提交问题：GitHub Issues
- 参与讨论：项目社区

## 🎉 开始游戏吧！

一切准备就绪，现在你可以在应用中体验完整的 Minecraft 启动器功能了！

