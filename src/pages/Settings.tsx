import { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Switch, Card, message, Space, Alert } from 'antd';
import { FolderOpenOutlined, SaveOutlined } from '@ant-design/icons';
import { useConfigStore, Config } from '../store/configStore';
import { open } from '@tauri-apps/api/dialog';
import './Settings.css';

const { Option } = Select;

export default function Settings() {
  const { config, saveConfig, initGit, isConfigured } = useConfigStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config);
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
      }
    } catch (error) {
      message.error('选择目录失败');
    }
  };

  const handleSubmit = async (values: Config) => {
    setLoading(true);
    try {
      // 保存配置
      await saveConfig(values);
      
      // 初始化 Git
      await initGit(values);
      
      message.success('配置保存成功');
    } catch (error) {
      message.error(`保存失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

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
      <Card title="设置" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            gitProvider: 'github',
            enableGithubPages: false,
          }}
        >
          <Form.Item
            label="本地数据目录"
            name="localPath"
            rules={[{ required: true, message: '请选择数据目录' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="选择本地存储 Todo 数据的目录" />
              <Button icon={<FolderOpenOutlined />} onClick={handleSelectFolder}>
                选择
              </Button>
            </Space.Compact>
          </Form.Item>

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

          <Form.Item
            label="远程仓库地址"
            name="remoteUrl"
            tooltip="例如: https://github.com/username/todo-data.git"
          >
            <Input placeholder="https://github.com/username/todo-data.git" />
          </Form.Item>

          <Form.Item
            label="访问令牌 (Token)"
            name="token"
            tooltip="用于推送和拉取远程仓库的访问令牌"
          >
            <Input.Password placeholder="ghp_xxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            label="启用 GitHub Pages"
            name="enableGithubPages"
            valuePropName="checked"
            tooltip="将 Todo 自动发布为静态网站"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} block>
              保存配置
            </Button>
          </Form.Item>
        </Form>

        <Card
          type="inner"
          title="使用提示"
          style={{ marginTop: 24, background: '#f9f9f9' }}
        >
          <ul>
            <li>
              <strong>访问令牌</strong>: 在 GitHub/GitLab/Gitee 的设置中生成个人访问令牌
            </li>
            <li>
              <strong>GitHub</strong>: Settings → Developer settings → Personal access tokens
            </li>
            <li>
              <strong>权限</strong>: 需要 repo 权限（读写仓库）
            </li>
            <li>
              <strong>GitHub Pages</strong>: 仓库需要开启 Pages 功能，从 main 分支发布
            </li>
          </ul>
        </Card>

        <Card
          type="inner"
          title="快捷键"
          style={{ marginTop: 16, background: '#f9f9f9' }}
        >
          <ul>
            <li><code>Ctrl/Cmd + S</code> - 保存当前 Todo</li>
            <li><code>Ctrl/Cmd + ,</code> - 打开设置页面</li>
          </ul>
        </Card>
      </Card>
    </div>
  );
}
