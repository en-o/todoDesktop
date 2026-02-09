use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub local_path: String,
    pub user_name: String,
    pub user_email: String,
    pub remote_url: Option<String>,
    pub token: Option<String>,
    pub git_provider: String, // github, gitlab, gitee
    pub enable_github_pages: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            local_path: String::new(),
            user_name: String::new(),
            user_email: String::new(),
            remote_url: None,
            token: None,
            git_provider: "github".to_string(),
            enable_github_pages: false,
        }
    }
}

/// 从现有 Git 仓库检测到的配置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub remote_url: Option<String>,
    pub git_provider: Option<String>,
}

/// 数据目录指针（存储在 Tauri 应用数据目录中）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataPointer {
    pub data_path: String,
}

/// 每日统计数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DailyStats {
    pub total: u32,
    pub completed: u32,
    pub uncompleted: u32,
}

/// 统计汇总数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    /// 历史总任务数
    pub total_tasks_created: u32,
    /// 历史总完成数
    pub total_tasks_completed: u32,
    /// 完成率 (0-1)
    pub completion_rate: f64,
    /// 当前连续完成天数（每天都有任务且全部完成）
    pub current_streak: u32,
    /// 最长连续完成天数
    pub longest_streak: u32,
    /// 平均每日任务数
    pub average_tasks_per_day: f64,
    /// 统计的天数
    pub total_days: u32,
    /// 有任务的天数
    pub days_with_tasks: u32,
    /// 全部完成的天数
    pub perfect_days: u32,
}

/// 统计数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Statistics {
    /// 最后更新时间
    pub last_updated: String,
    /// 每日统计 (key: YYYY-MM-DD)
    pub daily: HashMap<String, DailyStats>,
    /// 汇总统计
    pub summary: StatsSummary,
}

/// 往期未完成任务项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PastUncompletedTask {
    /// 任务来源日期 (YYYY-MM-DD)
    pub source_date: String,
    /// 任务文本
    pub text: String,
    /// 唯一标识 (source_date:text的hash)
    pub id: String,
}

/// 往期未完成任务数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PastUncompleted {
    /// 已忽略的任务ID列表
    pub dismissed: Vec<String>,
    /// 最后检查日期
    pub last_checked: String,
}
