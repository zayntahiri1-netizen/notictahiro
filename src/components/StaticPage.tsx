import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import ListenButton from './ListenButton';
import LanguageSelector from './LanguageSelector';
import Logo from './Logo';

export type StaticPageKind = 'privacy' | 'delete-data' | 'about' | 'contact';

interface StaticPageProps {
  page: StaticPageKind;
}

const contactEmail = 'zayntahiri1@gmail.com';

const pageIcons: Record<StaticPageKind, string> = {
  privacy: '🔒',
  'delete-data': '🧹',
  about: '✨',
  contact: '💌',
};

export default function StaticPage({ page }: StaticPageProps) {
  const { darkMode, t, language, direction } = useApp();

  const copy = useMemo(() => {
    const content = {
      ar: {
        privacy: {
          title: 'سياسة الخصوصية',
          eyebrow: 'مركز الثقة والشفافية',
          intro: 'خصوصيتك في Notic Tahiro جزء أساسي من المنتج. صممنا المنصة لتساعدك على تنظيم ملاحظاتك والتزاماتك بذكاء، مع إبقاء التحكم الحقيقي بيدك دائماً.',
          body: [
            'نجمع فقط البيانات اللازمة لتشغيل التجربة: الملاحظات، المشاريع، المهام، التنبيهات، السجلات المالية، الدائن والمدين، إعدادات اللغة، وتفضيلات الواجهة.',
            'يتم التعامل مع البيانات وفق مبدأ أقل صلاحية ممكنة: لا نطلب معلومات لا يحتاجها التطبيق، ولا نستخدم بياناتك لأغراض إعلانية أو بيعها لطرف ثالث.',
            'ميزات الذكاء الاصطناعي (اختيارية ولا تعمل إلا عند طلبك): عند استخدامها يُرسَل المحتوى اللازم لتنفيذ طلبك — نص الملاحظة أو السياق ذي الصلة من مهامك أو سجلاتك المالية — إلى واجهة Google Gemini عبر خادمنا الآمن، لغرض واحد فقط هو توليد الرد الذي طلبته.',
            'إفصاح عن معالجة الطرف الثالث: مزوّد الذكاء الاصطناعي هو Google (Gemini API)، وتخضع معالجته لسياسة خصوصية Google. لا نرسل أي محتوى إلا عند تفعيلك لميزة ذكاء اصطناعي بنفسك.',
            'استخدام محدود: لا نخزّن نص طلباتك أو ردود الذكاء الاصطناعي على خوادمنا. نسجّل فقط عدّادات استخدام مجهولة (اسم النموذج، عدد الوحدات النصية، وبصمة مشفّرة للـ IP) لمنع إساءة الاستخدام وضبط الحصص. لا تُستخدم بياناتك لتدريب النماذج ولا للإعلانات ولا تُباع.',
            'الملاحظات المقفلة برمز PIN لا تُرسل إلى الذكاء الاصطناعي إلا إذا فتحتها واخترت ذلك صراحة.',
            'أي معالجة ذكاء اصطناعي تمر عبر طبقة خادم آمنة لحماية مفاتيح API ومنع كشف الأسرار التقنية داخل الواجهة.',
            'عند استخدام AdMob أو AdSense، سيتم عرض الإعلانات وفق سياسات Google فقط، مع فصل واضح بين المحتوى والإعلانات، وبدون تشجيع على النقر أو وضع إعلانات مضللة أو متداخلة مع عناصر التحكم.',
            'إذا تم استخدام إعلانات مخصصة أو تحليلات، فسيتم عرض طلب موافقة مناسب للمستخدمين المؤهلين، مع احترام إعدادات الخصوصية وخيارات الإعلانات المحدودة.',
            'التطبيق ليس موجهاً للأطفال دون 13 سنة، ولا يستهدف جمع بيانات الأطفال. إذا كنت ولي أمر وتعتقد أن طفلاً قدم بيانات، تواصل معنا لحذفها.',
            'الميزات المالية داخل التطبيق مخصصة للتنظيم الشخصي فقط وليست نصيحة مالية أو استثمارية أو قانونية.',
          ],
          cards: ['تحكم كامل في البيانات', 'لا بيع للبيانات', 'موافقة إعلانات واضحة'],
        },
        'delete-data': {
          title: 'حذف البيانات',
          eyebrow: 'منطقة التحكم الحساسة',
          intro: 'هذه الصفحة تمنحك طريقة واضحة وآمنة لإدارة حذف بياناتك من Notic Tahiro عندما تريد بداية جديدة أو إزالة معلوماتك من الجهاز الحالي.',
          body: [
            'سيتم حذف الملاحظات، المشاريع، المعاملات المالية، سجلات الدائن والمدين، إعدادات اللغة، وتفضيلات الواجهة المخزنة على هذا الجهاز.',
            'نوصي بمراجعة البيانات المهمة قبل الحذف، لأن العملية نهائية ولا يمكن التراجع عنها بعد التأكيد.',
            'إذا كنت تستخدم نسخة سحابية مستقبلاً، فيجب أن يتضمن الحذف إزالة البيانات المرتبطة بحسابك من قاعدة البيانات وفق طلب المستخدم.',
            'عند وجود حسابات سحابية أو إعلانات أو تحليلات، يجب توفير مسار واضح لطلب حذف البيانات عبر البريد الرسمي، ومعالجة الطلب خلال مدة معقولة وفق سياسات Google Play.',
          ],
          cards: ['حذف واضح وآمن', 'تحكم ذاتي بالبيانات', 'تأكيد قبل الإجراء'],
        },
        about: {
          title: 'من نحن',
          eyebrow: 'فلسفة Notic Tahiro',
          intro: 'Notic Tahiro ليس مجرد تطبيق ملاحظات. إنه تجربة إنتاجية ذكية تهدف إلى تحويل الفوضى اليومية إلى نظام واضح وجميل.',
          body: [
            'بنينا Notic Tahiro حول فكرة تقليل الجهد الذهني: لا يجب أن ترتب كل شيء يدوياً، بل يجب أن يساعدك التطبيق على فهم أفكارك، تفكيك مهامك، وإدارة التزاماتك.',
            'يجمع التطبيق بين الملاحظات، الأفكار، المنبهات، الدائن والمدين، المالية الذكية، خريطة العقل، والدردشة مع ملاحظاتك في مكان واحد.',
            'نؤمن أن أفضل الأدوات هي التي تفهم لغتك، تحترم خصوصيتك، وتجعلك أكثر هدوءاً وإنتاجية دون تعقيد.',
          ],
          cards: ['إنتاجية بدون تعقيد', 'تصميم عربي متعدد اللغات', 'ذكاء اصطناعي عملي'],
        },
        contact: {
          title: 'اتصل بنا',
          eyebrow: 'نسمع أفكارك وملاحظاتك',
          intro: 'إذا كانت لديك فكرة، مشكلة، اقتراح ميزة، أو رغبة في التعاون، يسعدنا التواصل معك.',
          body: [
            'أرسل لنا وصفاً واضحاً لما تريد: هل هي ميزة جديدة؟ خطأ في التطبيق؟ تحسين في التصميم؟ كل التفاصيل تساعدنا على التطوير بسرعة.',
            'إذا كنت تبلغ عن مشكلة، حاول إرسال خطوات حدوثها أو لقطة شاشة. وإذا كانت فكرة، اشرح كيف ستساعدك في حياتك اليومية.',
            `البريد الرسمي للتواصل: ${contactEmail}`,
          ],
          cards: [contactEmail, 'اقتراح ميزة', 'الإبلاغ عن مشكلة'],
        },
      },
      en: {
        privacy: { title: 'Privacy Policy', eyebrow: 'Trust and transparency center', intro: 'Privacy in Notic Tahiro is a core product principle: intelligent organization without losing control of your data.', body: ['We process only what is needed to power the experience: notes, projects, tasks, reminders, financial entries, debt records, language, and interface preferences.', 'We do not sell your data, and we do not use your private notes for advertising purposes.', 'AI features are optional and run only when you request them. When used, the content needed to fulfil your request — your note text or relevant context from your tasks or financial records — is sent to the Google Gemini API through our secure server, solely to generate the response you asked for.', 'Third-party processing disclosure: our AI provider is Google (Gemini API) and its processing is governed by Google\u2019s privacy policy. No content is sent unless you actively trigger an AI feature.', 'Limited use: we do not store the text of your AI requests or responses on our servers. We log only anonymous usage counters (model name, token counts, and a hashed IP) to prevent abuse and enforce quotas. Your data is not used to train models, not used for ads, and never sold.', 'PIN-locked notes are never sent to the AI unless you unlock them and explicitly choose to do so.', 'Any AI processing is routed through a secure server layer so API keys and sensitive infrastructure secrets are never exposed in the frontend.', 'If AdMob or AdSense is used, ads will follow Google policies, be clearly separated from content, and never encourage accidental or incentivized clicks.', 'If personalized ads or analytics are enabled, eligible users will receive a consent choice and can use limited ads or necessary-only mode.', 'The app is not directed to children under 13 and does not knowingly collect children data.', 'Finance features are for personal organization only and are not financial, investment, tax, or legal advice.'], cards: ['Full data control', 'No data selling', 'Clear ad consent'] },
        'delete-data': { title: 'Delete Data', eyebrow: 'Sensitive control area', intro: 'This page gives you a clear way to remove your Notic Tahiro data when you want a fresh start or want to clear this device.', body: ['Deletion removes notes, projects, finance transactions, debt records, language settings, and interface preferences stored on this device.', 'Review or export important information before deleting, because the action is final after confirmation.', 'In a cloud-enabled version, account deletion should also remove user-linked records from the database upon request.', 'If cloud accounts, ads, or analytics are added, users must have a clear contact path for deletion requests and reasonable processing according to Google Play requirements.'], cards: ['Clear deletion flow', 'User-controlled data', 'Confirmation before action'] },
        about: { title: 'About Us', eyebrow: 'The Notic Tahiro philosophy', intro: 'Notic Tahiro is more than a notes app. It is an AI productivity experience for turning daily chaos into a clear system.', body: ['The main idea is reducing cognitive load: the app should help you understand ideas, break down tasks, and manage commitments.', 'It combines notes, ideas, reminders, debt and credit, smart finance, mind maps, and chat with notes in one place.', 'We believe great tools understand your language, respect your privacy, and make you calmer and more productive.'], cards: ['Productivity without friction', 'Multilingual design', 'Practical AI'] },
        contact: { title: 'Contact Us', eyebrow: 'We listen to your ideas', intro: 'Have an idea, issue, feature request, or collaboration proposal? We would love to hear from you.', body: ['Send a clear description of what you need: a feature, a bug, or a design improvement.', 'For bugs, include steps or screenshots. For ideas, explain how it helps your daily life.', `Official contact email: ${contactEmail}`], cards: [contactEmail, 'Feature requests', 'Bug reports'] },
      },
      es: {
        privacy: { title: 'Política de privacidad', eyebrow: 'Centro de confianza y transparencia', intro: 'La privacidad en Notic Tahiro es un principio central: organización inteligente sin perder el control de tus datos.', body: ['Procesamos solo lo necesario para la experiencia: notas, proyectos, tareas, recordatorios, finanzas, deudas, idioma y preferencias.', 'No vendemos tus datos ni usamos tus notas privadas con fines publicitarios.', 'Las funciones de IA son opcionales y sólo se ejecutan cuando t\u00fa las solicitas. Al usarlas, el contenido necesario para tu petici\u00f3n \u2014 el texto de tu nota o el contexto relevante de tus tareas o registros financieros \u2014 se env\u00eda a la API de Google Gemini a trav\u00e9s de nuestro servidor seguro, \u00fanicamente para generar la respuesta que pediste.', 'Divulgaci\u00f3n de terceros: nuestro proveedor de IA es Google (Gemini API) y su procesamiento se rige por la pol\u00edtica de privacidad de Google. No se env\u00eda ning\u00fan contenido salvo que actives una funci\u00f3n de IA.', 'Uso limitado: no almacenamos el texto de tus peticiones ni de las respuestas de IA en nuestros servidores. S\u00f3lo registramos contadores an\u00f3nimos de uso (modelo, n\u00famero de tokens y un hash de la IP) para prevenir abusos y aplicar cuotas. Tus datos no se usan para entrenar modelos, ni para publicidad, ni se venden.', 'Las notas bloqueadas con PIN nunca se env\u00edan a la IA salvo que las desbloquees y lo elijas expl\u00edcitamente.', 'Cualquier procesamiento de IA pasa por una capa de servidor segura para no exponer claves ni secretos t\u00e9cnicos.'], cards: ['Control total de datos', 'No vendemos datos', 'IA segura en servidor'] },
        'delete-data': { title: 'Eliminar datos', eyebrow: 'Zona de control sensible', intro: 'Esta página ofrece una forma clara de eliminar tus datos de Notic Tahiro cuando quieras empezar de nuevo o limpiar este dispositivo.', body: ['La eliminación borra notas, proyectos, finanzas, deudas, idioma y preferencias guardadas en este dispositivo.', 'Revisa o exporta lo importante antes de borrar, porque la acción es final tras la confirmación.', 'En una versión con nube, la eliminación de cuenta también debe borrar registros vinculados al usuario en la base de datos.'], cards: ['Flujo claro de borrado', 'Datos bajo tu control', 'Confirmación previa'] },
        about: { title: 'Quiénes somos', eyebrow: 'La filosofía de Notic Tahiro', intro: 'Notic Tahiro es una experiencia de productividad con IA para convertir el caos diario en claridad.', body: ['La idea principal es reducir la carga mental y ayudarte a entender ideas, dividir tareas y gestionar compromisos.', 'Combina notas, ideas, recordatorios, deudas, finanzas, mapas mentales y chat con notas.', 'Creemos en herramientas que entienden tu idioma, respetan tu privacidad y te hacen más productivo.'], cards: ['Productividad sin fricción', 'Diseño multilingüe', 'IA práctica'] },
        contact: { title: 'Contáctanos', eyebrow: 'Escuchamos tus ideas', intro: '¿Tienes una idea, error, solicitud de función o propuesta de colaboración?', body: ['Envíanos una descripción clara: función, error o mejora de diseño.', 'Para errores, incluye pasos o capturas. Para ideas, explica cómo ayuda en tu día.', `Correo oficial: ${contactEmail}`], cards: [contactEmail, 'Solicitar función', 'Reportar error'] },
      },
      zh: {
        privacy: { title: '隐私政策', eyebrow: '信任与透明中心', intro: '隐私是 Notic Tahiro 的核心原则：用智能整理生活，同时保留数据控制权。', body: ['我们只处理体验所需的数据：笔记、项目、任务、提醒、财务、债务、语言和界面偏好。', '我们不会出售你的数据，也不会把私人笔记用于广告目的。', 'AI 功能为可选功能，仅在你主动请求时运行。使用时，完成请求所需的内容——你的笔记文本，或来自任务、财务记录的相关上下文——会通过我们的安全服务器发送至 Google Gemini API，仅用于生成你所请求的回复。', '第三方处理披露：我们的 AI 提供方为 Google（Gemini API），其处理受 Google 隐私政策约束。除非你主动触发 AI 功能，否则不会发送任何内容。', '有限使用：我们不会在服务器上存储你的 AI 请求或回复文本。我们仅记录匿名使用计数（模型名称、令牌数量以及经哈希处理的 IP）以防止滥用并执行配额。你的数据不会用于训练模型、不会用于广告，也绝不出售。', '使用 PIN 锁定的笔记不会发送至 AI，除非你解锁并明确选择这样做。', '任何 AI 处理都通过安全服务器层完成，避免在前端暴露 API 密钥和技术机密。'], cards: ['完整数据控制', '不出售数据', '安全服务端 AI'] },
        'delete-data': { title: '删除数据', eyebrow: '敏感控制区域', intro: '此页面让你在想重新开始或清理当前设备时，清楚地删除 Notic Tahiro 数据。', body: ['删除会移除此设备上的笔记、项目、财务、债务、语言和界面偏好。', '删除前请检查或导出重要信息，因为确认后无法撤销。', '如果未来启用云端版本，账户删除也应删除数据库中与用户相关的记录。'], cards: ['清晰删除流程', '用户控制数据', '操作前确认'] },
        about: { title: '关于我们', eyebrow: 'Notic Tahiro 理念', intro: 'Notic Tahiro 是一个 AI 效率体验，用于把日常混乱变成清晰系统。', body: ['核心理念是降低认知负担，帮助你理解想法、拆分任务并管理承诺。', '它整合笔记、想法、提醒、债务、财务、思维导图和笔记聊天。', '我们相信优秀工具应理解你的语言、尊重隐私并提升效率。'], cards: ['无摩擦效率', '多语言设计', '实用 AI'] },
        contact: { title: '联系我们', eyebrow: '我们倾听你的想法', intro: '有想法、问题、功能请求或合作建议？欢迎联系。', body: ['请发送清晰描述：功能、错误或设计改进。', '报告错误请包含步骤或截图；提出想法请说明它如何帮助日常生活。', `官方邮箱：${contactEmail}`], cards: [contactEmail, '功能请求', '错误报告'] },
      },
    } as const;

    return content[language][page];
  }, [language, page]);

  const deleteLocalData = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState(null, '', '/');
    window.location.reload();
  };

  return (
    <div className={`min-h-screen overflow-x-hidden overflow-y-auto ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`} dir={direction}>
      <div className="fixed left-1/2 top-3 z-30 -translate-x-1/2 sm:top-4">
        <LanguageSelector placement="mini" />
      </div>

      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-700 to-pink-700" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_45%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 pt-14 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8 sm:pt-12 lg:px-8">
          <Logo size="md" darkMode animated />
          <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {(['privacy', 'delete-data', 'about', 'contact'] as StaticPageKind[]).map(item => (
              <a key={item} href={`/${item}`} className={`rounded-full px-3 py-2 text-center text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${page === item ? 'bg-white/15 text-white' : ''}`}>
                {item === 'privacy' ? t('privacy') : item === 'delete-data' ? t('deleteData') : item === 'about' ? t('about') : t('contact')}
              </a>
            ))}
            <a href="/" className="col-span-2 rounded-full bg-white/15 px-4 py-2 text-center text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/25 sm:col-span-1">
              {t('backToApp')}
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-8">
          <article className={`rounded-[1.5rem] p-5 shadow-2xl sm:rounded-[2rem] sm:p-8 ${darkMode ? 'bg-gray-900/80 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="mb-4 inline-flex rounded-full bg-gradient-to-r from-violet-500/10 to-pink-500/10 px-4 py-2 text-xs font-black text-violet-500">
              {pageIcons[page]} {copy.eyebrow}
            </div>
            <div className="mb-4 flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">{copy.title}</h1>
              {/* استماع: صفحات نصية طويلة — نبرة هادئة تناسب القراءة المطوّلة */}
              <ListenButton
                text={`${copy.title}. ${copy.intro} ${copy.body.join(' ')}`}
                style="calm"
                label={copy.title}
              />
            </div>
            <p className={`mb-6 text-lg font-semibold leading-8 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{copy.intro}</p>
            <div className={`space-y-4 text-sm leading-8 sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {copy.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>

            <div className={`mt-7 rounded-2xl p-4 ${darkMode ? 'bg-gray-800/70' : 'bg-gray-50'}`}>
              <div className="mb-2 text-xs font-black uppercase tracking-wider text-violet-500">Email</div>
              <a href={`mailto:${contactEmail}`} className="break-all text-lg font-black text-violet-600 hover:text-pink-500">
                {contactEmail}
              </a>
            </div>

            {page === 'delete-data' && (
              <button onClick={deleteLocalData} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-4 font-black text-white shadow-lg shadow-red-500/20 transition hover:scale-[1.01] active:scale-95">
                🗑️ {t('deleteData')}
              </button>
            )}
          </article>

          <aside className="space-y-4">
            <div className={`rounded-[1.5rem] p-5 sm:rounded-[2rem] ${darkMode ? 'bg-gray-900/80 border border-white/10' : 'bg-white border border-gray-200 shadow-xl'}`}>
              <div className="mb-3 text-sm font-black">🌐 {t('language')}</div>
              <LanguageSelector placement="wide" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {copy.cards.map((card, index) => (
                <div key={index} className={`rounded-[1.25rem] p-5 ${darkMode ? 'bg-gray-900/60 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
                  <div className="text-2xl">{['🛡️', '✨', '🚀'][index] || '✨'}</div>
                  <div className="mt-2 break-words font-black">{card}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}