import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Space, Typography, Calendar, Badge } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { invoke } from '@tauri-apps/api/tauri';
import './MonthView.css';

const { Title } = Typography;

export default function MonthView() {
  const navigate = useNavigate();
  const { year, month } = useParams();
  const [currentDate, setCurrentDate] = useState(dayjs(`${year}-${month}-01`));
  const [daysWithTodos, setDaysWithTodos] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadDaysWithTodos();
  }, [year, month]);

  const loadDaysWithTodos = async () => {
    try {
      const dirpath = `${year}/${month}`;
      const files = await invoke<string[]>('list_files', { dirpath });
      const days = new Set(files.map(f => {
        const match = f.match(/^(\d{2})\.md$/);
        return match ? parseInt(match[1]) : null;
      }).filter(d => d !== null) as number[]);
      setDaysWithTodos(days);
    } catch (error) {
      console.error('加载日期失败:', error);
    }
  };

  const handlePrevMonth = () => {
    const prev = currentDate.subtract(1, 'month');
    setCurrentDate(prev);
    navigate(`/month/${prev.year()}/${prev.format('MM')}`);
  };

  const handleNextMonth = () => {
    const next = currentDate.add(1, 'month');
    setCurrentDate(next);
    navigate(`/month/${next.year()}/${next.format('MM')}`);
  };

  const handleBackToYear = () => {
    navigate(`/year/${year}`);
  };

  const handleDateSelect = (date: Dayjs) => {
    navigate(`/day/${date.year()}/${date.format('MM')}/${date.format('DD')}`);
  };

  const cellRender = (date: Dayjs, info: { type: string; originNode: React.ReactNode }) => {
    if (info.type !== 'date') {
      return info.originNode;
    }

    // 只显示当前月份的 todo 标记
    if (date.month() + 1 !== parseInt(month || '0')) {
      return info.originNode;
    }

    const day = date.date();
    const hasTodo = daysWithTodos.has(day);

    if (hasTodo) {
      return (
        <div className="date-cell-wrapper">
          {info.originNode}
          <div className="date-cell-content">
            <Badge status="success" />
          </div>
        </div>
      );
    }
    return info.originNode;
  };

  return (
    <div className="month-view">
      <div className="month-header">
        <Space>
          <Button onClick={handleBackToYear}>返回年视图</Button>
          <Button icon={<LeftOutlined />} onClick={handlePrevMonth} />
          <Title level={2} style={{ margin: 0 }}>
            {currentDate.year()} 年 {currentDate.month() + 1} 月
          </Title>
          <Button icon={<RightOutlined />} onClick={handleNextMonth} />
        </Space>
      </div>

      <Calendar
        value={currentDate}
        onSelect={handleDateSelect}
        cellRender={cellRender}
        fullscreen={false}
      />
    </div>
  );
}
