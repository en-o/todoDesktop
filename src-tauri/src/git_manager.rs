use git2::{Repository, Signature};
use anyhow::{Result, anyhow};
use std::path::Path;
use crate::config::{Config, GitInfo};

pub struct GitManager {
    repo: Repository,
    config: Config,
}

impl GitManager {
    pub fn new(config: Config) -> Result<Self> {
        let path = Path::new(&config.local_path);

        let repo = if path.join(".git").exists() {
            Repository::open(path)?
        } else {
            std::fs::create_dir_all(path)?;
            Repository::init(path)?
        };

        Ok(Self { repo, config })
    }

    /// 克隆远程仓库到本地，返回实际克隆的路径
    /// 使用系统 git 命令以支持 Git Credential Manager
    pub fn clone_repo(url: &str, base_path: &str, token: Option<&str>) -> Result<String> {
        // 从 URL 提取仓库名
        let repo_name = url
            .trim_end_matches('/')
            .trim_end_matches(".git")
            .rsplit('/')
            .next()
            .ok_or_else(|| anyhow!("无法从 URL 解析仓库名"))?;

        let clone_path = Path::new(base_path).join(repo_name);

        // 如果目标目录已存在且不为空，报错
        if clone_path.exists() {
            let is_empty = clone_path.read_dir()?.next().is_none();
            if !is_empty {
                return Err(anyhow!("目录 {} 已存在且不为空", repo_name));
            }
        }

        // 确保父目录存在
        std::fs::create_dir_all(base_path)?;

        // 构建克隆 URL（如果有 token，使用 x-access-token 格式）
        let clone_url = match token {
            Some(t) if !t.is_empty() => {
                if let Some(pos) = url.find("://") {
                    format!("{}://x-access-token:{}@{}", &url[..pos], t, &url[pos + 3..])
                } else {
                    url.to_string()
                }
            }
            _ => url.to_string(),
        };

        // 执行克隆
        let output = std::process::Command::new("git")
            .args(["clone", &clone_url, clone_path.to_str().unwrap()])
            .output()
            .map_err(|e| anyhow!("无法执行 git 命令: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("{}", stderr.trim()));
        }

        // 返回实际克隆路径
        Ok(clone_path.to_string_lossy().to_string())
    }

    /// 检测现有 Git 仓库的配置信息
    pub fn detect_config(path: &str) -> Result<Option<GitInfo>> {
        let path = Path::new(path);

        if !path.join(".git").exists() {
            return Ok(None);
        }

        let repo = Repository::open(path)?;
        let config = repo.config()?;

        let user_name = config.get_string("user.name").ok();
        let user_email = config.get_string("user.email").ok();

        // 获取远程仓库 URL
        let remote_url = repo.find_remote("origin")
            .ok()
            .and_then(|remote| remote.url().map(|s| s.to_string()));

        // 根据 URL 判断 Git 提供商
        let git_provider = remote_url.as_ref().map(|url| {
            if url.contains("github.com") {
                "github".to_string()
            } else if url.contains("gitlab.com") {
                "gitlab".to_string()
            } else if url.contains("gitee.com") {
                "gitee".to_string()
            } else {
                "github".to_string()
            }
        });

        Ok(Some(GitInfo {
            user_name,
            user_email,
            remote_url,
            git_provider,
        }))
    }

    /// 检查目录是否是有效的 Git 仓库
    pub fn is_git_repo(path: &str) -> bool {
        Path::new(path).join(".git").exists()
    }

    pub fn init(&self) -> Result<()> {
        // 设置用户信息
        let mut git_config = self.repo.config()?;
        git_config.set_str("user.name", &self.config.user_name)?;
        git_config.set_str("user.email", &self.config.user_email)?;

        // 检查是否有初始提交
        if self.repo.is_empty()? {
            self.create_initial_commit()?;
        }

        // 设置远程仓库
        if let Some(remote_url) = &self.config.remote_url {
            if !remote_url.is_empty() {
                match self.repo.find_remote("origin") {
                    Ok(_) => {
                        // 更新已存在的远程仓库
                        self.repo.remote_set_url("origin", remote_url)?;
                    }
                    Err(_) => {
                        // 添加新的远程仓库
                        self.repo.remote("origin", remote_url)?;
                    }
                }
            }
        }

        Ok(())
    }

    fn create_initial_commit(&self) -> Result<()> {
        // 创建 README.md
        let readme_path = Path::new(&self.config.local_path).join("README.md");
        std::fs::write(
            &readme_path,
            "# Todo List\n\n我的 Todo 列表，按 年/月/日期.md 组织。\n"
        )?;

        // 添加并提交
        let mut index = self.repo.index()?;
        index.add_path(Path::new("README.md"))?;
        index.write()?;

        let tree_id = index.write_tree()?;
        let tree = self.repo.find_tree(tree_id)?;

        let signature = Signature::now(&self.config.user_name, &self.config.user_email)?;

        self.repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "初始化仓库",
            &tree,
            &[],
        )?;

        Ok(())
    }

    pub fn add_and_commit(&self, filepath: &str, message: &str) -> Result<()> {
        let mut index = self.repo.index()?;
        index.add_path(Path::new(filepath))?;
        index.write()?;

        let tree_id = index.write_tree()?;
        let tree = self.repo.find_tree(tree_id)?;

        let signature = Signature::now(&self.config.user_name, &self.config.user_email)?;

        let parent_commit = self.repo.head()?.peel_to_commit()?;

        self.repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&parent_commit],
        )?;

        Ok(())
    }

    pub fn push(&self) -> Result<()> {
        // 使用系统 git 命令以支持 Git Credential Manager
        let output = std::process::Command::new("git")
            .args(["push"])
            .current_dir(&self.config.local_path)
            .output()
            .map_err(|e| anyhow!("无法执行 git 命令: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("{}", stderr.trim()));
        }

        Ok(())
    }

    pub fn pull(&self) -> Result<()> {
        // 使用系统 git 命令以支持 Git Credential Manager
        let output = std::process::Command::new("git")
            .args(["pull"])
            .current_dir(&self.config.local_path)
            .output()
            .map_err(|e| anyhow!("无法执行 git 命令: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("{}", stderr.trim()));
        }

        Ok(())
    }
}
