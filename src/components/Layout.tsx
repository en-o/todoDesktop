import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Button, Space, message, Alert } from 'antd';
import { SettingOutlined, SyncOutlined, HomeOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import { useState, useEffect } from 'react';
import { useConfigStore } from '../store/configStore';
import './Layout.css';

const { Header, Content } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);
  const { isConfigured, config } = useConfigStore();

  const handleSync = async () => {
    if (!isConfigured || !config?.remoteUrl) {
      message.warning('请先在设置中配置远程仓库');
      return;
    }

    setSyncing(true);
    try {
      await invoke('git_pull');
      message.success('拉取成功');
      await invoke('git_push');
      message.success('同步成功');
    } catch (error) {
      message.error(`同步失败: ${error}`);
    } finally {
      setSyncing(false);
    }
  };

  const showConfigAlert = !isConfigured && location.pathname !== '/settings';

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Todo Desktop</h1>
          <Space>
            <Button
              type="text"
              icon={<HomeOutlined />}
              onClick={() => navigate('/year')}
            >
              首页
            </Button>
            <Button
              type="text"
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSync}
              loading={syncing}
              disabled={!isConfigured || !config?.remoteUrl}
            >
              同步
            </Button>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
            >
              设置
            </Button>
          </Space>
        </div>
      </Header>
      <Content className="app-content">
        {showConfigAlert && (
          <Alert
            message="首次使用提示"
            description={
              <span>
                请先前往 <a onClick={() => navigate('/settings')}>设置页面</a> 配置本地数据目录和 Git 信息
              </span>
            }
            type="info"
            showIcon
            closable
            style={{ marginBottom: 16, maxWidth: 1400, marginLeft: 'auto', marginRight: 'auto' }}
          />
        )}
        <div className="content-wrapper">
          <Outlet />
        </div>
      </Content>
    </AntLayout>
  );
}
