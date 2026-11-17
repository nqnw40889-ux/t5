import React from 'react';
import { ArrowDown, ArrowUpRight, SlidersHorizontal, Activity, ScanSearch } from 'lucide-react';
import cncHero from '../assets/cnc-hero.webp';
import { Machine3DViewer } from '../components/Machine3DViewer';
import './HomePage.css';

interface HomePageProps {
  onNavigate: (tab: 'home' | 'predict' | 'test') => void;
  onTrySample: () => void;
  onTryWarning: () => void;
  onOpenTest: (section: 'validation' | 'missed') => void;
}

const steps = [
  { Icon: SlidersHorizontal, title: 'Nhập thông số', description: 'Điền sáu thông số vận hành hoặc tải một tệp CSV để dự đoán nhiều máy.' },
  { Icon: Activity, title: 'Đọc kết quả', description: 'Xem điểm LightGBM và trạng thái của mẫu theo ngưỡng quyết định đã lưu.' },
  { Icon: ScanSearch, title: 'Xem yếu tố ảnh hưởng', description: 'Dùng TreeSHAP để xem thông số nào làm điểm tăng hoặc giảm và đối chiếu dải huấn luyện.' },
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onTrySample, onTryWarning, onOpenTest }) => {
  const examples = [
    { label: 'Thử một ca cảnh báo', detail: 'Điền sẵn thông số vào trang Dự đoán', action: onTryWarning },
    { label: 'Vì sao chọn ngưỡng đã lưu?', detail: 'Xem Precision, Recall và F1 trên Validation', action: () => onOpenTest('validation') },
    { label: 'Mô hình đã bỏ sót những ca nào?', detail: 'Mở các ca bỏ sót trên tập Test', action: () => onOpenTest('missed') },
  ];

  return (
    <>
      <section className="ai4i-hero" aria-labelledby="home-title" data-enter>
        <div className="wrap ai4i-wrap ai4i-hero-grid">
          <div className="ai4i-hero-copy">
            <p className="ai4i-project">AI4I 2020 <span aria-hidden="true">/</span> Nhóm 16</p>
            <h1 id="home-title">Dự đoán hỏng hóc máy phục vụ bảo trì dự đoán <span>trên dữ liệu cảm biến mất cân bằng</span></h1>
            <p className="ai4i-intro">Nhập thông số vận hành để xem điểm LightGBM, cảnh báo hỏng thiết bị và các yếu tố ảnh hưởng đến dự đoán.</p>
            <div className="ai4i-actions">
              <button type="button" className="ai4i-button ai4i-button-primary" onClick={() => onNavigate('predict')}>
                Nhập thông số máy <ArrowUpRight size={17} aria-hidden="true" />
              </button>
              <button type="button" className="ai4i-button" onClick={onTrySample}>Thử mẫu có sẵn</button>
            </div>
          </div>

          <figure className="ai4i-machine" aria-label="Máy phay CNC tương tác">
            <Machine3DViewer
              heroPoster={cncHero}
              autoRotate
              exploreParts
              height="ai4i-machine-canvas"
              caption="Mô hình thiết bị minh họa"
            />
          </figure>
          <a className="ai4i-down" href="#kham-pha" aria-label="Tới phần khám phá kết quả"><ArrowDown size={18} aria-hidden="true" /></a>
        </div>
      </section>

      <section id="kham-pha" aria-labelledby="explore-title" className="ai4i-explore">
        <div className="wrap ai4i-wrap ai4i-explore-grid">
          <div>
            <h2 id="explore-title">Khám phá kết quả</h2>
            <p>Thử một ca dự đoán, xem cách chọn ngưỡng hoặc tìm hiểu những trường hợp mô hình bỏ sót.</p>
          </div>
          <div className="ai4i-examples">
            {examples.map(({ label, detail, action }) => (
              <button key={label} type="button" onClick={action} className="ai4i-example">
                <span><strong>{label}</strong><small>{detail}</small></span>
                <ArrowUpRight size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="nguyen-ly" className="ai4i-workflow" aria-labelledby="method-title">
        <div className="wrap ai4i-wrap">
          <div className="ai4i-workflow-heading">
            <h2 id="method-title">Từ thông số đến cảnh báo</h2>
            <button type="button" className="ai4i-button" onClick={() => onNavigate('test')}>
              Xem kết quả kiểm thử <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </div>
          <ol className="ai4i-steps">
            {steps.map(({ Icon, title, description }) => (
              <li key={title}>
                <Icon size={24} strokeWidth={1.65} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
};
