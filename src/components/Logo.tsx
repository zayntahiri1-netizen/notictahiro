interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  animated?: boolean;
  darkMode?: boolean;
  className?: string;
}

export default function Logo({ 
  size = 'md', 
  variant = 'full', 
  animated = false,
  darkMode = false,
  className = ''
}: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg', subtext: 'text-[9px]', gap: 'gap-2' },
    md: { icon: 'w-12 h-12', text: 'text-2xl', subtext: 'text-[11px]', gap: 'gap-3' },
    lg: { icon: 'w-16 h-16', text: 'text-3xl', subtext: 'text-sm', gap: 'gap-4' },
    xl: { icon: 'w-24 h-24', text: 'text-5xl', subtext: 'text-lg', gap: 'gap-5' },
  };

  const s = sizes[size];

  const IconLogo = () => (
    <div className={`${s.icon} relative shrink-0 ${animated ? 'group' : ''}`}>
      {/* خلفية متدرجة مع تأثير توهج */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 shadow-lg ${animated ? 'group-hover:shadow-2xl group-hover:shadow-violet-500/50 transition-shadow' : ''}`}>
        {/* تأثير لمعة زجاجية */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/20 to-white/40" />
        {/* تأثير دائرة مضيئة */}
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white/40 blur-sm" />
      </div>
      
      {/* SVG الشعار الرئيسي */}
      <svg 
        className={`relative w-full h-full p-[20%] drop-shadow-lg ${animated ? 'group-hover:rotate-12 transition-transform duration-500' : ''}`}
        viewBox="0 0 100 100" 
        fill="none"
      >
        {/* حرف N بتصميم عصري */}
        <defs>
          <linearGradient id="logoStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#F3E8FF" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        
        {/* الحرف N الأنيق */}
        <path 
          d="M 20 80 L 20 20 L 30 20 L 70 65 L 70 20 L 80 20 L 80 80 L 70 80 L 30 35 L 30 80 Z" 
          fill="url(#logoStroke)"
          stroke="white"
          strokeWidth="1"
        />
        
        {/* نقطة الذكاء الاصطناعي */}
        <circle cx="78" cy="22" r="6" fill="#FCD34D" className={animated ? 'animate-pulse' : ''} />
        <circle cx="78" cy="22" r="3" fill="#FFFFFF" />
      </svg>
    </div>
  );

  const TextLogo = () => (
    <div className="flex flex-col leading-tight">
      <div dir="ltr" className="flex items-baseline gap-1">
        <span 
          className={`${s.text} font-black tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent`}
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Notic
        </span>
        <span 
          className={`${s.text} font-light tracking-wide ${darkMode ? 'text-white/70' : 'text-gray-600'}`}
          style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em' }}
        >
          Tahiro
        </span>
      </div>
      {(size === 'md' || size === 'lg' || size === 'xl') && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`${s.subtext} font-medium tracking-widest uppercase ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>
            AI Productivity Hub
          </span>
          <span className="w-1 h-1 rounded-full bg-violet-500" />
          <span 
            className={`${s.subtext} font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
            style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}
          >
            مساعدك الذكي
          </span>
        </div>
      )}
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={className}>
        <IconLogo />
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={className}>
        <TextLogo />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <IconLogo />
      <TextLogo />
    </div>
  );
}
