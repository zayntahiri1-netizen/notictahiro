import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppLanguage, languageNames } from '../i18n';

interface LanguageSelectorProps {
  placement?: 'mini' | 'compact' | 'wide' | 'floating' | 'profile';
  label?: boolean;
  className?: string;
}

const languages = Object.keys(languageNames) as AppLanguage[];

export default function LanguageSelector({ placement = 'compact', label = true, className = '' }: LanguageSelectorProps) {
  const { language, setLanguage, darkMode, t, direction } = useApp();
  const [open, setOpen] = useState(false);
  const active = languageNames[language];

  const wide = placement === 'wide' || placement === 'profile';
  const mini = placement === 'mini';

  return (
    <div className={`relative ${className}`} dir={direction}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`group flex items-center justify-between border transition-all hover:scale-[1.02] active:scale-95 ${
          mini
            ? darkMode ? 'gap-1.5 px-2 py-1.5 rounded-full bg-gray-800/80 border-gray-700 hover:bg-gray-700 text-white shadow-sm' : 'gap-1.5 px-2 py-1.5 rounded-full bg-white/90 border-gray-200 hover:bg-white text-gray-900 shadow-sm'
            : placement === 'floating'
            ? 'px-4 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-lg border-white/50 dark:border-white/10'
            : wide
              ? darkMode ? 'w-full px-4 py-3 bg-gray-800 border-gray-700 hover:bg-gray-700' : 'w-full px-4 py-3 bg-white border-gray-200 hover:bg-gray-50 shadow-sm'
              : darkMode ? 'px-3 py-2 bg-gray-800 border-gray-700 hover:bg-gray-700' : 'px-3 py-2 bg-gray-50 border-gray-200 hover:bg-white shadow-sm'
        }`}
        title={t('language')}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={mini ? 'text-sm' : 'text-lg'}>{active.flag}</span>
          {label && (
            <div className="min-w-0 text-start">
              <div className={`${mini ? 'text-[10px]' : 'text-xs'} font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {wide ? active.native : language.toUpperCase()}
              </div>
              {wide && (
                <div className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('language')}
                </div>
              )}
            </div>
          )}
        </div>
        <svg className={`${mini ? 'w-3 h-3' : 'w-4 h-4'} transition-transform ${open ? 'rotate-180' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <button className="fixed inset-0 pb-banner z-[70] cursor-default" onClick={() => setOpen(false)} />
          <div className={`absolute z-[80] mt-2 min-w-48 overflow-hidden rounded-2xl border shadow-2xl ${
            direction === 'rtl' ? 'right-0' : 'left-0'
          } ${darkMode ? 'bg-gray-900/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-900'} backdrop-blur-xl animate-scale-in`}>
            <div className={`px-3 py-2 text-[11px] font-bold tracking-wide ${darkMode ? 'text-gray-400 border-gray-800' : 'text-gray-500 border-gray-100'} border-b`}>
              🌐 {t('language')}
            </div>
            <div className="p-1.5 space-y-1">
              {languages.map(lang => {
                const info = languageNames[lang];
                const selected = lang === language;
                return (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start transition-all ${
                      selected
                        ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/20'
                        : darkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="text-xl">{info.flag}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{info.native}</div>
                      <div className={`text-[10px] ${selected ? 'text-white/70' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {info.english}
                      </div>
                    </div>
                    {selected && <span className="text-sm">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}