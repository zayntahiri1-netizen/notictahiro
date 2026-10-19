import { useState, useEffect } from 'react';
import Logo from './Logo';
import LanguageSelector from './LanguageSelector';
import { useApp } from '../context/AppContext';

interface WelcomeSplashProps {
  onComplete: () => void;
}

export default function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const { t, language } = useApp();
  const [stage, setStage] = useState<'logo' | 'features' | 'exit'>('logo');

  useEffect(() => {
    const timer1 = setTimeout(() => setStage('features'), 1800);
    const timer2 = setTimeout(() => setStage('exit'), 3800);
    const timer3 = setTimeout(() => onComplete(), 4300);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, [onComplete]);

  const WS = {
    ar: { aiSmart: 'AI ذكي', superProd: 'إنتاجية فائقة', experience: 'تجربة شاملة من', smartFeatures: 'الميزات الذكية', loading: 'جاري التحميل' },
    en: { aiSmart: 'Smart AI', superProd: 'Super productivity', experience: 'A complete experience of', smartFeatures: 'smart features', loading: 'Loading' },
    es: { aiSmart: 'IA inteligente', superProd: 'Súper productividad', experience: 'Una experiencia completa de', smartFeatures: 'funciones inteligentes', loading: 'Cargando' },
    zh: { aiSmart: '智能 AI', superProd: '超高生产力', experience: '完整体验', smartFeatures: '智能功能', loading: '加载中' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? { aiSmart: 'Smart AI', superProd: 'Super productivity', experience: 'A complete experience of', smartFeatures: 'smart features', loading: 'Loading' };

  const features = [
    { icon: '🧠', label: WS.aiSmart, color: 'from-violet-500 to-purple-500' },
    { icon: '💬', label: t('askNotebook'), color: 'from-blue-500 to-indigo-500' },
    { icon: '⏰', label: t('activeAlarms'), color: 'from-amber-500 to-orange-500' },
    { icon: '💳', label: t('finance'), color: 'from-emerald-500 to-teal-500' },
    { icon: '🕸️', label: t('mindMap'), color: 'from-pink-500 to-rose-500' },
    { icon: '⚡', label: WS.superProd, color: 'from-yellow-500 to-amber-500' },
  ];

  return (
    <div className={`fixed inset-0 pb-banner z-[200] flex items-center justify-center transition-opacity duration-500 ${
      stage === 'exit' ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* خلفية متحركة */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-violet-950 to-purple-950" />
      
      {/* جزيئات متحركة في الخلفية */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-40"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              background: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'][Math.floor(Math.random() * 5)],
              animation: `float ${Math.random() * 10 + 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
              boxShadow: `0 0 ${Math.random() * 20 + 10}px currentColor`,
            }}
          />
        ))}
      </div>

      {/* دوائر مضيئة في الخلفية */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-500/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-pink-500/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[150px]" />

      {/* المحتوى الرئيسي */}
      <div className="relative z-10 text-center space-y-8 px-6">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2">
          <LanguageSelector placement="floating" />
        </div>
        {/* مرحلة الشعار */}
        {stage === 'logo' && (
          <div className="animate-scale-in">
            {/* الشعار الضخم */}
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-pink-500 rounded-3xl blur-2xl opacity-60 animate-pulse" />
              <Logo size="xl" variant="icon" animated darkMode />
            </div>

            {/* الاسم بشكل سينمائي */}
            <div className="space-y-2">
              <h1 className="text-7xl md:text-8xl font-black tracking-tight leading-none">
                <span className="inline-block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
                  Notic
                </span>
                <span 
                  className="inline-block mr-3 font-thin tracking-widest text-white/80"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Tahiro
                </span>
              </h1>
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-violet-400" />
                <span className="text-violet-300 font-medium tracking-[0.4em] text-xs uppercase">
                  {t('aiProductivityHub')}
                </span>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-violet-400" />
              </div>
              <p className="text-white/60 text-sm mt-3 font-light" style={{ fontFamily: "'Noto Kufi Arabic', sans-serif" }}>
                {t('welcomeTitle')}
              </p>
            </div>
          </div>
        )}

        {/* مرحلة الميزات */}
        {stage === 'features' && (
          <div className="animate-fade-in-up">
            <div className="mb-6">
              <Logo size="lg" darkMode />
            </div>
            
            <p className="text-white/80 text-lg mb-8 font-light">
              {WS.experience} <span className="font-bold text-white">{WS.smartFeatures}</span>
            </p>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="relative group"
                  style={{
                    animation: `slideUp 0.6s ease-out forwards`,
                    animationDelay: `${idx * 100}ms`,
                    opacity: 0,
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-2xl blur-lg opacity-50`} />
                  <div className={`relative bg-gradient-to-br ${feature.color} p-4 rounded-2xl shadow-2xl border border-white/20`}>
                    <div className="text-3xl mb-1">{feature.icon}</div>
                    <div className="text-white text-xs font-bold">{feature.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-white/40 text-xs">
              <span>{WS.loading}</span>
              <span className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" />
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* أنماط Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-30px) translateX(15px); }
          50% { transform: translateY(-15px) translateX(-15px); }
          75% { transform: translateY(15px) translateX(20px); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
