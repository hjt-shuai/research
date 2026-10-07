import UpdateCenter from "@/components/updates/UpdateCenter";
import AppNav from "@/components/AppNav";

export const instant = false;

export default function UpdatesPage() {
  return (
    <div className="app">
      <header className="hero" style={{ marginBottom: 8 }}>
        <AppNav />
      </header>
      <UpdateCenter />
    </div>
  );
}
