/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useEffect, useRef, useState} from 'react';
import {ColorTheme, SpeedMode, StyleConfig, UIDetailLevel} from '../types';

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
}) => {
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
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
  }> = ({label, checked, onClick, prefix}) => (
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

  const detailLevels: {value: UIDetailLevel; label: string}[] = [
    {value: 'minimal', label: 'Minimal'},
    {value: 'standard', label: 'Standard'},
    {value: 'rich', label: 'Rich'},
  ];

  const colorThemes: {value: ColorTheme; label: string}[] = [
    {value: 'system', label: 'System'},
    {value: 'light', label: 'Light'},
    {value: 'dark', label: 'Dark'},
    {value: 'colorful', label: 'Colorful'},
  ];

  const speedModes: {value: SpeedMode; label: string}[] = [
    {value: 'fast', label: 'Fast'},
    {value: 'balanced', label: 'Balanced'},
    {value: 'quality', label: 'Quality'},
  ];

  const historyOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="w-[800px] h-[600px] bg-white border border-gray-300 rounded-xl shadow-2xl flex flex-col relative overflow-hidden font-sans backdrop-blur-sm bg-white/80">
      {/* Title Bar */}
      <div className="bg-gray-800/90 text-white py-2 px-4 font-semibold text-base flex justify-between items-center select-none cursor-default rounded-t-xl flex-shrink-0">
        <span className="title-bar-text">{title}</span>
      </div>

      {/* Menu Bar */}
      <div
        ref={menuBarRef}
        className="bg-gray-100/80 py-1.5 px-3 border-b border-gray-200 select-none flex items-center flex-shrink-0 text-sm text-gray-700"
        style={{position: 'relative'}}>
        {/* Gemini Menu */}
        <div style={{position: 'relative'}}>
          <span
            className="cursor-pointer hover:text-blue-600 px-2 py-1 rounded"
            style={openMenu === 'gemini' ? {backgroundColor: '#dbeafe'} : {}}
            onClick={() => toggleMenu('gemini')}
            role="button"
            tabIndex={0}>
            Gemini ▾
          </span>
          {openMenu === 'gemini' && (
            <div style={dropdownStyle}>
              <div style={{...headerStyle, fontSize: '13px', color: '#374151', textTransform: 'none', letterSpacing: 'normal', fontWeight: 700}}>
                Gemini Computer
              </div>
              <div style={{padding: '4px 16px 8px', fontSize: '12px', color: '#6b7280'}}>
                An AI-powered desktop simulation.
              </div>
              <div style={separatorStyle} />
              <div style={{padding: '6px 16px', fontSize: '12px', color: '#9ca3af'}}>
                Version 2.0.0
              </div>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div style={{position: 'relative', marginLeft: '4px'}}>
          <span
            className="cursor-pointer hover:text-blue-600 px-2 py-1 rounded"
            style={openMenu === 'view' ? {backgroundColor: '#dbeafe'} : {}}
            onClick={() => toggleMenu('view')}
            role="button"
            tabIndex={0}>
            View ▾
          </span>
          {openMenu === 'view' && (
            <div style={dropdownStyle}>
              <div style={headerStyle}>Detail Level</div>
              {detailLevels.map((d) => (
                <MenuItemRow
                  key={d.value}
                  label={d.label}
                  checked={styleConfig.detailLevel === d.value}
                  onClick={() => onStyleConfigChange({detailLevel: d.value})}
                />
              ))}
              <div style={separatorStyle} />
              <div style={headerStyle}>Color Theme</div>
              {colorThemes.map((t) => (
                <MenuItemRow
                  key={t.value}
                  label={t.label}
                  checked={styleConfig.colorTheme === t.value}
                  onClick={() => onStyleConfigChange({colorTheme: t.value})}
                />
              ))}
              <div style={separatorStyle} />
              <MenuItemRow
                label="Animations"
                checked={styleConfig.enableAnimations}
                onClick={() => onStyleConfigChange({enableAnimations: !styleConfig.enableAnimations})}
              />
            </div>
          )}
        </div>

        {/* Settings Menu */}
        <div style={{position: 'relative', marginLeft: '4px'}}>
          <span
            className="cursor-pointer hover:text-blue-600 px-2 py-1 rounded"
            style={openMenu === 'settings' ? {backgroundColor: '#dbeafe'} : {}}
            onClick={() => toggleMenu('settings')}
            role="button"
            tabIndex={0}>
            Settings ▾
          </span>
          {openMenu === 'settings' && (
            <div style={dropdownStyle}>
              <div style={headerStyle}>Speed Mode</div>
              {speedModes.map((s) => (
                <MenuItemRow
                  key={s.value}
                  label={s.label}
                  checked={styleConfig.speedMode === s.value}
                  onClick={() => onStyleConfigChange({speedMode: s.value})}
                />
              ))}
              <div style={separatorStyle} />
              <div style={headerStyle}>History Length ({styleConfig.maxHistoryLength})</div>
              <div style={{display: 'flex', flexWrap: 'wrap', padding: '4px 12px', gap: '2px'}}>
                {historyOptions.map((n) => (
                  <span
                    key={n}
                    onClick={() => handleItemClick(() => onStyleConfigChange({maxHistoryLength: n}))}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLSpanElement).style.backgroundColor = '#dbeafe';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLSpanElement).style.backgroundColor =
                        styleConfig.maxHistoryLength === n ? '#bfdbfe' : 'transparent';
                    }}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: styleConfig.maxHistoryLength === n ? 700 : 400,
                      backgroundColor: styleConfig.maxHistoryLength === n ? '#bfdbfe' : 'transparent',
                    }}>
                    {n}
                  </span>
                ))}
              </div>
              <div style={separatorStyle} />
              <MenuItemRow
                label="Statefulness"
                checked={styleConfig.isStatefulnessEnabled}
                onClick={() => onStyleConfigChange({isStatefulnessEnabled: !styleConfig.isStatefulnessEnabled})}
              />
              <div style={separatorStyle} />
              <MenuItemRow
                label="Clear Cache"
                onClick={() => onStyleConfigChange({isStatefulnessEnabled: false})}
                prefix=""
              />
              <MenuItemRow
                label="Open Full Settings..."
                onClick={onOpenSettings}
                prefix=""
              />
            </div>
          )}
        </div>

        {/* Exit button - far right */}
        {isAppOpen && (
          <span
            className="cursor-pointer hover:text-red-600 px-2 py-1 rounded"
            style={{marginLeft: 'auto'}}
            onClick={onExitToDesktop}
            role="button"
            tabIndex={0}>
            ✕ Exit
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto">{children}</div>
    </div>
  );
};
