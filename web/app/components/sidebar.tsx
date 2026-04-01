"use client";

type Tab = "search" | "plans";

interface SidebarProps {
  searchContent: React.ReactNode;
  plansContent: React.ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Sidebar({
  searchContent,
  plansContent,
  activeTab,
  onTabChange,
}: SidebarProps) {
  return (
    <aside className="flex w-full flex-col overflow-hidden bg-gray-50 md:w-[360px] md:min-w-[360px]">
      <div className="flex border-b border-gray-100 bg-white">
        <TabButton
          active={activeTab === "search"}
          onClick={() => onTabChange("search")}
        >
          검색
        </TabButton>
        <TabButton
          active={activeTab === "plans"}
          onClick={() => onTabChange("plans")}
        >
          여행 계획
        </TabButton>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "search" ? searchContent : plansContent}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 py-2.5 text-center text-[13px] font-medium ${
        active
          ? "border-blue-500 text-blue-500"
          : "border-transparent text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}
