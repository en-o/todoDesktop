use git2::{Cred, Direction, FetchOptions, IndexAddOption, PushOptions, Remote, RemoteCallbacks, Repository, Signature};
use anyhow::{Result, anyhow};
use std::path::Path;
use crate::config::Config;

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
        let mut remote = self.repo.find_remote("origin")?;
        
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, _allowed_types| {
            Cred::userpass_plaintext(
                username_from_url.unwrap_or("git"),
                &self.config.token.as_ref().unwrap_or(&String::new()),
            )
        });
        
        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(callbacks);
        
        remote.push(
            &["refs/heads/main:refs/heads/main"],
            Some(&mut push_options),
        )?;
        
        Ok(())
    }
    
    pub fn pull(&self) -> Result<()> {
        let mut remote = self.repo.find_remote("origin")?;
        
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(|_url, username_from_url, _allowed_types| {
            Cred::userpass_plaintext(
                username_from_url.unwrap_or("git"),
                &self.config.token.as_ref().unwrap_or(&String::new()),
            )
        });
        
        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);
        
        remote.fetch(&["main"], Some(&mut fetch_options), None)?;
        
        // 执行 merge
        let fetch_head = self.repo.find_reference("FETCH_HEAD")?;
        let fetch_commit = self.repo.reference_to_annotated_commit(&fetch_head)?;
        
        let analysis = self.repo.merge_analysis(&[&fetch_commit])?;
        
        if analysis.0.is_up_to_date() {
            Ok(())
        } else if analysis.0.is_fast_forward() {
            // 快进合并
            let refname = "refs/heads/main";
            let mut reference = self.repo.find_reference(refname)?;
            reference.set_target(fetch_commit.id(), "Fast-Forward")?;
            self.repo.set_head(refname)?;
            self.repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
            Ok(())
        } else {
            Err(anyhow!("需要手动解决冲突"))
        }
    }
}
