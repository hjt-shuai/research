import ResourceCenter from "@/components/library/ResourceCenter";
import AppNav from "@/components/AppNav";

export const instant = false;

export default function ResourcesPage() {
  return (
    <div className="app">
      <header className="hero" style={{ marginBottom: 8 }}>
        <AppNav />
      </header>
      <ResourceCenter />
    </div>
  );
}
