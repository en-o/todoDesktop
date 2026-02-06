import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Button, Space, message } from 'antd';
import { SettingOutlined, SyncOutlined, HomeOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import { useState } from 'react';
import './Layout.css';

const { Header, Content } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // 先拉取
      await invoke('git_pull');
      message.success('拉取成功');
      
      // 再推送
      await invoke('git_push');
      message.success('同步成功');
    } catch (error) {
      message.error(`同步失败: ${error}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header className="app-header">
        <div className="header-content">
          <h1 className="app-title">📅 Todo Desktop</h1>
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
        <div className="content-wrapper">
          <Outlet />
        </div>
      </Content>
    </AntLayout>
  );
}
