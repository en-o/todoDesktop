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

    /// 上传附件到 assets 目录
    /// 返回相对路径用于 Markdown 引用
    pub fn upload_attachment(
        &self,
        base_path: &str,
        year: &str,
        month: &str,
        filename: &str,
        data: &[u8],
    ) -> Result<String> {
        // 构建 assets 目录路径: 年/月/assets/
        let assets_dir = Path::new(base_path)
            .join(year)
            .join(month)
            .join("assets");

        // 确保目录存在
        fs::create_dir_all(&assets_dir)?;

        // 构建完整文件路径
        let file_path = assets_dir.join(filename);

        // 写入文件
        fs::write(&file_path, data)?;

        // 返回相对路径: assets/filename
        Ok(format!("assets/{}", filename))
    }
}
