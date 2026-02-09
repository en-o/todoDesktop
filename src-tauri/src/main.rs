// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git_manager;
mod file_manager;
mod config;

use git_manager::GitManager;
use file_manager::FileManager;
use config::{Config, GitInfo, DataPointer, Statistics, DailyStats, StatsSummary, PastUncompleted, PastUncompletedTask};
use std::sync::Mutex;
use std::path::Path;
use std::collections::HashMap;
use std::fs;
use regex::Regex;
use chrono::{Local, NaiveDate};
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
    // 1. 在本地数据目录创建 .desktop_data 目录
    let desktop_data_dir = Path::new(&config.local_path).join(".desktop_data");
    std::fs::create_dir_all(&desktop_data_dir)
        .map_err(|e| format!("创建 .desktop_data 目录失败: {}", e))?;

    // 2. 保存配置到 .desktop_data/config.json
    let config_path = desktop_data_dir.join("config.json");
    let config_str = serde_json::to_string_pretty(&config)
        .map_err(|e| e.to_string())?;
    std::fs::write(&config_path, &config_str)
        .map_err(|e| format!("保存配置失败: {}", e))?;

    // 3. 保存数据目录指针到 Tauri 应用数据目录
    let pointer_path = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?
        .join("pointer.json");
    std::fs::create_dir_all(pointer_path.parent().unwrap())
        .map_err(|e| e.to_string())?;

    let pointer = DataPointer {
        data_path: config.local_path.clone(),
    };
    let pointer_str = serde_json::to_string_pretty(&pointer)
        .map_err(|e| e.to_string())?;
    std::fs::write(&pointer_path, pointer_str)
        .map_err(|e| format!("保存指针失败: {}", e))?;

    // 4. 更新内存中的配置
    *state.config.lock().unwrap() = Some(config.clone());

    // 5. 如果 git 已初始化，提交配置文件
    if let Some(git_mgr) = state.git_manager.lock().unwrap().as_ref() {
        let _ = git_mgr.add_and_commit(".desktop_data/config.json", "更新配置");
    }

    Ok("配置保存成功".to_string())
}

#[tauri::command]
async fn load_config(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Option<Config>, String> {
    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("无法获取应用数据目录")?;

    let pointer_path = app_data_dir.join("pointer.json");
    let legacy_config_path = app_data_dir.join("config.json");

    // 1. 尝试从指针加载
    if pointer_path.exists() {
        let pointer_str = std::fs::read_to_string(&pointer_path)
            .map_err(|e| e.to_string())?;
        let pointer: DataPointer = serde_json::from_str(&pointer_str)
            .map_err(|e| e.to_string())?;

        // 从 .desktop_data 目录加载配置
        let config_path = Path::new(&pointer.data_path).join(".desktop_data").join("config.json");
        if config_path.exists() {
            let config_str = std::fs::read_to_string(&config_path)
                .map_err(|e| e.to_string())?;
            let config: Config = serde_json::from_str(&config_str)
                .map_err(|e| e.to_string())?;

            *state.config.lock().unwrap() = Some(config.clone());
            return Ok(Some(config));
        }
    }

    // 2. 兼容旧版：检查是否存在旧的 config.json
    if legacy_config_path.exists() {
        let config_str = std::fs::read_to_string(&legacy_config_path)
            .map_err(|e| e.to_string())?;
        let config: Config = serde_json::from_str(&config_str)
            .map_err(|e| e.to_string())?;

        // 迁移到新位置
        let desktop_data_dir = Path::new(&config.local_path).join(".desktop_data");
        if std::fs::create_dir_all(&desktop_data_dir).is_ok() {
            let new_config_path = desktop_data_dir.join("config.json");
            if std::fs::write(&new_config_path, &config_str).is_ok() {
                // 创建指针文件
                let pointer = DataPointer {
                    data_path: config.local_path.clone(),
                };
                if let Ok(pointer_str) = serde_json::to_string_pretty(&pointer) {
                    let _ = std::fs::write(&pointer_path, pointer_str);
                }
                // 删除旧配置文件
                let _ = std::fs::remove_file(&legacy_config_path);
            }
        }

        *state.config.lock().unwrap() = Some(config.clone());
        return Ok(Some(config));
    }

    Ok(None)
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

#[tauri::command]
async fn delete_attachments(
    state: State<'_, AppState>,
    year: String,
    month: String,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    let file_manager = state.file_manager.lock().unwrap();
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let deleted = file_manager
            .delete_attachments(&cfg.local_path, &year, &month, &paths)
            .map_err(|e| e.to_string())?;

        // 如果有文件被删除，提交到 git
        if !deleted.is_empty() {
            drop(file_manager);
            drop(config);

            let git_manager = state.git_manager.lock().unwrap();
            if let Some(git_mgr) = git_manager.as_ref() {
                for path in &deleted {
                    // 使用 remove_and_commit 从 git 中删除文件
                    let _ = git_mgr.remove_and_commit(path, &format!("删除附件 {}", path));
                }
            }
        }

        Ok(deleted)
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 获取统计文件路径
fn get_stats_path(local_path: &str) -> std::path::PathBuf {
    Path::new(local_path).join(".desktop_data").join("stats.json")
}

/// 加载统计数据
#[tauri::command]
async fn load_stats(state: State<'_, AppState>) -> Result<Statistics, String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let stats_path = get_stats_path(&cfg.local_path);

        if stats_path.exists() {
            let content = fs::read_to_string(&stats_path)
                .map_err(|e| e.to_string())?;
            let stats: Statistics = serde_json::from_str(&content)
                .map_err(|e| e.to_string())?;
            Ok(stats)
        } else {
            Ok(Statistics::default())
        }
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 保存统计数据
#[tauri::command]
async fn save_stats(state: State<'_, AppState>, stats: Statistics) -> Result<(), String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let stats_path = get_stats_path(&cfg.local_path);

        // 确保目录存在
        if let Some(parent) = stats_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let content = serde_json::to_string_pretty(&stats)
            .map_err(|e| e.to_string())?;
        fs::write(&stats_path, content).map_err(|e| e.to_string())?;

        // 提交到 git（静默处理）
        drop(config);
        let git_manager = state.git_manager.lock().unwrap();
        if let Some(git_mgr) = git_manager.as_ref() {
            let git_path = ".desktop_data/stats.json";
            let _ = git_mgr.add_and_commit(git_path, "更新统计数据");
        }

        Ok(())
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 从文件内容解析任务统计
fn parse_tasks_from_content(content: &str) -> DailyStats {
    let completed_regex = Regex::new(r"- \[x\]").unwrap();
    let uncompleted_regex = Regex::new(r"- \[ \]").unwrap();

    let completed = completed_regex.find_iter(content).count() as u32;
    let uncompleted = uncompleted_regex.find_iter(content).count() as u32;

    DailyStats {
        total: completed + uncompleted,
        completed,
        uncompleted,
    }
}

/// 重新计算所有统计数据（扫描所有历史文件）
#[tauri::command]
async fn recalculate_stats(state: State<'_, AppState>) -> Result<Statistics, String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let base_path = Path::new(&cfg.local_path);
        let today = Local::now().format("%Y-%m-%d").to_string();
        let today_date = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
            .map_err(|e| e.to_string())?;

        let mut daily: HashMap<String, DailyStats> = HashMap::new();

        // 遍历年份目录
        if let Ok(year_entries) = fs::read_dir(base_path) {
            for year_entry in year_entries.flatten() {
                let year_path = year_entry.path();
                let year_name = year_entry.file_name().to_string_lossy().to_string();

                // 跳过非年份目录
                if !year_path.is_dir() || year_name.starts_with('.') || year_name.parse::<u32>().is_err() {
                    continue;
                }

                // 遍历月份目录
                if let Ok(month_entries) = fs::read_dir(&year_path) {
                    for month_entry in month_entries.flatten() {
                        let month_path = month_entry.path();
                        let month_name = month_entry.file_name().to_string_lossy().to_string();

                        // 跳过非月份目录
                        if !month_path.is_dir() || month_name.parse::<u32>().is_err() {
                            continue;
                        }

                        // 遍历日期文件
                        if let Ok(file_entries) = fs::read_dir(&month_path) {
                            for file_entry in file_entries.flatten() {
                                let file_name = file_entry.file_name().to_string_lossy().to_string();

                                // 匹配 MM-DD.md 格式
                                if let Some(caps) = Regex::new(r"^(\d{2}-\d{2})\.md$")
                                    .unwrap()
                                    .captures(&file_name)
                                {
                                    let date_str = format!("{}-{}", year_name, &caps[1]);

                                    // 只统计今天及之前的日期
                                    if let Ok(date) = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
                                        if date > today_date {
                                            continue;
                                        }

                                        // 读取并解析文件
                                        if let Ok(content) = fs::read_to_string(file_entry.path()) {
                                            let stats = parse_tasks_from_content(&content);
                                            if stats.total > 0 {
                                                daily.insert(date_str, stats);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 计算汇总统计
        let summary = calculate_summary(&daily, &today);

        let stats = Statistics {
            last_updated: today,
            daily,
            summary,
        };

        // 保存统计
        let stats_path = get_stats_path(&cfg.local_path);
        if let Some(parent) = stats_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(content) = serde_json::to_string_pretty(&stats) {
            let _ = fs::write(&stats_path, content);
        }

        // 提交到 git（静默处理）
        drop(config);
        let git_manager = state.git_manager.lock().unwrap();
        if let Some(git_mgr) = git_manager.as_ref() {
            let git_path = ".desktop_data/stats.json";
            let _ = git_mgr.add_and_commit(git_path, "重新计算统计数据");
        }

        Ok(stats)
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 计算汇总统计
fn calculate_summary(daily: &HashMap<String, DailyStats>, today: &str) -> StatsSummary {
    let mut total_tasks_created: u32 = 0;
    let mut total_tasks_completed: u32 = 0;
    let mut days_with_tasks: u32 = 0;
    let mut perfect_days: u32 = 0;

    // 收集所有日期并排序
    let mut dates: Vec<&String> = daily.keys().collect();
    dates.sort();

    for date in &dates {
        if let Some(stats) = daily.get(*date) {
            total_tasks_created += stats.total;
            total_tasks_completed += stats.completed;

            if stats.total > 0 {
                days_with_tasks += 1;
                if stats.uncompleted == 0 {
                    perfect_days += 1;
                }
            }
        }
    }

    // 计算连续完成天数（从今天往前数）
    let mut current_streak: u32 = 0;
    let mut longest_streak: u32 = 0;
    let mut temp_streak: u32 = 0;

    // 从今天开始往前检查
    if let Ok(mut check_date) = NaiveDate::parse_from_str(today, "%Y-%m-%d") {
        loop {
            let date_str = check_date.format("%Y-%m-%d").to_string();

            if let Some(stats) = daily.get(&date_str) {
                if stats.total > 0 && stats.uncompleted == 0 {
                    current_streak += 1;
                    check_date = check_date.pred_opt().unwrap_or(check_date);
                } else if stats.total > 0 {
                    // 有任务但未全部完成，中断连续
                    break;
                } else {
                    // 没有任务的日期跳过
                    check_date = check_date.pred_opt().unwrap_or(check_date);
                    // 如果连续10天没有数据，停止检查
                    if daily.get(&check_date.format("%Y-%m-%d").to_string()).is_none() {
                        break;
                    }
                }
            } else {
                break;
            }
        }
    }

    // 计算历史最长连续
    for date in &dates {
        if let Some(stats) = daily.get(*date) {
            if stats.total > 0 && stats.uncompleted == 0 {
                temp_streak += 1;
                if temp_streak > longest_streak {
                    longest_streak = temp_streak;
                }
            } else if stats.total > 0 {
                temp_streak = 0;
            }
        }
    }

    let completion_rate = if total_tasks_created > 0 {
        total_tasks_completed as f64 / total_tasks_created as f64
    } else {
        0.0
    };

    let average_tasks_per_day = if days_with_tasks > 0 {
        total_tasks_created as f64 / days_with_tasks as f64
    } else {
        0.0
    };

    StatsSummary {
        total_tasks_created,
        total_tasks_completed,
        completion_rate,
        current_streak,
        longest_streak,
        average_tasks_per_day,
        total_days: dates.len() as u32,
        days_with_tasks,
        perfect_days,
    }
}

/// 更新指定日期的统计（当文件内容变化时调用）
#[tauri::command]
async fn update_daily_stats(
    state: State<'_, AppState>,
    date: String,
    total: u32,
    completed: u32,
    uncompleted: u32,
) -> Result<Statistics, String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let stats_path = get_stats_path(&cfg.local_path);
        let today = Local::now().format("%Y-%m-%d").to_string();

        // 只统计今天及之前的日期
        if let Ok(input_date) = NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
            if let Ok(today_date) = NaiveDate::parse_from_str(&today, "%Y-%m-%d") {
                if input_date > today_date {
                    return Err("不统计未来日期".to_string());
                }
            }
        }

        // 加载现有统计
        let mut stats = if stats_path.exists() {
            let content = fs::read_to_string(&stats_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Statistics::default()
        };

        // 更新每日统计
        if total > 0 {
            stats.daily.insert(date.clone(), DailyStats {
                total,
                completed,
                uncompleted,
            });
        } else {
            stats.daily.remove(&date);
        }

        // 重新计算汇总
        stats.summary = calculate_summary(&stats.daily, &today);
        stats.last_updated = today;

        // 保存
        if let Some(parent) = stats_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let content = serde_json::to_string_pretty(&stats)
            .map_err(|e| e.to_string())?;
        fs::write(&stats_path, &content).map_err(|e| e.to_string())?;

        // 提交到 git（静默处理，不影响主流程）
        drop(config);
        let git_manager = state.git_manager.lock().unwrap();
        if let Some(git_mgr) = git_manager.as_ref() {
            let git_path = ".desktop_data/stats.json";
            let _ = git_mgr.add_and_commit(git_path, "更新统计数据");
        }

        Ok(stats)
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 获取往期未完成数据文件路径
fn get_past_uncompleted_path(local_path: &str) -> std::path::PathBuf {
    Path::new(local_path).join(".desktop_data").join("past_uncompleted.json")
}

/// 生成任务ID
fn generate_task_id(source_date: &str, text: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    format!("{}:{}", source_date, text).hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// 加载往期未完成数据
#[tauri::command]
async fn load_past_uncompleted(state: State<'_, AppState>) -> Result<PastUncompleted, String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let path = get_past_uncompleted_path(&cfg.local_path);

        if path.exists() {
            let content = fs::read_to_string(&path)
                .map_err(|e| e.to_string())?;
            let data: PastUncompleted = serde_json::from_str(&content)
                .map_err(|e| e.to_string())?;
            Ok(data)
        } else {
            Ok(PastUncompleted::default())
        }
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 保存往期未完成数据
#[tauri::command]
async fn save_past_uncompleted(state: State<'_, AppState>, data: PastUncompleted) -> Result<(), String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let path = get_past_uncompleted_path(&cfg.local_path);

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let content = serde_json::to_string_pretty(&data)
            .map_err(|e| e.to_string())?;
        fs::write(&path, &content).map_err(|e| e.to_string())?;

        // 提交到 git
        drop(config);
        let git_manager = state.git_manager.lock().unwrap();
        if let Some(git_mgr) = git_manager.as_ref() {
            let git_path = ".desktop_data/past_uncompleted.json";
            let _ = git_mgr.add_and_commit(git_path, "更新往期未完成数据");
        }

        Ok(())
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 扫描往期未完成任务（主动扫描）
#[tauri::command]
async fn scan_past_uncompleted(state: State<'_, AppState>) -> Result<Vec<PastUncompletedTask>, String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        let base_path = Path::new(&cfg.local_path);
        let today = Local::now().format("%Y-%m-%d").to_string();
        let today_date = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
            .map_err(|e| e.to_string())?;

        // 加载已忽略列表
        let past_path = get_past_uncompleted_path(&cfg.local_path);
        let dismissed: Vec<String> = if past_path.exists() {
            let content = fs::read_to_string(&past_path).unwrap_or_default();
            let data: PastUncompleted = serde_json::from_str(&content).unwrap_or_default();
            data.dismissed
        } else {
            vec![]
        };

        let mut tasks: Vec<PastUncompletedTask> = vec![];
        let uncompleted_regex = Regex::new(r"^-\s*\[\s\]\s*(.+)$").unwrap();

        // 遍历年份目录
        if let Ok(year_entries) = fs::read_dir(base_path) {
            for year_entry in year_entries.flatten() {
                let year_path = year_entry.path();
                let year_name = year_entry.file_name().to_string_lossy().to_string();

                if !year_path.is_dir() || year_name.starts_with('.') || year_name.parse::<u32>().is_err() {
                    continue;
                }

                // 遍历月份目录
                if let Ok(month_entries) = fs::read_dir(&year_path) {
                    for month_entry in month_entries.flatten() {
                        let month_path = month_entry.path();
                        let month_name = month_entry.file_name().to_string_lossy().to_string();

                        if !month_path.is_dir() || month_name.parse::<u32>().is_err() {
                            continue;
                        }

                        // 遍历日期文件
                        if let Ok(file_entries) = fs::read_dir(&month_path) {
                            for file_entry in file_entries.flatten() {
                                let file_name = file_entry.file_name().to_string_lossy().to_string();

                                // 匹配 MM-DD.md 格式
                                if let Some(caps) = Regex::new(r"^(\d{2}-\d{2})\.md$")
                                    .unwrap()
                                    .captures(&file_name)
                                {
                                    let date_str = format!("{}-{}", year_name, &caps[1]);

                                    // 只检查今天之前的日期
                                    if let Ok(date) = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
                                        if date >= today_date {
                                            continue;
                                        }

                                        // 读取文件并查找未完成任务
                                        if let Ok(content) = fs::read_to_string(file_entry.path()) {
                                            let mut in_todo_section = false;

                                            for line in content.lines() {
                                                // 检测 section
                                                if line.contains("## 待办事项") {
                                                    in_todo_section = true;
                                                    continue;
                                                }
                                                if line.contains("## 完成事项") || line.contains("## 笔记") {
                                                    in_todo_section = false;
                                                    continue;
                                                }

                                                // 只在待办事项区域查找
                                                if in_todo_section {
                                                    // 匹配未完成的父级任务（不以空格开头）
                                                    if let Some(caps) = uncompleted_regex.captures(line.trim_start_matches(' ')) {
                                                        // 确保不是缩进的子任务
                                                        if !line.starts_with("  ") {
                                                            let text = caps[1].trim().to_string();
                                                            if !text.is_empty() {
                                                                let id = generate_task_id(&date_str, &text);

                                                                // 检查是否已忽略
                                                                if !dismissed.contains(&id) {
                                                                    tasks.push(PastUncompletedTask {
                                                                        source_date: date_str.clone(),
                                                                        text,
                                                                        id,
                                                                    });
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 按日期排序（最近的在前）
        tasks.sort_by(|a, b| b.source_date.cmp(&a.source_date));

        Ok(tasks)
    } else {
        Err("未配置本地目录".to_string())
    }
}

/// 从源文件删除任务
#[tauri::command]
async fn delete_past_task(
    state: State<'_, AppState>,
    source_date: String,
    text: String,
) -> Result<(), String> {
    let config = state.config.lock().unwrap();

    if let Some(cfg) = config.as_ref() {
        // 解析日期获取文件路径
        let parts: Vec<&str> = source_date.split('-').collect();
        if parts.len() != 3 {
            return Err("日期格式错误".to_string());
        }
        let year = parts[0];
        let month = parts[1];
        let day = format!("{}-{}", parts[1], parts[2]);

        let filepath = Path::new(&cfg.local_path)
            .join(year)
            .join(month)
            .join(format!("{}.md", day));

        if !filepath.exists() {
            return Err("源文件不存在".to_string());
        }

        // 读取文件内容
        let content = fs::read_to_string(&filepath)
            .map_err(|e| e.to_string())?;

        // 移除匹配的任务行及其子内容
        let mut new_lines: Vec<String> = vec![];
        let mut skip_children = false;
        let task_regex = Regex::new(&format!(r"^-\s*\[\s\]\s*{}$", regex::escape(&text))).unwrap();

        for line in content.lines() {
            if skip_children {
                // 如果是缩进的行（子任务或子内容），继续跳过
                if line.starts_with("  ") || line.trim().is_empty() {
                    continue;
                } else {
                    skip_children = false;
                }
            }

            // 检查是否是要删除的任务
            if task_regex.is_match(line.trim_start_matches(' ')) && !line.starts_with("  ") {
                skip_children = true;
                continue;
            }

            new_lines.push(line.to_string());
        }

        // 写回文件
        let new_content = new_lines.join("\n");
        fs::write(&filepath, &new_content)
            .map_err(|e| e.to_string())?;

        // 提交到 git
        drop(config);
        let git_manager = state.git_manager.lock().unwrap();
        if let Some(git_mgr) = git_manager.as_ref() {
            let git_path = format!("{}/{}/{}.md", year, month, day);
            let _ = git_mgr.add_and_commit(&git_path, &format!("删除往期任务: {}", text));
        }

        Ok(())
    } else {
        Err("未配置本地目录".to_string())
    }
}

fn main() {
    // 检查是否带有 --quit 参数（用于更新安装时关闭应用）
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--quit" || arg == "/quit") {
        // 直接退出，不启动应用
        return;
    }

    // 创建系统托盘菜单
    let show = CustomMenuItem::new("show".to_string(), "显示主窗口");
    let sync = CustomMenuItem::new("sync".to_string(), "同步数据");
    let quit = CustomMenuItem::new("quit".to_string(), "退出程序");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(sync)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        // 单实例插件：防止重复打开
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // 检查是否带有 --quit 参数（用于更新安装时关闭现有实例）
            if argv.iter().any(|arg| arg == "--quit" || arg == "/quit") {
                app.exit(0);
                return;
            }
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
                "sync" => {
                    // 手动同步
                    let state: tauri::State<AppState> = app.state();
                    let git_manager = state.git_manager.lock().unwrap();
                    if let Some(git_mgr) = git_manager.as_ref() {
                        let _ = git_mgr.pull();
                        let _ = git_mgr.push();
                    }
                }
                "quit" => {
                    // 退出前同步
                    let state: tauri::State<AppState> = app.state();
                    let git_manager = state.git_manager.lock().unwrap();
                    if let Some(git_mgr) = git_manager.as_ref() {
                        let _ = git_mgr.pull();
                        let _ = git_mgr.push();
                    }
                    drop(git_manager);
                    app.exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            match event.event() {
                // 点击关闭按钮时同步并隐藏到托盘
                WindowEvent::CloseRequested { api, .. } => {
                    // 同步数据
                    let app = event.window().app_handle();
                    let state: tauri::State<AppState> = app.state();
                    let git_manager = state.git_manager.lock().unwrap();
                    if let Some(git_mgr) = git_manager.as_ref() {
                        let _ = git_mgr.pull();
                        let _ = git_mgr.push();
                    }
                    drop(git_manager);

                    // 隐藏到托盘
                    event.window().hide().unwrap();
                    api.prevent_close();
                }
                _ => {}
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
            delete_attachments,
            has_conflicts,
            get_conflict_files,
            get_conflict_versions,
            resolve_conflict,
            complete_merge,
            load_stats,
            save_stats,
            recalculate_stats,
            update_daily_stats,
            load_past_uncompleted,
            save_past_uncompleted,
            scan_past_uncompleted,
            delete_past_task,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
