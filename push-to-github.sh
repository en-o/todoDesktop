#!/bin/bash

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始推送到 GitHub...${NC}"
echo ""

# 进入脚本所在目录
cd "$(dirname "$0")"

# 检查是否已初始化
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}📦 初始化 Git 仓库...${NC}"
    git init
fi

echo -e "${YELLOW}📝 添加文件...${NC}"
git add .

echo -e "${YELLOW}💾 提交更改...${NC}"
git commit -m "Initial commit: Todo Desktop App with Tauri" \
    -m "" \
    -m "Features:" \
    -m "- 📅 Year/Month/Day calendar navigation" \
    -m "- 📝 Markdown editor with preview" \
    -m "- 🔄 Git version control" \
    -m "- ☁️ Support GitHub/GitLab/Gitee" \
    -m "- ⚙️ Flexible configuration"

# 检查远程仓库
if ! git remote | grep -q "origin"; then
    echo -e "${YELLOW}🔗 添加远程仓库...${NC}"
    git remote add origin https://github.com/en-o/todoDesktop.git
fi

echo -e "${YELLOW}🌿 设置主分支...${NC}"
git branch -M main

echo -e "${YELLOW}🚀 推送到 GitHub...${NC}"
if ! git push -u origin main; then
    echo ""
    echo -e "${RED}⚠️  推送失败，可能需要先拉取远程更改${NC}"
    echo -e "${YELLOW}正在尝试拉取并合并...${NC}"
    git pull origin main --allow-unrelated-histories
    git push -u origin main
fi

echo ""
echo -e "${GREEN}✅ 推送完成！${NC}"
echo -e "${BLUE}📦 访问仓库: https://github.com/en-o/todoDesktop${NC}"
echo ""
