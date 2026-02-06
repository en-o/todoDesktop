import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Row, Col, Button, Space, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { invoke } from '@tauri-apps/api/tauri';
import './YearView.css';

const { Title } = Typography;

const MONTHS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

export default function YearView() {
  const navigate = useNavigate();
  const { year: yearParam } = useParams();
  const [year, setYear] = useState(yearParam ? parseInt(yearParam) : dayjs().year());
  const [monthsWithTodos, setMonthsWithTodos] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadMonthsWithTodos();
  }, [year]);

  const loadMonthsWithTodos = async () => {
    try {
      const files = await invoke<string[]>('list_files', { dirpath: `${year}` });
      const months = new Set(files.map(f => {
        const match = f.match(/^(\d{2})$/);
        return match ? parseInt(match[1]) : null;
      }).filter(m => m !== null) as number[]);
      setMonthsWithTodos(months);
    } catch (error) {
      console.error('加载月份失败:', error);
    }
  };

  const handleMonthClick = (monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    navigate(`/month/${year}/${monthStr}`);
  };

  const handlePrevYear = () => {
    const newYear = year - 1;
    setYear(newYear);
    navigate(`/year/${newYear}`);
  };

  const handleNextYear = () => {
    const newYear = year + 1;
    setYear(newYear);
    navigate(`/year/${newYear}`);
  };

  const handleToday = () => {
    const today = dayjs();
    setYear(today.year());
    navigate(`/year/${today.year()}`);
  };

  const currentMonth = dayjs().year() === year ? dayjs().month() : -1;

  return (
    <div className="year-view">
      <div className="year-header">
        <Space>
          <Button icon={<LeftOutlined />} onClick={handlePrevYear} />
          <Title level={2} style={{ margin: 0 }}>{year} 年</Title>
          <Button icon={<RightOutlined />} onClick={handleNextYear} />
        </Space>
        <Button type="primary" onClick={handleToday}>
          回到今天
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {MONTHS.map((month, index) => {
          const hasTodos = monthsWithTodos.has(index + 1);
          const isCurrent = index === currentMonth;
          
          return (
            <Col key={index} xs={24} sm={12} md={8} lg={6}>
              <Card
                className={`month-card ${isCurrent ? 'current-month' : ''} ${hasTodos ? 'has-todos' : ''}`}
                hoverable
                onClick={() => handleMonthClick(index)}
              >
                <div className="month-content">
                  <div className="month-name">{month}</div>
                  <div className="month-number">{index + 1}</div>
                  {hasTodos && <div className="todo-indicator">•</div>}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
