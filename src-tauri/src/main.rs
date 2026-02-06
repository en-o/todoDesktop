// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git_manager;
mod file_manager;
mod config;

use git_manager::GitManager;
use file_manager::FileManager;
use config::Config;
use std::sync::Mutex;
use tauri::State;

// 全局状态
struct AppState {
    git_manager: Mutex<Option<GitManager>>,
    file_manager: Mutex<FileManager>,
    config: Mutex<Option<Config>>,
}

#[tauri::command]
async fn init_git(
    state: State<'_, AppState>,
    config: Config,
) -> Result<String, String> {
    let git_manager = GitManager::new(config.clone())
        .map_err(|e| e.to_string())?;
    
    git_manager.init()
        .map_err(|e| e.to_string())?;
    
    *state.git_manager.lock().unwrap() = Some(git_manager);
    *state.config.lock().unwrap() = Some(config);
    
    Ok("Git 仓库初始化成功".to_string())
}

#[tauri::command]
async fn read_file(
    state: State<'_, AppState>,
    filepath: String,
) -> Result<String, String> {
    let file_manager = state.file_manager.lock().unwrap();
    let config = state.config.lock().unwrap();
    
    if let Some(cfg) = config.as_ref() {
        file_manager.read_file(&cfg.local_path, &filepath)
            .map_err(|e| e.to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn write_file(
    state: State<'_, AppState>,
    filepath: String,
    content: String,
) -> Result<String, String> {
    let file_manager = state.file_manager.lock().unwrap();
    let config = state.config.lock().unwrap();
    
    if let Some(cfg) = config.as_ref() {
        file_manager.write_file(&cfg.local_path, &filepath, &content)
            .map_err(|e| e.to_string())?;
        
        // 自动提交到 Git
        if let Some(git_mgr) = state.git_manager.lock().unwrap().as_ref() {
            git_mgr.add_and_commit(&filepath, &format!("更新 {}", filepath))
                .map_err(|e| e.to_string())?;
        }
        
        Ok("文件保存成功".to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn list_files(
    state: State<'_, AppState>,
    dirpath: String,
) -> Result<Vec<String>, String> {
    let file_manager = state.file_manager.lock().unwrap();
    let config = state.config.lock().unwrap();
    
    if let Some(cfg) = config.as_ref() {
        file_manager.list_files(&cfg.local_path, &dirpath)
            .map_err(|e| e.to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn git_push(state: State<'_, AppState>) -> Result<String, String> {
    let git_manager = state.git_manager.lock().unwrap();
    
    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.push()
            .map_err(|e| e.to_string())?;
        Ok("推送成功".to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn git_pull(state: State<'_, AppState>) -> Result<String, String> {
    let git_manager = state.git_manager.lock().unwrap();
    
    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.pull()
            .map_err(|e| e.to_string())?;
        Ok("拉取成功".to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn save_config(
    state: State<'_, AppState>,
    config: Config,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let config_path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取配置目录")?
        .join("config.json");
    
    std::fs::create_dir_all(config_path.parent().unwrap())
        .map_err(|e| e.to_string())?;
    
    let config_str = serde_json::to_string_pretty(&config)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&config_path, config_str)
        .map_err(|e| e.to_string())?;
    
    *state.config.lock().unwrap() = Some(config);
    
    Ok("配置保存成功".to_string())
}

#[tauri::command]
async fn load_config(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Option<Config>, String> {
    let config_path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取配置目录")?
        .join("config.json");
    
    if !config_path.exists() {
        return Ok(None);
    }
    
    let config_str = std::fs::read_to_string(&config_path)
        .map_err(|e| e.to_string())?;
    
    let config: Config = serde_json::from_str(&config_str)
        .map_err(|e| e.to_string())?;
    
    Ok(Some(config))
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            git_manager: Mutex::new(None),
            file_manager: Mutex::new(FileManager::new()),
            config: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            init_git,
            read_file,
            write_file,
            list_files,
            git_push,
            git_pull,
            save_config,
            load_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
