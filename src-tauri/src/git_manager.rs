use git2::{Repository, Signature};
use anyhow::{Result, anyhow};
use std::path::Path;
use crate::config::{Config, GitInfo};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
        let mut cmd = std::process::Command::new("git");
        cmd.args(["clone", &clone_url, clone_path.to_str().unwrap()]);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
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

    /// 从 Git 中删除文件并提交
    pub fn remove_and_commit(&self, filepath: &str, message: &str) -> Result<()> {
        let mut index = self.repo.index()?;
        index.remove_path(Path::new(filepath))?;
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
        let mut cmd = std::process::Command::new("git");
        cmd.args(["push"])
            .current_dir(&self.config.local_path);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
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
        let mut cmd = std::process::Command::new("git");
        cmd.args(["pull"])
            .current_dir(&self.config.local_path);

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
            .output()
            .map_err(|e| anyhow!("无法执行 git 命令: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("{}", stderr.trim()));
        }

        Ok(())
    }

    /// 获取冲突文件列表
    pub fn get_conflict_files(&self) -> Result<Vec<String>> {
        let index = self.repo.index()?;
        let mut conflicts = Vec::new();

        if index.has_conflicts() {
            for conflict in index.conflicts()? {
                let conflict = conflict?;
                if let Some(our) = conflict.our {
                    let path = String::from_utf8_lossy(&our.path).to_string();
                    if !conflicts.contains(&path) {
                        conflicts.push(path);
                    }
                }
            }
        }

        Ok(conflicts)
    }

    /// 获取文件的不同版本（本地、远程、基础）
    pub fn get_conflict_versions(&self, filepath: &str) -> Result<(String, String, String)> {
        let full_path = Path::new(&self.config.local_path).join(filepath);

        // 读取当前工作区版本（可能包含冲突标记）
        let working_content = std::fs::read_to_string(&full_path)
            .unwrap_or_default();

        // 尝试获取 HEAD（本地）版本
        let local_content = self.get_file_at_ref("HEAD", filepath).unwrap_or_default();

        // 尝试获取 MERGE_HEAD（远程）版本
        let remote_content = self.get_file_at_ref("MERGE_HEAD", filepath).unwrap_or_default();

        Ok((local_content, remote_content, working_content))
    }

    fn get_file_at_ref(&self, refname: &str, filepath: &str) -> Result<String> {
        let obj = self.repo.revparse_single(refname)?;
        let commit = obj.peel_to_commit()?;
        let tree = commit.tree()?;
        let entry = tree.get_path(Path::new(filepath))?;
        let blob = self.repo.find_blob(entry.id())?;
        let content = std::str::from_utf8(blob.content())?.to_string();
        Ok(content)
    }

    /// 解决冲突：使用提供的内容覆盖文件并标记为已解决
    pub fn resolve_conflict(&self, filepath: &str, resolved_content: &str) -> Result<()> {
        let full_path = Path::new(&self.config.local_path).join(filepath);

        // 写入解决后的内容
        std::fs::write(&full_path, resolved_content)?;

        // 将文件添加到索引以标记冲突已解决
        let mut index = self.repo.index()?;
        index.add_path(Path::new(filepath))?;
        index.write()?;

        Ok(())
    }

    /// 检查是否处于合并冲突状态
    pub fn has_conflicts(&self) -> Result<bool> {
        let index = self.repo.index()?;
        Ok(index.has_conflicts())
    }

    /// 完成合并提交
    pub fn complete_merge(&self, message: &str) -> Result<()> {
        let mut index = self.repo.index()?;

        // 确保没有冲突
        if index.has_conflicts() {
            return Err(anyhow!("还有未解决的冲突"));
        }

        let tree_id = index.write_tree()?;
        let tree = self.repo.find_tree(tree_id)?;
        let signature = Signature::now(&self.config.user_name, &self.config.user_email)?;
        let head_commit = self.repo.head()?.peel_to_commit()?;

        // 获取 MERGE_HEAD
        let merge_head_path = Path::new(&self.config.local_path).join(".git/MERGE_HEAD");
        if !merge_head_path.exists() {
            return Err(anyhow!("不在合并状态中"));
        }

        let merge_head_str = std::fs::read_to_string(&merge_head_path)?;
        let merge_head_oid = git2::Oid::from_str(merge_head_str.trim())?;
        let merge_commit = self.repo.find_commit(merge_head_oid)?;

        self.repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&head_commit, &merge_commit],
        )?;

        // 清理合并状态
        self.repo.cleanup_state()?;

        Ok(())
    }
}
