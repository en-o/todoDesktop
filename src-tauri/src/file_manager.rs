use anyhow::Result;
use std::fs;
use std::path::Path;

pub struct FileManager;

impl FileManager {
    pub fn new() -> Self {
        Self
    }
    
    pub fn read_file(&self, base_path: &str, filepath: &str) -> Result<String> {
        let full_path = Path::new(base_path).join(filepath);
        
        if !full_path.exists() {
            return Ok(String::new());
        }
        
        let content = fs::read_to_string(full_path)?;
        Ok(content)
    }
    
    pub fn write_file(&self, base_path: &str, filepath: &str, content: &str) -> Result<()> {
        let full_path = Path::new(base_path).join(filepath);
        
        // 确保目录存在
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        fs::write(full_path, content)?;
        Ok(())
    }
    
    pub fn list_files(&self, base_path: &str, dirpath: &str) -> Result<Vec<String>> {
        let full_path = Path::new(base_path).join(dirpath);
        
        if !full_path.exists() {
            return Ok(Vec::new());
        }
        
        let mut files = Vec::new();
        
        for entry in fs::read_dir(full_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if let Some(filename) = path.file_name() {
                if let Some(name) = filename.to_str() {
                    // 跳过 .git 目录和隐藏文件
                    if !name.starts_with('.') {
                        files.push(name.to_string());
                    }
                }
            }
        }
        
        files.sort();
        Ok(files)
    }
    
    pub fn exists(&self, base_path: &str, filepath: &str) -> bool {
        let full_path = Path::new(base_path).join(filepath);
        full_path.exists()
    }
    
    pub fn delete_file(&self, base_path: &str, filepath: &str) -> Result<()> {
        let full_path = Path::new(base_path).join(filepath);
        fs::remove_file(full_path)?;
        Ok(())
    }
}
