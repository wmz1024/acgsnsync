use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::AppHandle;
use reqwest;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftVersion {
    pub id: String,
    pub r#type: String,
    pub url: String,
    pub time: String,
    pub release_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: HashMap<String, String>,
    pub versions: Vec<MinecraftVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaVersion {
    pub path: String,
    pub version: String,
    pub compatible_mc_versions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthlibAccount {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub server_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModLoader {
    pub name: String,
    pub version: String,
    pub mc_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadSource {
    pub name: String,
    pub base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchOptions {
    pub version: String,
    pub java_path: String,
    pub max_memory: u32,
    pub min_memory: u32,
    pub game_dir: String,
    pub account: Option<AuthlibAccount>,
    pub mod_loader: Option<ModLoader>,
}

// 获取 Minecraft 游戏目录
fn get_minecraft_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;
    let mc_dir = app_dir.join("minecraft");
    
    if !mc_dir.exists() {
        fs::create_dir_all(&mc_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    Ok(mc_dir)
}

// 获取版本清单
#[tauri::command]
pub async fn get_version_manifest(source: String) -> Result<VersionManifest, String> {
    let url = match source.as_str() {
        "official" => "https://launchermeta.mojang.com/mc/game/version_manifest.json",
        "bmclapi" => "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
        _ => return Err("不支持的下载源".to_string()),
    };
    
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("获取版本清单失败: {}", e))?;
    
    let manifest: VersionManifest = response
        .json()
        .await
        .map_err(|e| format!("解析版本清单失败: {}", e))?;
    
    Ok(manifest)
}

// 下载 Minecraft 版本
#[tauri::command]
pub async fn download_minecraft_version(
    app: AppHandle,
    version_id: String,
    version_url: String,
    source: String,
) -> Result<String, String> {
    let mc_dir = get_minecraft_dir(&app)?;
    let versions_dir = mc_dir.join("versions").join(&version_id);
    
    fs::create_dir_all(&versions_dir).map_err(|e| format!("创建版本目录失败: {}", e))?;
    
    // 下载版本 JSON
    let version_url = if source == "bmclapi" {
        version_url.replace("launchermeta.mojang.com", "bmclapi2.bangbang93.com")
    } else {
        version_url
    };
    
    let response = reqwest::get(&version_url)
        .await
        .map_err(|e| format!("下载版本信息失败: {}", e))?;
    
    let version_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析版本信息失败: {}", e))?;
    
    let version_file = versions_dir.join(format!("{}.json", version_id));
    fs::write(&version_file, serde_json::to_string_pretty(&version_json).unwrap())
        .map_err(|e| format!("保存版本文件失败: {}", e))?;
    
    // 下载客户端 JAR
    if let Some(downloads) = version_json.get("downloads") {
        if let Some(client) = downloads.get("client") {
            if let Some(client_url) = client.get("url").and_then(|u| u.as_str()) {
                let client_url = if source == "bmclapi" {
                    client_url.replace("launcher.mojang.com", "bmclapi2.bangbang93.com")
                        .replace("resources.download.minecraft.net", "bmclapi2.bangbang93.com/assets")
                } else {
                    client_url.to_string()
                };
                
                let client_response = reqwest::get(&client_url)
                    .await
                    .map_err(|e| format!("下载客户端失败: {}", e))?;
                
                let client_jar = versions_dir.join(format!("{}.jar", version_id));
                let bytes = client_response
                    .bytes()
                    .await
                    .map_err(|e| format!("读取客户端数据失败: {}", e))?;
                
                fs::write(&client_jar, bytes)
                    .map_err(|e| format!("保存客户端文件失败: {}", e))?;
            }
        }
    }
    
    // 下载依赖库
    download_libraries(&version_json, &mc_dir, &source).await?;
    
    // 下载资源文件
    download_assets(&version_json, &mc_dir, &source).await?;
    
    Ok(format!("版本 {} 下载完成", version_id))
}

// 下载依赖库
async fn download_libraries(
    version_json: &serde_json::Value,
    mc_dir: &Path,
    source: &str,
) -> Result<(), String> {
    let libraries_dir = mc_dir.join("libraries");
    fs::create_dir_all(&libraries_dir).map_err(|e| format!("创建库目录失败: {}", e))?;
    
    if let Some(libraries) = version_json.get("libraries").and_then(|l| l.as_array()) {
        for lib in libraries {
            if let Some(downloads) = lib.get("downloads") {
                if let Some(artifact) = downloads.get("artifact") {
                    if let (Some(lib_url), Some(lib_path)) = (
                        artifact.get("url").and_then(|u| u.as_str()),
                        artifact.get("path").and_then(|p| p.as_str()),
                    ) {
                        let lib_url = if source == "bmclapi" {
                            lib_url.replace("libraries.minecraft.net", "bmclapi2.bangbang93.com/maven")
                        } else {
                            lib_url.to_string()
                        };
                        
                        let lib_file = libraries_dir.join(lib_path);
                        if lib_file.exists() {
                            continue; // 跳过已存在的库
                        }
                        
                        if let Some(parent) = lib_file.parent() {
                            fs::create_dir_all(parent).ok();
                        }
                        
                        // 下载库文件
                        if let Ok(response) = reqwest::get(&lib_url).await {
                            if let Ok(bytes) = response.bytes().await {
                                fs::write(&lib_file, bytes).ok();
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

// 下载资源文件
async fn download_assets(
    version_json: &serde_json::Value,
    mc_dir: &Path,
    source: &str,
) -> Result<(), String> {
    let assets_dir = mc_dir.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("创建资源目录失败: {}", e))?;
    
    if let Some(asset_index) = version_json.get("assetIndex") {
        if let Some(asset_url) = asset_index.get("url").and_then(|u| u.as_str()) {
            let asset_url = if source == "bmclapi" {
                asset_url.replace("launchermeta.mojang.com", "bmclapi2.bangbang93.com")
            } else {
                asset_url.to_string()
            };
            
            if let Ok(response) = reqwest::get(&asset_url).await {
                if let Ok(asset_json) = response.json::<serde_json::Value>().await {
                    if let Some(objects) = asset_json.get("objects").and_then(|o| o.as_object()) {
                        let objects_dir = assets_dir.join("objects");
                        fs::create_dir_all(&objects_dir).ok();
                        
                        // 只下载部分关键资源（完整下载资源文件会非常大）
                        let mut count = 0;
                        for (_, obj) in objects.iter().take(100) { // 限制下载数量
                            if let Some(hash) = obj.get("hash").and_then(|h| h.as_str()) {
                                let hash_prefix = &hash[..2];
                                let asset_file = objects_dir.join(hash_prefix).join(hash);
                                
                                if asset_file.exists() {
                                    continue;
                                }
                                
                                let asset_url = if source == "bmclapi" {
                                    format!("https://bmclapi2.bangbang93.com/assets/{}/{}", hash_prefix, hash)
                                } else {
                                    format!("https://resources.download.minecraft.net/{}/{}", hash_prefix, hash)
                                };
                                
                                if let Some(parent) = asset_file.parent() {
                                    fs::create_dir_all(parent).ok();
                                }
                                
                                if let Ok(response) = reqwest::get(&asset_url).await {
                                    if let Ok(bytes) = response.bytes().await {
                                        fs::write(&asset_file, bytes).ok();
                                        count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

// 检测已安装的 Java 版本
#[tauri::command]
pub async fn detect_java_versions() -> Result<Vec<JavaVersion>, String> {
    let mut java_versions = Vec::new();
    
    // 常见的 Java 安装路径
    let potential_paths = vec![
        r"C:\Program Files\Java",
        r"C:\Program Files (x86)\Java",
        r"C:\Program Files\Eclipse Adoptium",
        r"C:\Program Files\Zulu",
        r"C:\Program Files\Microsoft\jdk",
    ];
    
    for base_path in potential_paths {
        if let Ok(entries) = fs::read_dir(base_path) {
            for entry in entries.flatten() {
                let java_exe = entry.path().join("bin").join("java.exe");
                if java_exe.exists() {
                    if let Ok(output) = Command::new(&java_exe)
                        .arg("-version")
                        .output() {
                        let version_str = String::from_utf8_lossy(&output.stderr);
                        if let Some(version_line) = version_str.lines().next() {
                            // 解析 Java 版本
                            let version = parse_java_version(version_line);
                            let compatible_versions = get_compatible_mc_versions(&version);
                            
                            java_versions.push(JavaVersion {
                                path: java_exe.to_string_lossy().to_string(),
                                version: version.clone(),
                                compatible_mc_versions: compatible_versions,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // 检查 JAVA_HOME
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let java_exe = PathBuf::from(&java_home).join("bin").join("java.exe");
        if java_exe.exists() && !java_versions.iter().any(|j| j.path == java_exe.to_string_lossy()) {
            if let Ok(output) = Command::new(&java_exe).arg("-version").output() {
                let version_str = String::from_utf8_lossy(&output.stderr);
                if let Some(version_line) = version_str.lines().next() {
                    let version = parse_java_version(version_line);
                    let compatible_versions = get_compatible_mc_versions(&version);
                    
                    java_versions.push(JavaVersion {
                        path: java_exe.to_string_lossy().to_string(),
                        version: version.clone(),
                        compatible_mc_versions: compatible_versions,
                    });
                }
            }
        }
    }
    
    Ok(java_versions)
}

// 解析 Java 版本
fn parse_java_version(version_str: &str) -> String {
    if version_str.contains("version") {
        if let Some(version) = version_str.split('"').nth(1) {
            return version.to_string();
        }
    }
    "未知".to_string()
}

// 获取兼容的 MC 版本
fn get_compatible_mc_versions(java_version: &str) -> Vec<String> {
    let major_version = java_version.split('.').next().unwrap_or("0");
    let major: u32 = major_version.parse().unwrap_or(0);
    
    match major {
        1 => vec!["1.7.x-1.16.x".to_string()],
        8 => vec!["1.7.x-1.16.x".to_string()],
        11 => vec!["1.7.x-1.16.x".to_string()],
        16 => vec!["1.16.x-1.17.x".to_string()],
        17 => vec!["1.17.x-1.20.x".to_string()],
        18 => vec!["1.18.x+".to_string()],
        21 => vec!["1.20.5+".to_string()],
        _ => vec!["所有版本".to_string()],
    }
}

// 获取 Forge 版本列表
#[tauri::command]
pub async fn get_forge_versions(mc_version: String) -> Result<Vec<String>, String> {
    let url = format!("https://bmclapi2.bangbang93.com/forge/minecraft/{}", mc_version);
    
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("获取 Forge 版本失败: {}", e))?;
    
    let versions: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("解析 Forge 版本失败: {}", e))?;
    
    let forge_versions: Vec<String> = versions
        .iter()
        .filter_map(|v| v.get("version").and_then(|ver| ver.as_str()))
        .map(|s| s.to_string())
        .collect();
    
    Ok(forge_versions)
}

// 安装 Forge
#[tauri::command]
pub async fn install_forge(
    app: AppHandle,
    mc_version: String,
    forge_version: String,
) -> Result<String, String> {
    let mc_dir = get_minecraft_dir(&app)?;
    let versions_dir = mc_dir.join("versions");
    
    // 下载 Forge 安装器
    let url = format!(
        "https://bmclapi2.bangbang93.com/forge/download/{}/{}",
        mc_version, forge_version
    );
    
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载 Forge 失败: {}", e))?;
    
    let installer_path = mc_dir.join(format!("forge-{}-{}-installer.jar", mc_version, forge_version));
    let bytes = response.bytes().await.map_err(|e| format!("读取 Forge 数据失败: {}", e))?;
    
    fs::write(&installer_path, bytes)
        .map_err(|e| format!("保存 Forge 安装器失败: {}", e))?;
    
    Ok(format!("Forge {}-{} 下载完成，请手动运行安装器", mc_version, forge_version))
}

// 获取 Optifine 版本列表
#[tauri::command]
pub async fn get_optifine_versions(mc_version: String) -> Result<Vec<String>, String> {
    let url = format!("https://bmclapi2.bangbang93.com/optifine/{}", mc_version);
    
    let response = reqwest::get(&url)
        .await
        .map_err(|_| "获取 Optifine 版本失败，可能该版本没有可用的 Optifine".to_string())?;
    
    let versions: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("解析 Optifine 版本失败: {}", e))?;
    
    let optifine_versions: Vec<String> = versions
        .iter()
        .filter_map(|v| v.get("type").and_then(|t| t.as_str()))
        .map(|s| s.to_string())
        .collect();
    
    Ok(optifine_versions)
}

// 安装 Optifine
#[tauri::command]
pub async fn install_optifine(
    app: AppHandle,
    mc_version: String,
    optifine_type: String,
) -> Result<String, String> {
    let mc_dir = get_minecraft_dir(&app)?;
    
    // 下载 Optifine
    let url = format!(
        "https://bmclapi2.bangbang93.com/optifine/{}/{}",
        mc_version, optifine_type
    );
    
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载 Optifine 失败: {}", e))?;
    
    let installer_path = mc_dir.join(format!("optifine-{}-{}.jar", mc_version, optifine_type));
    let bytes = response.bytes().await.map_err(|e| format!("读取 Optifine 数据失败: {}", e))?;
    
    fs::write(&installer_path, bytes)
        .map_err(|e| format!("保存 Optifine 失败: {}", e))?;
    
    Ok(format!("Optifine {}-{} 下载完成", mc_version, optifine_type))
}

// Authlib-Injector 登录
#[tauri::command]
pub async fn authlib_login(
    server_url: String,
    username: String,
    password: String,
) -> Result<AuthlibAccount, String> {
    let client = reqwest::Client::new();
    
    let login_url = format!("{}/authserver/authenticate", server_url.trim_end_matches('/'));
    
    let mut payload = HashMap::new();
    payload.insert("username", username.clone());
    payload.insert("password", password);
    payload.insert("clientToken", uuid::Uuid::new_v4().to_string());
    payload.insert("requestUser", "true".to_string());
    
    let response = client
        .post(&login_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("登录请求失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("登录失败: HTTP {}", response.status()));
    }
    
    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析登录响应失败: {}", e))?;
    
    let access_token = result
        .get("accessToken")
        .and_then(|t| t.as_str())
        .ok_or("未找到访问令牌")?
        .to_string();
    
    let uuid = result
        .get("selectedProfile")
        .and_then(|p| p.get("id"))
        .and_then(|id| id.as_str())
        .ok_or("未找到用户 UUID")?
        .to_string();
    
    let username = result
        .get("selectedProfile")
        .and_then(|p| p.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or(&username)
        .to_string();
    
    Ok(AuthlibAccount {
        username,
        uuid,
        access_token,
        server_url,
    })
}

// 下载 authlib-injector
#[tauri::command]
pub async fn download_authlib_injector(app: AppHandle) -> Result<String, String> {
    let mc_dir = get_minecraft_dir(&app)?;
    let authlib_path = mc_dir.join("authlib-injector.jar");
    
    if authlib_path.exists() {
        return Ok(authlib_path.to_string_lossy().to_string());
    }
    
    let url = "https://bmclapi2.bangbang93.com/mirrors/authlib-injector/artifact/latest.json";
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("获取 authlib-injector 信息失败: {}", e))?;
    
    let info: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 authlib-injector 信息失败: {}", e))?;
    
    let download_url = info
        .get("download_url")
        .and_then(|u| u.as_str())
        .ok_or("未找到下载链接")?;
    
    let response = reqwest::get(download_url)
        .await
        .map_err(|e| format!("下载 authlib-injector 失败: {}", e))?;
    
    let bytes = response.bytes().await.map_err(|e| format!("读取数据失败: {}", e))?;
    fs::write(&authlib_path, bytes).map_err(|e| format!("保存文件失败: {}", e))?;
    
    Ok(authlib_path.to_string_lossy().to_string())
}

// 启动 Minecraft
#[tauri::command]
pub async fn launch_minecraft(
    app: AppHandle,
    options: LaunchOptions,
) -> Result<String, String> {
    let mc_dir = get_minecraft_dir(&app)?;
    let version_dir = mc_dir.join("versions").join(&options.version);
    let version_json_path = version_dir.join(format!("{}.json", options.version));
    
    if !version_json_path.exists() {
        return Err(format!("版本 {} 不存在", options.version));
    }
    
    let version_json_str = fs::read_to_string(&version_json_path)
        .map_err(|e| format!("读取版本文件失败: {}", e))?;
    let version_json: serde_json::Value = serde_json::from_str(&version_json_str)
        .map_err(|e| format!("解析版本文件失败: {}", e))?;
    
    // 构建类路径
    let mut classpath = Vec::new();
    
    // 添加依赖库
    if let Some(libraries) = version_json.get("libraries").and_then(|l| l.as_array()) {
        for lib in libraries {
            if let Some(downloads) = lib.get("downloads") {
                if let Some(artifact) = downloads.get("artifact") {
                    if let Some(lib_path) = artifact.get("path").and_then(|p| p.as_str()) {
                        let lib_file = mc_dir.join("libraries").join(lib_path);
                        if lib_file.exists() {
                            classpath.push(lib_file.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    
    // 添加客户端 JAR
    let client_jar = version_dir.join(format!("{}.jar", options.version));
    classpath.push(client_jar.to_string_lossy().to_string());
    
    let classpath_str = classpath.join(";");
    
    // 构建 JVM 参数
    let mut jvm_args = vec![
        format!("-Xmx{}M", options.max_memory),
        format!("-Xms{}M", options.min_memory),
        format!("-Djava.library.path={}", mc_dir.join("natives").to_string_lossy()),
        "-cp".to_string(),
        classpath_str,
    ];
    
    // 添加 authlib-injector（如果使用第三方登录）
    if let Some(ref account) = options.account {
        let authlib_path = mc_dir.join("authlib-injector.jar");
        if authlib_path.exists() {
            jvm_args.insert(
                0,
                format!(
                    "-javaagent:{}={}",
                    authlib_path.to_string_lossy(),
                    account.server_url
                ),
            );
        }
    }
    
    // 主类
    let main_class = version_json
        .get("mainClass")
        .and_then(|c| c.as_str())
        .ok_or("未找到主类")?;
    
    jvm_args.push(main_class.to_string());
    
    // 游戏参数
    let mut game_args = vec![
        "--username".to_string(),
        options.account.as_ref().map(|a| a.username.clone()).unwrap_or_else(|| "Player".to_string()),
        "--version".to_string(),
        options.version.clone(),
        "--gameDir".to_string(),
        options.game_dir.clone(),
        "--assetsDir".to_string(),
        mc_dir.join("assets").to_string_lossy().to_string(),
        "--assetIndex".to_string(),
        version_json
            .get("assetIndex")
            .and_then(|a| a.get("id"))
            .and_then(|id| id.as_str())
            .unwrap_or("1.16")
            .to_string(),
    ];
    
    if let Some(ref account) = options.account {
        game_args.extend_from_slice(&[
            "--uuid".to_string(),
            account.uuid.clone(),
            "--accessToken".to_string(),
            account.access_token.clone(),
        ]);
    }
    
    jvm_args.extend(game_args);
    
    // 启动游戏
    Command::new(&options.java_path)
        .args(&jvm_args)
        .current_dir(&options.game_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("启动游戏失败: {}", e))?;
    
    Ok("游戏启动成功".to_string())
}

// 获取已安装的版本列表
#[tauri::command]
pub async fn get_installed_versions(app: AppHandle) -> Result<Vec<String>, String> {
    let mc_dir = get_minecraft_dir(&app)?;
    let versions_dir = mc_dir.join("versions");
    
    if !versions_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut versions = Vec::new();
    
    if let Ok(entries) = fs::read_dir(versions_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    versions.push(name.to_string());
                }
            }
        }
    }
    
    Ok(versions)
}

