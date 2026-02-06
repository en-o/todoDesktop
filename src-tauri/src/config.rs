use serde::{Deserialize, Serialize};

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
