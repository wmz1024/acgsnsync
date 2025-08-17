// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use sha2::{Digest, Sha256};
use zip::{write::FileOptions, ZipWriter};
use std::io::{Write, Read};
use tauri::Window;
use std::sync::{Arc, Mutex};
use std::fs::File;
use std::io::{BufReader, BufWriter};
use zip::ZipArchive;
use std::collections::HashMap;
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize)]
struct FileItem {
    path: String,
    name: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    size: Option<u64>,
    selected: bool,
    compress: Option<bool>,
    #[serde(rename = "isUpdatePackage")]
    is_update_package: Option<bool>, // 是否为压缩包更新（减少服务器请求）
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportSettings {
    #[serde(rename = "packageName")]
    package_name: String,
    #[serde(rename = "downloadPrefix")]
    download_prefix: String,
    version: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportedFile {
    name: String,
    download_url: String,
    relative_path: String,
    hash: String,
    size: u64,
    #[serde(rename = "type")]
    file_type: String, // "file", "zip", "update_package"
    #[serde(rename = "autoExtract")]
    auto_extract: Option<bool>, // 是否自动解压
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportManifest {
    package_name: String,
    version: String,
    files: Vec<ExportedFile>,
    created_at: String,
}

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    file: String,
    total: u64,
    downloaded: u64,
    progress: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ManifestFile {
    name: String,
    #[serde(rename = "downloadUrl", alias = "url", alias = "download_url")]
    download_url: String,
    #[serde(rename = "relativePath", alias = "relative_path")]
    relative_path: String,
    hash: String,
    size: u64,
    #[serde(rename = "fileType", alias = "type")]
    file_type: String,
    #[serde(rename = "autoExtract", alias = "auto_extract")]
    auto_extract: Option<bool>,
}

#[derive(Clone, serde::Serialize, Debug, PartialEq)]
enum FileStatus {
    Unchanged,
    New,
    Modified,
    Extra,
    Excluded,
    ForceUpdate, // For zips
}

#[derive(Clone, serde::Serialize, Debug)]
struct DiffFile {
    path: String,
    status: FileStatus,
}


#[tauri::command]
async fn get_folder_contents(path: String) -> Result<Vec<FileItem>, String> {
    let mut items = Vec::new();
    
    match fs::read_dir(&path) {
        Ok(entries) => {
            for entry in entries {
                match entry {
                    Ok(entry) => {
                        let path = entry.path();
                        let name = path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .into_owned();
                        
                        let is_directory = path.is_dir();
                        let size = if !is_directory {
                            fs::metadata(&path).ok().map(|m| m.len())
                        } else {
                            None
                        };
                        
                        items.push(FileItem {
                            path: path.to_string_lossy().into_owned(),
                            name,
                            is_directory,
                            size,
                            selected: false,
                            compress: Some(false),
                            is_update_package: Some(false),
                        });
                    }
                    Err(e) => eprintln!("Error reading entry: {}", e),
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    // 排序：文件夹在前，然后按名称排序
    items.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    Ok(items)
}

#[tauri::command]
async fn save_file_dialog(default_name: String) -> Result<Option<String>, String> {
    // 暂时使用默认桌面路径，后续可以在前端用HTML5文件API
    let desktop = dirs::desktop_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    
    let save_path = desktop.join(&default_name);
    Ok(Some(save_path.to_string_lossy().to_string()))
}

fn calculate_file_hash(path: &std::path::Path) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}

fn add_directory_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    dir_path: &Path,
    base_path: &Path,
    should_compress: bool,
) -> Result<Vec<ExportedFile>, String> {
    let mut exported_files = Vec::new();
    
    for entry in WalkDir::new(dir_path) {
        let entry = entry.map_err(|e| format!("Error walking directory: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            let relative_path = path.strip_prefix(base_path)
                .map_err(|e| format!("Failed to get relative path: {}", e))?;
            
            let relative_path_str = relative_path.to_string_lossy().replace('\\', "/");
            
            // 计算文件hash
            let hash = calculate_file_hash(path).map_err(|e| e.to_string())?;
            let size = fs::metadata(path)
                .map_err(|e| format!("Failed to get file metadata: {}", e))?
                .len();
            
            // 添加到zip
            let options = if should_compress {
                FileOptions::default().compression_method(zip::CompressionMethod::Deflated)
            } else {
                FileOptions::default().compression_method(zip::CompressionMethod::Stored)
            };
            
            zip.start_file(&relative_path_str, options)
                .map_err(|e| format!("Failed to start zip file: {}", e))?;
            
            let mut file = fs::File::open(path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            std::io::copy(&mut file, zip)
                .map_err(|e| format!("Failed to copy file to zip: {}", e))?;
            
            exported_files.push(ExportedFile {
                name: path.file_name().unwrap().to_string_lossy().into_owned(),
                download_url: format!("{{download_prefix}}{}", relative_path_str),
                relative_path: relative_path_str,
                hash,
                size,
                file_type: "file".to_string(),
                auto_extract: None,
            });
        }
    }
    
    Ok(exported_files)
}

fn add_file_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    file_path: &Path,
    base_path: &Path,
) -> Result<ExportedFile, String> {
    let relative_path = file_path.strip_prefix(base_path)
        .map_err(|e| format!("Failed to get relative path: {}", e))?;
    
    let relative_path_str = relative_path.to_string_lossy().replace('\\', "/");
    
    // 计算文件hash
    let hash = calculate_file_hash(file_path).map_err(|e| e.to_string())?;
    let size = fs::metadata(file_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();
    
    // 添加到zip
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    zip.start_file(&relative_path_str, options)
        .map_err(|e| format!("Failed to start zip file: {}", e))?;
    
    let mut file = fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    std::io::copy(&mut file, zip)
        .map_err(|e| format!("Failed to copy file to zip: {}", e))?;
    
    Ok(ExportedFile {
        name: file_path.file_name().unwrap().to_string_lossy().into_owned(),
        download_url: format!("{{download_prefix}}{}", relative_path_str),
        relative_path: relative_path_str,
        hash,
        size,
        file_type: "file".to_string(),
        auto_extract: None,
    })
}

#[tauri::command]
async fn export_files(files: Vec<FileItem>, settings: ExportSettings, save_path_str: String) -> Result<String, String> {
    if files.is_empty() {
        return Err("No files selected for export".to_string());
    }
    
    let save_path = PathBuf::from(save_path_str);
    
    // 创建zip文件
    let zip_file = fs::File::create(&save_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    
    let mut zip = ZipWriter::new(zip_file);
    let mut exported_files = Vec::new();
    
    // 获取基础路径（第一个文件的父目录）
    let first_file_path = Path::new(&files[0].path);
    let base_path = if first_file_path.is_file() {
        first_file_path.parent().unwrap_or(first_file_path)
    } else {
        first_file_path.parent().unwrap_or(first_file_path)
    };
    
    for file_item in files.iter().filter(|f| f.selected) {
        let file_path = Path::new(&file_item.path);
        
        if file_item.is_directory {
            // 处理文件夹
            let should_compress = file_item.compress.unwrap_or(false);
            let is_update_package = file_item.is_update_package.unwrap_or(false);
            
            if should_compress {
                // 创建子zip文件
                let folder_name = file_path.file_name().unwrap().to_string_lossy();
                let temp_zip_path = std::env::temp_dir().join(format!("{}.zip", folder_name));
                
                let temp_zip_file = fs::File::create(&temp_zip_path)
                    .map_err(|e| format!("Failed to create temp zip: {}", e))?;
                
                let mut temp_zip = ZipWriter::new(temp_zip_file);
                let _folder_files = add_directory_to_zip(&mut temp_zip, file_path, file_path, true)?;
                temp_zip.finish().map_err(|e| format!("Failed to finish temp zip: {}", e))?;
                
                // 将子zip添加到主zip
                let relative_path = format!("{}.zip", folder_name);
                zip.start_file(&relative_path, FileOptions::default())
                    .map_err(|e| format!("Failed to start zip entry: {}", e))?;
                
                let mut temp_file = fs::File::open(&temp_zip_path)
                    .map_err(|e| format!("Failed to open temp zip: {}", e))?;
                std::io::copy(&mut temp_file, &mut zip)
                    .map_err(|e| format!("Failed to copy temp zip: {}", e))?;
                
                // 计算压缩文件的hash
                let hash = calculate_file_hash(&temp_zip_path).map_err(|e| e.to_string())?;
                let size = fs::metadata(&temp_zip_path)
                    .map_err(|e| format!("Failed to get temp zip metadata: {}", e))?
                    .len();
                
                // 根据是否为更新包设置不同的类型
                let (file_type, auto_extract) = if is_update_package {
                    ("update_package".to_string(), Some(true))
                } else {
                    ("zip".to_string(), Some(true))
                };
                
                exported_files.push(ExportedFile {
                    name: format!("{}.zip", folder_name),
                    download_url: format!("{}{}.zip", settings.download_prefix, folder_name),
                    relative_path: relative_path.clone(),
                    hash,
                    size,
                    file_type,
                    auto_extract,
                });
                
                // 清理临时文件
                let _ = fs::remove_file(&temp_zip_path);
            } else {
                // 直接添加文件夹内容
                let folder_files = add_directory_to_zip(&mut zip, file_path, base_path, false)?;
                exported_files.extend(folder_files);
            }
        } else {
            // 处理单个文件
            let exported_file = add_file_to_zip(&mut zip, file_path, base_path)?;
            exported_files.push(exported_file);
        }
    }
    
    // 创建清单文件
    let manifest = ExportManifest {
        package_name: settings.package_name.clone(),
        version: settings.version,
        files: exported_files.iter().map(|f| ExportedFile {
            name: f.name.clone(),
            download_url: f.download_url.replace("{download_prefix}", &settings.download_prefix),
            relative_path: f.relative_path.clone(),
            hash: f.hash.clone(),
            size: f.size,
            file_type: f.file_type.clone(),
            auto_extract: f.auto_extract,
        }).collect(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    
    zip.start_file("manifest.json", FileOptions::default())
        .map_err(|e| format!("Failed to start manifest file: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest: {}", e))?;
    
    zip.finish().map_err(|e| format!("Failed to finish zip: {}", e))?;
    
    Ok(format!("Export completed successfully! Saved to: {}", save_path.to_string_lossy()))
}

#[tauri::command]
fn calculate_diff(manifest: Manifest, target_dir: String, excluded_files: Vec<String>) -> Result<Vec<DiffFile>, String> {
    let local_files = scan_local_files(&target_dir);
    let mut diff_files = Vec::new();

    let excluded_set: HashSet<_> = excluded_files.into_iter().collect();

    for file in &manifest.files {
        let path_str = file.relative_path.clone();
        if excluded_set.contains(&path_str) {
            diff_files.push(DiffFile { path: path_str, status: FileStatus::Excluded });
            continue;
        }

        if file.file_type == "zip" || file.file_type == "update_package" {
            diff_files.push(DiffFile { path: path_str, status: FileStatus::ForceUpdate });
            continue;
        }

        let local_path = std::path::Path::new(&target_dir).join(&path_str);
        match local_files.get(&local_path) {
            Some(local_hash) if local_hash == &file.hash => {
                diff_files.push(DiffFile { path: path_str, status: FileStatus::Unchanged });
            }
            Some(_) => {
                diff_files.push(DiffFile { path: path_str, status: FileStatus::Modified });
            }
            None => {
                diff_files.push(DiffFile { path: path_str, status: FileStatus::New });
            }
        }
    }

    // Find extra local files
    let manifest_paths: HashSet<_> = manifest.files.iter().map(|f| std::path::Path::new(&target_dir).join(&f.relative_path)).collect();
    for (local_path, _) in local_files {
        if !manifest_paths.contains(&local_path) {
             if let Ok(rel_path) = local_path.strip_prefix(&target_dir) {
                let rel_path_str = rel_path.to_string_lossy().to_string();
                if !excluded_set.contains(&rel_path_str) {
                    diff_files.push(DiffFile { path: rel_path_str, status: FileStatus::Extra });
                }
            }
        }
    }

    Ok(diff_files)
}


#[tauri::command]
async fn start_download(
    window: Window,
    manifest: Manifest,
    target_dir: String,
    excluded_files: Vec<String>,
) -> Result<(), String> {
    // Step 1: Scan local files and create a hash map
    let local_files = scan_local_files(&target_dir);

    let files_to_process = manifest.files.clone(); // Clone for modification
    let mut files_to_download = Vec::new();

    for file in files_to_process {
        // Always download and extract zip/update_packages
        if file.file_type == "zip" || file.file_type == "update_package" {
            files_to_download.push(file);
            continue;
        }

        let local_path = std::path::Path::new(&target_dir).join(&file.relative_path);
        match local_files.get(&local_path) {
            Some(local_hash) if local_hash == &file.hash => {
                // File exists and hash matches, skip
                continue;
            }
            _ => {
                // File is new, modified, or was a zip package, so download
                files_to_download.push(file);
            }
        }
    }

    let total_files = files_to_download.len();
    if total_files == 0 {
        // Nothing to download, but we still need to clean up
        cleanup_extra_files(&target_dir, &manifest.files, &excluded_files);
        window.emit("OVERALL_PROGRESS", 100.0).unwrap();
        return Ok(());
    }

    let completed_files = Arc::new(Mutex::new(0));
    let manifest_files_arc = Arc::new(manifest.files);
    let excluded_files_arc = Arc::new(excluded_files);

    for (_i, file) in files_to_download.into_iter().enumerate() {
        let target_dir_clone = target_dir.clone();
        let window_clone = window.clone();
        let completed_files_clone = completed_files.clone();
        let manifest_files_clone = Arc::clone(&manifest_files_arc);
        let excluded_files_clone = Arc::clone(&excluded_files_arc);
        
        tokio::spawn(async move {
            let max_retries = 3;
            for attempt in 0..max_retries {
                let path = std::path::Path::new(&target_dir_clone).join(&file.relative_path);
                
                if let Some(parent) = path.parent() {
                    if !parent.exists() {
                        if let Err(e) = fs::create_dir_all(parent) {
                            window_clone.emit("DOWNLOAD_ERROR", format!("Failed to create directory for {}: {}", file.name, e)).unwrap();
                            return;
                        }
                    }
                }

                match download_file(&window_clone, &file, &path).await {
                    Ok(_) => {
                        // After download, verify and unzip
                        if let Err(e) = verify_and_unzip(&window_clone, &file, &path, &target_dir_clone) {
                            window_clone.emit("DOWNLOAD_ERROR", e.clone()).unwrap();
                            eprintln!("Verification/Unzip failed for {}: {}", file.name, e);
                            return; // Stop processing this file
                        }

                        let mut completed_count = completed_files_clone.lock().unwrap();
                        *completed_count += 1;
                        
                        let progress = (*completed_count as f32 / total_files as f32) * 100.0;
                        window_clone.emit("OVERALL_PROGRESS", progress).unwrap();

                        // After the last file is processed, clean up extra files
                        if *completed_count == total_files {
                            cleanup_extra_files(&target_dir_clone, &manifest_files_clone, &excluded_files_clone);
                        }

                        break; // Success, exit retry loop
                    }
                    Err(e) => {
                        eprintln!("Failed to download {}: {:?}. Attempt {}/{}", file.name, e, attempt + 1, max_retries);
                        if attempt == max_retries - 1 {
                            window_clone.emit("DOWNLOAD_ERROR", format!("Failed to download {}: {}", file.name, e)).unwrap();
                        }
                    }
                }
            }
        });
    }

    Ok(())
}

async fn download_file(
    window: &Window,
    file_info: &ManifestFile,
    path: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut response = reqwest::get(&file_info.download_url).await?;
    let mut dest = fs::File::create(path)?;
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    while let Some(chunk) = response.chunk().await? {
        dest.write_all(&chunk)?;
        downloaded += chunk.len() as u64;
        
        let progress = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        window.emit("DOWNLOAD_PROGRESS", &DownloadProgress {
            file: file_info.name.clone(),
            total: total_size,
            downloaded,
            progress,
        })?;
    }

    Ok(())
}

fn verify_and_unzip(
    _window: &Window,
    file_info: &ManifestFile,
    path: &std::path::Path,
    target_dir: &str,
) -> Result<(), String> {
    // 1. Check if the file should be auto-extracted first.
    if (file_info.file_type == "zip" || file_info.file_type == "update_package")
        && file_info.auto_extract.unwrap_or(false)
    {
        let file = File::open(path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        
        // Always unzip into a subfolder named after the zip file.
        let zip_name = path.file_stem().unwrap_or_default().to_str().unwrap_or("archive");
        let unzip_target_path = std::path::Path::new(target_dir).join(zip_name);

        if !unzip_target_path.exists() {
            fs::create_dir_all(&unzip_target_path).map_err(|e| e.to_string())?;
        }

        archive.extract(&unzip_target_path).map_err(|e| e.to_string())?;

        // After successful extraction, remove the original zip file.
        fs::remove_file(path).map_err(|e| e.to_string())?;

        // IMPORTANT: Skip the hash check for auto-extracted packages and return.
        return Ok(());
    }

    // 2. If not an auto-extract package, proceed to verify hash for regular files.
    let calculated_hash = calculate_file_hash(path).map_err(|e| e.to_string())?;

    if calculated_hash != file_info.hash {
        return Err(format!(
            "Hash mismatch for {}: expected {}, got {}",
            file_info.name, file_info.hash, calculated_hash
        ));
    }

    Ok(())
}


#[derive(Debug, Serialize, Deserialize)]
struct Manifest {
    #[serde(rename = "packageName", alias = "package_name")]
    package_name: String,
    version: String,
    files: Vec<ManifestFile>,
}

#[tauri::command]
fn load_exclusion_list(target_dir: String) -> Result<Vec<String>, String> {
    let config_path = std::path::Path::new(&target_dir).join(".sync_exclude.json");
    if !config_path.exists() {
        return Ok(Vec::new());
    }
    let file = File::open(config_path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let list = serde_json::from_reader(reader).map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
fn save_exclusion_list(target_dir: String, excluded_files: Vec<String>) -> Result<(), String> {
    let config_path = std::path::Path::new(&target_dir).join(".sync_exclude.json");
    let file = File::create(config_path).map_err(|e| e.to_string())?;
    let writer = BufWriter::new(file);
    serde_json::to_writer(writer, &excluded_files).map_err(|e| e.to_string())?;
    Ok(())
}


fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_folder_contents, 
            save_file_dialog, 
            export_files,
            start_download,
            load_exclusion_list,
            save_exclusion_list,
            calculate_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn scan_local_files(target_dir: &str) -> HashMap<std::path::PathBuf, String> {
    let mut map = HashMap::new();
    let walker = walkdir::WalkDir::new(target_dir).into_iter();
    for entry in walker.filter_map(Result::ok) {
        if entry.file_type().is_file() {
            if let Ok(hash) = calculate_file_hash(entry.path()) {
                map.insert(entry.path().to_path_buf(), hash);
            }
        }
    }
    map
}

fn cleanup_extra_files(target_dir: &str, manifest_files: &[ManifestFile], excluded_files: &[String]) {
    let manifest_paths: std::collections::HashSet<_> = manifest_files
        .iter()
        .map(|f| std::path::Path::new(target_dir).join(&f.relative_path))
        .collect();
    
    let excluded_paths: std::collections::HashSet<_> = excluded_files
        .iter()
        .map(|f| std::path::Path::new(target_dir).join(f))
        .collect();

    let walker = walkdir::WalkDir::new(target_dir).into_iter();
    for entry in walker.filter_map(Result::ok) {
        let path = entry.path();
        // Don't touch the exclusion config file
        if path.ends_with(".sync_exclude.json") {
            continue;
        }

        if !manifest_paths.contains(path) && !excluded_paths.contains(path) {
            if path.is_file() {
                let _ = fs::remove_file(path); // Ignore error if file is already gone
            } else if path.is_dir() {
                // Only remove empty dirs for safety
                if fs::read_dir(path).map(|mut i| i.next().is_none()).unwrap_or(false) {
                    let _ = fs::remove_dir(path);
                }
            }
        }
    }
}
