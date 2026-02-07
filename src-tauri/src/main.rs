// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git_manager;
mod file_manager;
mod config;

use git_manager::GitManager;
use file_manager::FileManager;
use config::{Config, GitInfo};
use std::sync::Mutex;
use tauri::{
    CustomMenuItem, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, WindowEvent,
};

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

    // 立即设置配置到状态，让 read_file 等命令可以使用
    *state.config.lock().unwrap() = Some(config.clone());

    Ok(Some(config))
}

#[tauri::command]
async fn clone_repo(
    url: String,
    path: String,
    token: Option<String>,
) -> Result<String, String> {
    // 返回实际克隆的路径
    GitManager::clone_repo(&url, &path, token.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn detect_git_config(path: String) -> Result<Option<GitInfo>, String> {
    GitManager::detect_config(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_git_repo(path: String) -> Result<bool, String> {
    Ok(GitManager::is_git_repo(&path))
}

#[tauri::command]
async fn has_conflicts(state: State<'_, AppState>) -> Result<bool, String> {
    let git_manager = state.git_manager.lock().unwrap();

    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.has_conflicts()
            .map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn get_conflict_files(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let git_manager = state.git_manager.lock().unwrap();

    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.get_conflict_files()
            .map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn get_conflict_versions(
    state: State<'_, AppState>,
    filepath: String,
) -> Result<(String, String, String), String> {
    let git_manager = state.git_manager.lock().unwrap();

    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.get_conflict_versions(&filepath)
            .map_err(|e| e.to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn resolve_conflict(
    state: State<'_, AppState>,
    filepath: String,
    content: String,
) -> Result<String, String> {
    let git_manager = state.git_manager.lock().unwrap();

    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.resolve_conflict(&filepath, &content)
            .map_err(|e| e.to_string())?;
        Ok("冲突已解决".to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn complete_merge(
    state: State<'_, AppState>,
    message: String,
) -> Result<String, String> {
    let git_manager = state.git_manager.lock().unwrap();

    if let Some(git_mgr) = git_manager.as_ref() {
        git_mgr.complete_merge(&message)
            .map_err(|e| e.to_string())?;
        Ok("合并完成".to_string())
    } else {
        Err("Git 未初始化".to_string())
    }
}

#[tauri::command]
async fn upload_attachment(
    state: State<'_, AppState>,
    year: String,
    month: String,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let file_manager = state.file_manager.lock().unwrap();
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let relative_path = file_manager
            .upload_attachment(&cfg.local_path, &year, &month, &filename, &data)
            .map_err(|e| e.to_string())?;

        // 构建完整的相对路径用于 git add
        let git_path = format!("{}/{}/{}", year, month, relative_path);

        // 使用 GitManager 添加并提交附件
        drop(file_manager); // 释放 file_manager 锁
        drop(config); // 释放 config 锁

        let git_manager = state.git_manager.lock().unwrap();
        if let Some(git_mgr) = git_manager.as_ref() {
            git_mgr.add_and_commit(&git_path, &format!("上传附件 {}", filename))
                .map_err(|e| e.to_string())?;
        }

        Ok(relative_path)
    } else {
        Err("未配置本地目录".to_string())
    }
}

fn main() {
    // 创建系统托盘菜单
    let show = CustomMenuItem::new("show".to_string(), "显示主窗口");
    let quit = CustomMenuItem::new("quit".to_string(), "退出程序");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        // 单实例插件：防止重复打开
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // 当尝试打开第二个实例时，显示并聚焦现有窗口
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                // 单击托盘图标显示窗口
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            SystemTrayEvent::DoubleClick { .. } => {
                // 双击托盘图标显示窗口
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            // 点击关闭按钮时隐藏到托盘而不是退出
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
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
            clone_repo,
            detect_git_config,
            is_git_repo,
            upload_attachment,
            has_conflicts,
            get_conflict_files,
            get_conflict_versions,
            resolve_conflict,
            complete_merge,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
