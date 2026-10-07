import SchoolIntel from "@/components/school/SchoolIntel";
import AppNav from "@/components/AppNav";

// 院校情报页：数据全部来自浏览器 localStorage（组件内通过 AppStoreProvider 读取）。
// cacheComponents 下静态外壳只能是占位，这里显式声明允许阻塞式导航（不影响预渲染）。
export const instant = false;

export default function SchoolsPage() {
  return (
    <div className="app">
      <header className="hero" style={{ marginBottom: 8 }}>
        <AppNav />
      </header>
      <SchoolIntel />
    </div>
  );
}
