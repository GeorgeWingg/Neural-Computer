/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, { useEffect, useRef, useState } from 'react';
import { ColorTheme, SpeedMode, StyleConfig, UIDetailLevel } from '../types';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isAppOpen: boolean;
  appId?: string | null;
  styleConfig: StyleConfig;
  onStyleConfigChange: (updates: Partial<StyleConfig>) => void;
  onOpenSettings: () => void;
  onExitToDesktop: () => void;
  onGlobalPrompt?: (prompt: string) => void;
}

type MenuName = 'gemini' | 'view' | 'settings' | null;

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  minWidth: '200px',
  zIndex: 100,
  padding: '4px 0',
  marginTop: '2px',
};

const menuItemStyle: React.CSSProperties = {
  padding: '6px 16px',
  cursor: 'pointer',
  fontSize: '13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  whiteSpace: 'nowrap',
};

const separatorStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: '#e5e7eb',
  margin: '4px 0',
};

const headerStyle: React.CSSProperties = {
  padding: '8px 16px 4px',
  fontSize: '11px',
  color: '#9ca3af',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  onClose,
  isAppOpen,
  styleConfig,
  onStyleConfigChange,
  onOpenSettings,
  onExitToDesktop,
  onGlobalPrompt,
}) => {
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
  const [searchValue, setSearchValue] = useState('');
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim() && onGlobalPrompt) {
      onGlobalPrompt(searchValue.trim());
      setSearchValue('');
    }
  };

  const toggleMenu = (menu: MenuName) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const handleItemClick = (action: () => void) => {
    action();
    setOpenMenu(null);
  };

  const MenuItemRow: React.FC<{
    label: string;
    checked?: boolean;
    onClick: () => void;
    prefix?: string;
  }> = ({ label, checked, onClick, prefix }) => (
    <div
      style={menuItemStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#dbeafe';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
      }}
      onClick={() => handleItemClick(onClick)}>
      <span>
        {prefix !== undefined ? prefix : checked !== undefined ? (checked ? '✓ ' : '   ') : ''}
        {label}
      </span>
    </div>
  );

  const detailLevels: { value: UIDetailLevel; label: string }[] = [
    { value: 'minimal', label: 'Minimal' },
    { value: 'standard', label: 'Standard' },
    { value: 'rich', label: 'Rich' },
  ];

  const colorThemes: { value: ColorTheme; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'colorful', label: 'Colorful' },
  ];

  const speedModes: { value: SpeedMode; label: string }[] = [
    { value: 'fast', label: 'Fast' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'quality', label: 'Quality' },
  ];

  const historyOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="w-full h-full bg-black flex flex-col relative overflow-hidden font-sans">
      {/* Title Bar */}
      <div className="bg-[#0a0a0a] text-[#60a5fa] py-1.5 px-4 font-bold text-sm flex justify-between items-center select-none cursor-default flex-shrink-0 border-b border-[#3b82f6]/30">
        <div className="flex items-center gap-3">
          <span className="text-blue-400 text-[11px] tracking-wider">GM</span>
          <span className="tracking-widest uppercase text-xs opacity-80">{title}</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-[10px] tracking-[0.2em] uppercase opacity-40 font-light hidden md:block">
            Gemini Operating System
          </div>

          {isAppOpen && (
            <button
              onClick={onExitToDesktop}
              className="bg-blue-900/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-900/50 rounded-sm px-2 py-0.5 text-[10px] transition-all flex items-center gap-1 group"
              title="Exit to Desktop"
            >
              <span className="font-bold">✕</span>
              <span className="hidden group-hover:inline opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* Menu Bar */}
      <div
        ref={menuBarRef}
        className="bg-[#111111] py-1 px-3 border-b border-[#333] select-none flex items-center flex-shrink-0 text-sm text-gray-400"
        style={{ position: 'relative' }}>
        {/* Gemini Menu */}
        <div style={{ position: 'relative' }}>
          <span
            className="cursor-pointer hover:text-white px-2 py-1 rounded transition-colors"
            style={openMenu === 'gemini' ? { backgroundColor: '#222', color: 'white' } : {}}
            onClick={() => toggleMenu('gemini')}
            role="button"
            tabIndex={0}>
            System ▾
          </span>
          {openMenu === 'gemini' && (
            <div style={{ ...dropdownStyle, backgroundColor: '#1a1a1a', borderColor: '#333', color: '#ccc' }}>
              <div style={{ ...headerStyle, fontSize: '13px', color: '#60a5fa', textTransform: 'none', letterSpacing: 'normal', fontWeight: 700 }}>
                Gemini Computer
              </div>
              <div style={{ padding: '4px 16px 8px', fontSize: '12px', color: '#888' }}>
                AI-powered desktop environment.
              </div>
              <div style={{ ...separatorStyle, backgroundColor: '#333' }} />
              <div style={{ padding: '6px 16px', fontSize: '12px', color: '#555' }}>
                Version 3.0.0-PRO
              </div>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div style={{ position: 'relative', marginLeft: '4px' }}>
          <span
            className="cursor-pointer hover:text-white px-2 py-1 rounded transition-colors"
            style={openMenu === 'view' ? { backgroundColor: '#222', color: 'white' } : {}}
            onClick={() => toggleMenu('view')}
            role="button"
            tabIndex={0}>
            View ▾
          </span>
          {openMenu === 'view' && (
            <div style={{ ...dropdownStyle, backgroundColor: '#1a1a1a', borderColor: '#333', color: '#ccc', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <div style={{ ...headerStyle, color: '#3b82f6' }}>Detail Level</div>
              {detailLevels.map((d) => (
                <div
                  key={d.value}
                  className="px-4 py-1.5 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors"
                  onClick={() => handleItemClick(() => onStyleConfigChange({ detailLevel: d.value }))}
                >
                  {styleConfig.detailLevel === d.value ? '● ' : '○ '} {d.label}
                </div>
              ))}
              <div style={{ ...separatorStyle, backgroundColor: '#333' }} />
              <div style={{ ...headerStyle, color: '#3b82f6' }}>Color Theme</div>
              {colorThemes.map((t) => (
                <div
                  key={t.value}
                  className="px-4 py-1.5 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors"
                  onClick={() => handleItemClick(() => onStyleConfigChange({ colorTheme: t.value }))}
                >
                  {styleConfig.colorTheme === t.value ? '● ' : '○ '} {t.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings Menu */}
        <div style={{ position: 'relative', marginLeft: '4px' }}>
          <span
            className="cursor-pointer hover:text-white px-2 py-1 rounded transition-colors"
            style={openMenu === 'settings' ? { backgroundColor: '#222', color: 'white' } : {}}
            onClick={() => toggleMenu('settings')}
            role="button"
            tabIndex={0}>
            Settings ▾
          </span>
          {openMenu === 'settings' && (
            <div style={{ ...dropdownStyle, backgroundColor: '#1a1a1a', borderColor: '#333', color: '#ccc', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <div style={{ ...headerStyle, color: '#3b82f6' }}>Speed Mode</div>
              {speedModes.map((s) => (
                <div
                  key={s.value}
                  className="px-4 py-1.5 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors"
                  onClick={() => handleItemClick(() => onStyleConfigChange({ speedMode: s.value }))}
                >
                  {styleConfig.speedMode === s.value ? '● ' : '○ '} {s.label}
                </div>
              ))}
              <div style={{ ...separatorStyle, backgroundColor: '#333' }} />
              <div style={{ ...headerStyle, color: '#3b82f6' }}>History ({styleConfig.maxHistoryLength})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', padding: '4px 12px', gap: '4px' }}>
                {historyOptions.map((n) => (
                  <span
                    key={n}
                    onClick={() => handleItemClick(() => onStyleConfigChange({ maxHistoryLength: n }))}
                    className={`px-1.5 py-0.5 rounded cursor-pointer text-[10px] transition-colors ${styleConfig.maxHistoryLength === n ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-500'}`}
                  >
                    {n}
                  </span>
                ))}
              </div>
              <div style={{ ...separatorStyle, backgroundColor: '#333' }} />
              <div
                className="px-4 py-1.5 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors flex items-center justify-between"
                onClick={() => handleItemClick(() => onStyleConfigChange({ isStatefulnessEnabled: !styleConfig.isStatefulnessEnabled }))}
              >
                <span>Statefulness</span>
                <span>{styleConfig.isStatefulnessEnabled ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ ...separatorStyle, backgroundColor: '#333' }} />
              <div
                className="px-4 py-1.5 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors text-blue-400 font-bold"
                onClick={onOpenSettings}
              >
                PRO Settings...
              </div>
            </div>
          )}
        </div>

        {/* Search / Global Prompt */}
        <form
          onSubmit={handleSearchSubmit}
          className="ml-6 flex-grow max-w-md relative"
        >
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Command the system or search..."
            className="w-full bg-[#050505] border border-[#333] rounded-full px-4 py-1 text-xs text-gray-300 focus:outline-none focus:border-[#3b82f6] transition-all placeholder:text-gray-700"
          />
          <button type="submit" className="hidden" />
        </form>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto bg-black">{children}</div>
    </div>
  );
};
