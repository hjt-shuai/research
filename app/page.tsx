import Countdown from "@/components/Countdown";
import GoalsDashboard from "@/components/GoalsDashboard";
import PredictionPanel from "@/components/PredictionPanel";
import SubjectScoreCards from "@/components/SubjectScoreCards";
import StudyProgress from "@/components/StudyProgress";
import MasteryOverview from "@/components/MasteryOverview";
import TodayTasks from "@/components/TodayTasks";
import MockSummary from "@/components/MockSummary";
import WeakPointsStrip from "@/components/WeakPointsStrip";
import PhaseCards from "@/components/PhaseCards";
import ScoreAnalysis from "@/components/ScoreAnalysis";
import StudyStreak from "@/components/StudyStreak";
import AiEntryCard from "@/components/AiEntryCard";
import DataBackup from "@/components/DataBackup";
import AppNav from "@/components/AppNav";
import HomeTrend from "@/components/HomeTrend";
import MonthTasks from "@/components/MonthTasks";
import IntelAlerts from "@/components/IntelAlerts";
import SyncCenterCard from "@/components/SyncCenterCard";

// 全站数据都在浏览器 localStorage 里，静态外壳只能是“加载本地数据…”占位，
// 因此这里按 Next 文档显式声明该路由允许在导航时阻塞（不影响预渲染与构建）：
// https://nextjs.org/docs/messages/instant-unrendered-segment
export const instant = false;

export default function Home() {
  return (
    <div className="app">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">考研备考中心</p>
          <h1>电子科技大学 · 计算机技术</h1>
          <p className="hero-sub">085404 计算机技术（全日制专硕）</p>
          <p className="hero-exams">
            101 政治 / 201 英语一 / 301 数学一 / 408 计算机学科专业基础
          </p>
          <p className="hero-calibration">
            当前按最新招生信息备考 · 2028 招生目录公布后自动校准
          </p>
        </div>
        <AppNav />
      </header>

      <main className="main">
        <Countdown />
        <IntelAlerts />
        <SyncCenterCard />
        <GoalsDashboard />
        <PredictionPanel />
        <SubjectScoreCards />
        <StudyProgress />
        <MasteryOverview />
        <TodayTasks />
        <StudyStreak />
        <MockSummary />
        <HomeTrend />
        <ScoreAnalysis />
        <WeakPointsStrip />
        <PhaseCards />
        <MonthTasks />
        <AiEntryCard />
      </main>

      <footer className="footer">
        <p>
          数据仅保存在本机浏览器（localStorage，文件类资料存 IndexedDB），刷新与关闭页面后仍会保留。
        </p>
        <DataBackup />
        <p className="footer-link">
          报考信息以{" "}
          <a href="https://yz.uestc.edu.cn" target="_blank" rel="noopener noreferrer">
            电子科技大学研究生招生网
          </a>{" "}
          为准。本站不编造任何未公布的招生人数、复试线、考试科目与考试日期。
        </p>
      </footer>
    </div>
  );
}
