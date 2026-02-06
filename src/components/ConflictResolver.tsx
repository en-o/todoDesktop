import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Typography, Space, message } from 'antd';
import { invoke } from '@tauri-apps/api/tauri';
import './ConflictResolver.css';

const { Text, Title } = Typography;

interface ConflictResolverProps {
  visible: boolean;
  conflictFiles: string[];
  onResolved: () => void;
  onCancel: () => void;
}

interface FileVersions {
  local: string;
  remote: string;
  working: string;
}

export default function ConflictResolver({
  visible,
  conflictFiles,
  onResolved,
  onCancel,
}: ConflictResolverProps) {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [versions, setVersions] = useState<FileVersions | null>(null);
  const [mergedContent, setMergedContent] = useState('');
  const [loading, setLoading] = useState(false);

  const currentFile = conflictFiles[currentFileIndex];

  useEffect(() => {
    if (visible && currentFile) {
      loadVersions(currentFile);
    }
  }, [visible, currentFile]);

  const loadVersions = async (filepath: string) => {
    setLoading(true);
    try {
      const [local, remote, working] = await invoke<[string, string, string]>(
        'get_conflict_versions',
        { filepath }
      );
      setVersions({ local, remote, working });
      // 默认使用本地版本作为合并结果
      setMergedContent(local);
    } catch (error) {
      message.error(`加载文件版本失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUseLocal = useCallback(() => {
    if (versions) {
      setMergedContent(versions.local);
    }
  }, [versions]);

  const handleUseRemote = useCallback(() => {
    if (versions) {
      setMergedContent(versions.remote);
    }
  }, [versions]);

  const handleResolve = async () => {
    if (!currentFile || !mergedContent) return;

    setLoading(true);
    try {
      await invoke('resolve_conflict', {
        filepath: currentFile,
        content: mergedContent,
      });

      if (currentFileIndex < conflictFiles.length - 1) {
        // 还有更多冲突文件
        setCurrentFileIndex(currentFileIndex + 1);
        message.success(`已解决 ${currentFile}，还剩 ${conflictFiles.length - currentFileIndex - 1} 个文件`);
      } else {
        // 所有冲突已解决，完成合并
        await invoke('complete_merge', { message: '解决合并冲突' });
        message.success('所有冲突已解决');
        onResolved();
      }
    } catch (error) {
      message.error(`解决冲突失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const renderDiff = (content: string, label: string, type: 'local' | 'remote') => {
    const lines = content.split('\n');
    return (
      <div className={`diff-panel ${type}`}>
        <div className="diff-header">
          <Text strong>{label}</Text>
          <Button
            size="small"
            type="link"
            onClick={type === 'local' ? handleUseLocal : handleUseRemote}
          >
            使用此版本
          </Button>
        </div>
        <div className="diff-content">
          <pre>
            {lines.map((line, index) => (
              <div key={index} className="diff-line">
                <span className="line-number">{index + 1}</span>
                <span className="line-content">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <span>解决冲突</span>
          <Text type="secondary">
            ({currentFileIndex + 1} / {conflictFiles.length})
          </Text>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width="95vw"
      style={{ top: 20 }}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="resolve"
          type="primary"
          loading={loading}
          onClick={handleResolve}
        >
          {currentFileIndex < conflictFiles.length - 1 ? '解决并继续' : '完成合并'}
        </Button>,
      ]}
    >
      <div className="conflict-resolver">
        <div className="file-info">
          <Title level={5}>{currentFile}</Title>
        </div>

        {versions && (
          <div className="diff-container">
            {/* 左侧：远程版本 */}
            {renderDiff(versions.remote, '远程 (线上)', 'remote')}

            {/* 中间：合并结果 */}
            <div className="diff-panel merged">
              <div className="diff-header">
                <Text strong>合并结果</Text>
              </div>
              <div className="diff-content">
                <textarea
                  value={mergedContent}
                  onChange={(e) => setMergedContent(e.target.value)}
                  placeholder="在此编辑合并后的内容..."
                />
              </div>
            </div>

            {/* 右侧：本地版本 */}
            {renderDiff(versions.local, '本地 (当前)', 'local')}
          </div>
        )}
      </div>
    </Modal>
  );
}
