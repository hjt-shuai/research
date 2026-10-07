import QuestionBank from "@/components/questions/QuestionBank";
import AppNav from "@/components/AppNav";

// 数据来自浏览器 localStorage，静态外壳为空占位；显式声明允许阻塞式导航
// （仅关闭 dev 期的 instant navigation 校验，不影响预渲染与构建）
export const instant = false;

export default function QuestionsPage() {
  return (
    <div className="app">
      <header className="hero" style={{ marginBottom: 8 }}>
        <AppNav />
      </header>
      <QuestionBank />
    </div>
  );
}
