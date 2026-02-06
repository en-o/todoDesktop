import { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Switch, Card, message, Space, Alert, Radio, Spin } from 'antd';
import { FolderOpenOutlined, SaveOutlined, CloudDownloadOutlined, ImportOutlined, ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useConfigStore, Config } from '../store/configStore';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { useNavigate } from 'react-router-dom';
import './Settings.css';

const { Option } = Select;

type DataSourceType = 'clone' | 'import';

interface GitInfo {
  userName: string | null;
  userEmail: string | null;
  remoteUrl: string | null;
  gitProvider: string | null;
}

export default function Settings() {
  const navigate = useNavigate();
  const { config, saveConfig, initGit, isConfigured } = useConfigStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [dataSource, setDataSource] = useState<DataSourceType>('clone');
  const [localPath, setLocalPath] = useState('');
  const [editMode, setEditMode] = useState(false);

  // 如果未配置，默认进入编辑模式
  useEffect(() => {
    if (!isConfigured) {
      setEditMode(true);
    }
  }, [isConfigured]);

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config);
      setLocalPath(config.localPath || '');
    }
  }, [config, form]);

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择 Todo 数据目录',
      });

      if (selected && typeof selected === 'string') {
        form.setFieldValue('localPath', selected);
        setLocalPath(selected);

        // If importing existing project, detect git config
        if (dataSource === 'import') {
          await detectGitConfig(selected);
        }
      }
    } catch (error) {
      message.error('选择目录失败');
    }
  };

  const detectGitConfig = async (path: string) => {
    setDetecting(true);
    try {
      const isGitRepo = await invoke<boolean>('is_git_repo', { path });
      if (!isGitRepo) {
        message.warning('所选目录不是 Git 仓库');
        return;
      }

      const gitInfo = await invoke<GitInfo | null>('detect_git_config', { path });
      if (gitInfo) {
        // Auto-fill form with detected config
        if (gitInfo.userName) {
          form.setFieldValue('userName', gitInfo.userName);
        }
        if (gitInfo.userEmail) {
          form.setFieldValue('userEmail', gitInfo.userEmail);
        }
        if (gitInfo.remoteUrl) {
          form.setFieldValue('remoteUrl', gitInfo.remoteUrl);
        }
        if (gitInfo.gitProvider) {
          form.setFieldValue('gitProvider', gitInfo.gitProvider);
        }
        message.success('已自动读取 Git 配置');
      }
    } catch (error) {
      message.error(`检测 Git 配置失败: ${error}`);
    } finally {
      setDetecting(false);
    }
  };

  const handleCloneRepo = async () => {
    const remoteUrl = form.getFieldValue('remoteUrl');
    const basePath = localPath;
    const token = form.getFieldValue('token');

    if (!remoteUrl) {
      message.error('请输入远程仓库地址');
      return;
    }
    if (!basePath) {
      message.error('请选择本地目录');
      return;
    }

    setCloning(true);
    try {
      // clone_repo 返回实际克隆的路径（包含仓库名子目录）
      const actualPath = await invoke<string>('clone_repo', {
        url: remoteUrl,
        path: basePath,
        token: token || null,
      });

      // 更新 localPath 为实际克隆路径
      form.setFieldValue('localPath', actualPath);
      setLocalPath(actualPath);

      message.success('仓库克隆成功');

      // 检测 git 配置
      const gitInfo = await invoke<GitInfo | null>('detect_git_config', { path: actualPath });

      // 自动填充并保存配置
      const configValues: Config = {
        localPath: actualPath,
        userName: gitInfo?.userName || form.getFieldValue('userName') || '',
        userEmail: gitInfo?.userEmail || form.getFieldValue('userEmail') || '',
        remoteUrl: remoteUrl,
        token: token || undefined,
        gitProvider: (gitInfo?.gitProvider as Config['gitProvider']) || form.getFieldValue('gitProvider') || 'github',
        enableGithubPages: form.getFieldValue('enableGithubPages') || false,
      };

      // 更新表单
      form.setFieldsValue(configValues);

      // 如果用户名和邮箱都有，自动保存配置
      if (configValues.userName && configValues.userEmail) {
        await saveConfig(configValues);
        await initGit(configValues);
        message.success('配置已自动保存，可以开始使用了');
        navigate('/');
      } else {
        message.info('请填写 Git 用户名和邮箱后保存配置');
      }
    } catch (error) {
      message.error(`克隆失败: ${error}`);
    } finally {
      setCloning(false);
    }
  };

  const handleSubmit = async (values: Config) => {
    setLoading(true);
    try {
      // Save config
      await saveConfig(values);

      // Initialize Git
      await initGit(values);

      message.success('配置保存成功');
      setEditMode(false);
    } catch (error) {
      message.error(`保存失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const dataSourceOptions = [
    {
      value: 'clone',
      label: '克隆远程仓库',
      icon: <CloudDownloadOutlined />,
      description: '从 GitHub/GitLab/Gitee 克隆已有仓库',
    },
    {
      value: 'import',
      label: '导入现有项目',
      icon: <ImportOutlined />,
      description: '选择已有的本地 Git 项目，自动读取配置',
    },
  ];

  return (
    <div className="settings-page">
      {!isConfigured && (
        <Alert
          message="欢迎使用 Todo Desktop"
          description="这是您首次使用本应用，请先完成以下配置。配置完成后即可开始使用日历管理您的 Todo。"
          type="info"
          showIcon
          style={{ maxWidth: 800, margin: '0 auto 16px' }}
        />
      )}
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
            />
            设置
          </Space>
        }
        extra={
          isConfigured && !editMode && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setEditMode(true)}
            >
              编辑
            </Button>
          )
        }
        style={{ maxWidth: 800, margin: '0 auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={!editMode}
          initialValues={{
            gitProvider: 'github',
            enableGithubPages: false,
          }}
        >
          {/* Data Source Selection - only show when not configured */}
          {!isConfigured && (
            <Form.Item label="数据来源">
              <Radio.Group
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                style={{ width: '100%' }}
              >
                {dataSourceOptions.map((option) => (
                  <Radio.Button key={option.value} value={option.value} style={{ textAlign: 'center' }}>
                    <Space>
                      {option.icon}
                      {option.label}
                    </Space>
                  </Radio.Button>
                ))}
              </Radio.Group>
              <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                {dataSourceOptions.find((o) => o.value === dataSource)?.description}
              </div>
            </Form.Item>
          )}

          {/* Clone Remote Repo - Show remote URL first */}
          {dataSource === 'clone' && !isConfigured && (
            <>
              <Form.Item
                label="远程仓库地址"
                name="remoteUrl"
                rules={[{ required: true, message: '请输入远程仓库地址' }]}
                tooltip="例如: https://github.com/username/todo-data.git"
              >
                <Input placeholder="https://github.com/username/todo-data.git" />
              </Form.Item>

              <Form.Item
                label="访问令牌 (Token)"
                name="token"
                tooltip="如果系统已配置全局 Git 凭据（如 Git Credential Manager），可留空"
              >
                <Input.Password placeholder="留空则使用系统凭据" />
              </Form.Item>
            </>
          )}

          <Form.Item
            label="本地数据目录"
            name="localPath"
            rules={[{ required: true, message: '请选择数据目录' }]}
            extra={
              dataSource === 'clone'
                ? '仓库将克隆到此目录下的子文件夹'
                : '请选择包含 .git 文件夹的目录'
            }
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="选择本地存储 Todo 数据的目录"
                value={localPath}
                readOnly
              />
              <Button icon={<FolderOpenOutlined />} onClick={handleSelectFolder} loading={detecting}>
                {detecting ? '检测中' : '选择'}
              </Button>
            </Space.Compact>
          </Form.Item>

          {/* Clone Button */}
          {dataSource === 'clone' && !isConfigured && (
            <Form.Item>
              <Button
                type="default"
                icon={<CloudDownloadOutlined />}
                onClick={handleCloneRepo}
                loading={cloning}
                block
              >
                {cloning ? '正在克隆...' : '克隆仓库'}
              </Button>
            </Form.Item>
          )}

          <Form.Item
            label="Git 用户名"
            name="userName"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="你的 Git 用户名" />
          </Form.Item>

          <Form.Item
            label="Git 邮箱"
            name="userEmail"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="your.email@example.com" />
          </Form.Item>

          <Form.Item
            label="Git 托管平台"
            name="gitProvider"
            rules={[{ required: true, message: '请选择平台' }]}
          >
            <Select>
              <Option value="github">GitHub</Option>
              <Option value="gitlab">GitLab</Option>
              <Option value="gitee">Gitee</Option>
            </Select>
          </Form.Item>

          {/* Remote URL for import modes or when configured */}
          {(dataSource !== 'clone' || isConfigured) && (
            <Form.Item
              label="远程仓库地址"
              name="remoteUrl"
              tooltip="例如: https://github.com/username/todo-data.git"
            >
              <Input placeholder="https://github.com/username/todo-data.git (可选)" />
            </Form.Item>
          )}

          {/* Token for import modes or when configured */}
          {(dataSource !== 'clone' || isConfigured) && (
            <Form.Item
              label="访问令牌 (Token)"
              name="token"
              tooltip="如果系统已配置全局 Git 凭据（如 Git Credential Manager），可留空"
            >
              <Input.Password placeholder="留空则使用系统凭据" />
            </Form.Item>
          )}

          <Form.Item
            label="启用 GitHub Pages"
            name="enableGithubPages"
            valuePropName="checked"
            tooltip="将 Todo 自动发布为静态网站"
          >
            <Switch />
          </Form.Item>

          {editMode && (
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} block>
                保存配置
              </Button>
            </Form.Item>
          )}
        </Form>

        <Card type="inner" title="使用提示" style={{ marginTop: 24, background: '#f9f9f9' }}>
          <ul>
            <li>
              <strong>克隆远程仓库</strong>: 输入仓库地址后点击"克隆仓库"按钮，会自动创建子目录并完成配置
            </li>
            <li>
              <strong>导入现有项目</strong>: 选择目录后自动读取 Git 用户名、邮箱等配置
            </li>
          </ul>
        </Card>

        <Card type="inner" title="访问令牌创建指南" style={{ marginTop: 16, background: '#f9f9f9' }}>
          <p style={{ marginBottom: 12, color: '#666' }}>
            如果系统已配置 Git Credential Manager，可留空。否则请按以下步骤创建：
          </p>
          <ul>
            <li>
              <strong>GitHub</strong>:
              <ol>
                <li>访问 Settings → Developer settings → Personal access tokens → Tokens (classic)</li>
                <li>点击 "Generate new token (classic)"</li>
                <li>勾选 <code>repo</code> 权限（完整仓库访问）</li>
                <li>生成后复制令牌（只显示一次）</li>
              </ol>
            </li>
            <li style={{ marginTop: 12 }}>
              <strong>GitLab</strong>:
              <ol>
                <li>访问 Preferences → Access Tokens</li>
                <li>创建 Personal Access Token</li>
                <li>勾选 <code>read_repository</code> 和 <code>write_repository</code> 权限</li>
              </ol>
            </li>
            <li style={{ marginTop: 12 }}>
              <strong>Gitee</strong>:
              <ol>
                <li>访问 设置 → 私人令牌</li>
                <li>生成新令牌</li>
                <li>勾选 <code>projects</code> 权限</li>
              </ol>
            </li>
          </ul>
        </Card>

        <Card type="inner" title="快捷键" style={{ marginTop: 16, background: '#f9f9f9' }}>
          <ul>
            <li>
              <code>Ctrl/Cmd + S</code> - 保存当前 Todo
            </li>
            <li>
              <code>Ctrl/Cmd + ,</code> - 打开设置页面
            </li>
          </ul>
        </Card>
      </Card>
    </div>
  );
}
