"use client";

import { useAuth } from "@/app/providers/auth-provider";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-3 py-2 md:flex-nowrap md:gap-3 md:px-5 md:py-3">
      <h1 className="hidden text-[17px] font-bold text-gray-900 md:block">
        Travel Map
      </h1>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="장소 검색 (벡터 시맨틱 검색)"
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
      {user && (
        <>
          <span className="whitespace-nowrap text-xs text-gray-500">
            <strong className="text-gray-900">{user.nickname}</strong>
          </span>
          <button
            onClick={logout}
            className="whitespace-nowrap rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs hover:border-blue-400 hover:bg-blue-50"
          >
            로그아웃
          </button>
        </>
      )}
    </header>
  );
}
