import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import ListenButton from './ListenButton';
import LanguageSelector from './LanguageSelector';
import Logo from './Logo';

export type StaticPageKind = 'privacy' | 'terms' | 'delete-data' | 'about' | 'contact';

interface StaticPageProps {
  page: StaticPageKind;
}

const contactEmail = 'zayntahiri1@gmail.com';

const pageIcons: Record<StaticPageKind, string> = {
  privacy: '🔒',
  'delete-data': '🧹',
  about: '✨',
  contact: '💌',
  terms: '📜',
};

export default function StaticPage({ page }: StaticPageProps) {
  const { darkMode, t, language, direction } = useApp();

  const copy = useMemo(() => {
    const content = {
      ar: {
        terms: { title: 'الشروط والأحكام', eyebrow: 'اتفاقية استخدام واضحة', intro: 'باستخدامك Notic Tahiro فإنك توافق على الشروط أدناه. كُتبت بلغة مباشرة لأن شرطاً لا تفهمه لا يحميك ولا يحمينا.', body: ['الترخيص: نمنحك حق استخدام التطبيق لأغراضك الشخصية أو المهنية، استخداماً غير حصري وغير قابل للنقل. ويبقى التطبيق وشفرته وتصميمه ملكاً لنا.', 'حسابك ومحتواك: ملاحظاتك ومشاريعك وسجلاتك المالية ملكك أنت. لا ندّعي أي حق فيها، ولا نبيعها، ولا نستخدمها لتدريب نماذج.', 'مسؤوليتك عن بياناتك: التطبيق يحفظ بياناتك على جهازك أساساً. أنت مسؤول عن أخذ نسخ احتياطية، وعن حفظ رمز PIN الخاص بالملاحظات المقفلة — فلا نملك وسيلة لاستعادته إن نسيته.', 'ميزات الذكاء الاصطناعي: تعمل عند طلبك، وتُنتج نصّاً قد يكون غير دقيق أو ناقصاً. راجِع ما تولّده قبل الاعتماد عليه، خاصة في الأمور المالية أو القانونية أو الصحية.', 'الميزات المالية: مخصّصة للتنظيم الشخصي فقط، وليست استشارة مالية ولا استثمارية ولا ضريبية ولا قانونية. القرارات المبنية عليها مسؤوليتك وحدك.', 'الاستخدام المقبول: لا يجوز استعمال التطبيق في نشاط غير قانوني، ولا لمحاولة اختراقه أو تعطيله أو الالتفاف على حدوده، ولا لإعادة بيعه أو توزيعه بلا إذن.', 'الإعلانات: التطبيق مجاني ويُموَّل بالإعلانات عبر Google AdMob. وهي مفصولة بوضوح عن المحتوى، ولا نشجّع على النقر عليها.', 'التوفّر: نسعى لإبقاء الخدمة عاملة، لكننا لا نضمن استمرارها بلا انقطاع. وقد نُعدّل الميزات أو نوقف بعضها مع إشعارٍ معقول متى أمكن.', 'حدود المسؤولية: يُقدَّم التطبيق «كما هو». وفي حدود ما يسمح به القانون، لا نتحمّل مسؤولية أي خسارة غير مباشرة أو فقدان بيانات أو أرباح فائتة ناتجة عن الاستخدام.', 'إنهاء الاستخدام: يمكنك التوقف متى شئت بحذف التطبيق. ويمكننا إيقاف الوصول عند مخالفة جسيمة لهذه الشروط.', 'تعديل الشروط: قد نُحدّث هذه الشروط. والاستمرار في استخدام التطبيق بعد التحديث يعني قبولك النسخة الجديدة.', 'القانون المطبّق والتواصل: تخضع هذه الشروط للقانون المغربي. ولأي سؤال أو نزاع، راسلنا أولاً على zayntahiri1@gmail.com — نُفضّل الحل المباشر.'], cards: ['استخدام واضح', 'محتواك ملكك', 'مسؤولية متبادلة'] },
        privacy: {
          title: 'سياسة الخصوصية',
          eyebrow: 'مركز الثقة والشفافية',
          intro: 'خصوصيتك في Notic Tahiro جزء أساسي من المنتج. صممنا المنصة لتساعدك على تنظيم ملاحظاتك والتزاماتك بذكاء، مع إبقاء التحكم الحقيقي بيدك دائماً.',
          body: [
            'نجمع فقط البيانات اللازمة لتشغيل التجربة: الملاحظات، المشاريع، المهام، التنبيهات، السجلات المالية، الدائن والمدين، إعدادات اللغة، وتفضيلات الواجهة.',
            'يتم التعامل مع البيانات وفق مبدأ أقل صلاحية ممكنة: لا نطلب معلومات لا يحتاجها التطبيق، ولا نستخدم بياناتك لأغراض إعلانية أو بيعها لطرف ثالث.',
            'ميزات الذكاء الاصطناعي (اختيارية ولا تعمل إلا عند طلبك): عند استخدامها يُرسَل المحتوى اللازم لتنفيذ طلبك — نص الملاحظة أو السياق ذي الصلة من مهامك أو سجلاتك المالية — إلى واجهة Google Gemini عبر خادمنا الآمن، لغرض واحد فقط هو توليد الرد الذي طلبته.',
            'التسجيل الصوتي والميكروفون: لا يُفتح الميكروفون إلا عند ضغطك زرّ التسجيل بنفسك، ويتوقّف فور إنهائك التسجيل. يُحفَظ المقطع في مخزن التطبيق الخاص على جهازك (مجلد voice-notes) ولا يُرفع إلى خوادمنا. وإن كان جهازك متصلاً بالإنترنت، يُرسَل المقطع إلى واجهة Google Gemini عبر خادمنا الآمن لتفريغه نصّاً، ثم لا يُخزَّن لدينا؛ وإن كنت غير متصل يبقى المقطع على جهازك وحده بلا أي إرسال. ويمكنك سحب إذن الميكروفون في أي وقت من إعدادات النظام، وحذف المقاطع من داخل التطبيق.',
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
        terms: { title: 'Terms and Conditions', eyebrow: 'A plain-language agreement', intro: 'By using Notic Tahiro you agree to the terms below. They are written plainly, because a term you cannot understand protects neither you nor us.', body: ['Licence: we grant you a non-exclusive, non-transferable right to use the app for your personal or professional purposes. The app, its code and its design remain ours.', 'Your content: your notes, projects and financial records belong to you. We claim no rights over them, we do not sell them, and we do not use them to train models.', 'Responsibility for your data: the app stores your data primarily on your device. You are responsible for keeping backups, and for remembering the PIN of locked notes — we have no way to recover it if you forget it.', 'AI features: they run when you ask for them and produce text that may be inaccurate or incomplete. Review what they generate before relying on it, especially on financial, legal or health matters.', 'Financial features: they are for personal organization only and are not financial, investment, tax or legal advice. Decisions based on them are yours alone.', 'Acceptable use: you may not use the app for unlawful activity, attempt to break, disable or circumvent its limits, or resell or redistribute it without permission.', 'Advertising: the app is free and funded by ads through Google AdMob. Ads are clearly separated from content, and we never encourage clicks on them.', 'Availability: we work to keep the service running, but we do not guarantee uninterrupted availability. We may change or retire features, with reasonable notice where possible.', 'Limitation of liability: the app is provided "as is". To the extent permitted by law, we are not liable for indirect loss, loss of data or lost profits arising from its use.', 'Ending use: you may stop at any time by deleting the app. We may suspend access in the event of a serious breach of these terms.', 'Changes to these terms: we may update them. Continuing to use the app after an update means you accept the new version.', 'Governing law and contact: these terms are governed by Moroccan law. For any question or dispute, write to us first at zayntahiri1@gmail.com — we prefer to resolve things directly.'], cards: ['Plain terms', 'Your content is yours', 'Shared responsibility'] },
        privacy: { title: 'Privacy Policy', eyebrow: 'Trust and transparency center', intro: 'Privacy in Notic Tahiro is a core product principle: intelligent organization without losing control of your data.', body: ['We process only what is needed to power the experience: notes, projects, tasks, reminders, financial entries, debt records, language, and interface preferences.', 'We do not sell your data, and we do not use your private notes for advertising purposes.', 'AI features are optional and run only when you request them. When used, the content needed to fulfil your request — your note text or relevant context from your tasks or financial records — is sent to the Google Gemini API through our secure server, solely to generate the response you asked for.',
        'Voice recording and microphone: the microphone is opened only when you press the record button yourself, and it stops the moment you end the recording. The clip is saved to the app\u2019s private storage on your device (a voice-notes folder) and is not uploaded to our servers. If your device is online, the clip is sent to the Google Gemini API through our secure server to be transcribed into text, and is not stored by us afterwards; if you are offline the clip stays on your device alone with no transmission at all. You can revoke the microphone permission at any time in system settings, and delete clips from inside the app.', 'Third-party processing disclosure: our AI provider is Google (Gemini API) and its processing is governed by Google\u2019s privacy policy. No content is sent unless you actively trigger an AI feature.', 'Limited use: we do not store the text of your AI requests or responses on our servers. We log only anonymous usage counters (model name, token counts, and a hashed IP) to prevent abuse and enforce quotas. Your data is not used to train models, not used for ads, and never sold.', 'PIN-locked notes are never sent to the AI unless you unlock them and explicitly choose to do so.', 'Any AI processing is routed through a secure server layer so API keys and sensitive infrastructure secrets are never exposed in the frontend.', 'If AdMob or AdSense is used, ads will follow Google policies, be clearly separated from content, and never encourage accidental or incentivized clicks.', 'If personalized ads or analytics are enabled, eligible users will receive a consent choice and can use limited ads or necessary-only mode.', 'The app is not directed to children under 13 and does not knowingly collect children data.', 'Finance features are for personal organization only and are not financial, investment, tax, or legal advice.'], cards: ['Full data control', 'No data selling', 'Clear ad consent'] },
        'delete-data': { title: 'Delete Data', eyebrow: 'Sensitive control area', intro: 'This page gives you a clear way to remove your Notic Tahiro data when you want a fresh start or want to clear this device.', body: ['Deletion removes notes, projects, finance transactions, debt records, language settings, and interface preferences stored on this device.', 'Review or export important information before deleting, because the action is final after confirmation.', 'In a cloud-enabled version, account deletion should also remove user-linked records from the database upon request.', 'If cloud accounts, ads, or analytics are added, users must have a clear contact path for deletion requests and reasonable processing according to Google Play requirements.'], cards: ['Clear deletion flow', 'User-controlled data', 'Confirmation before action'] },
        about: { title: 'About Us', eyebrow: 'The Notic Tahiro philosophy', intro: 'Notic Tahiro is more than a notes app. It is an AI productivity experience for turning daily chaos into a clear system.', body: ['The main idea is reducing cognitive load: the app should help you understand ideas, break down tasks, and manage commitments.', 'It combines notes, ideas, reminders, debt and credit, smart finance, mind maps, and chat with notes in one place.', 'We believe great tools understand your language, respect your privacy, and make you calmer and more productive.'], cards: ['Productivity without friction', 'Multilingual design', 'Practical AI'] },
        contact: { title: 'Contact Us', eyebrow: 'We listen to your ideas', intro: 'Have an idea, issue, feature request, or collaboration proposal? We would love to hear from you.', body: ['Send a clear description of what you need: a feature, a bug, or a design improvement.', 'For bugs, include steps or screenshots. For ideas, explain how it helps your daily life.', `Official contact email: ${contactEmail}`], cards: [contactEmail, 'Feature requests', 'Bug reports'] },
      },
      es: {
        terms: { title: 'T\u00e9rminos y Condiciones', eyebrow: 'Un acuerdo en lenguaje claro', intro: 'Al usar Notic Tahiro aceptas los t\u00e9rminos siguientes. Est\u00e1n redactados con claridad, porque una cl\u00e1usula que no entiendes no te protege a ti ni a nosotros.', body: ['Licencia: te concedemos un derecho no exclusivo e intransferible de uso de la aplicaci\u00f3n para fines personales o profesionales. La aplicaci\u00f3n, su c\u00f3digo y su dise\u00f1o siguen siendo nuestros.', 'Tu contenido: tus notas, proyectos y registros financieros te pertenecen. No reclamamos ning\u00fan derecho sobre ellos, no los vendemos y no los usamos para entrenar modelos.', 'Responsabilidad sobre tus datos: la aplicaci\u00f3n guarda tus datos principalmente en tu dispositivo. Eres responsable de hacer copias de seguridad y de recordar el PIN de las notas bloqueadas: no tenemos forma de recuperarlo si lo olvidas.', 'Funciones de IA: se ejecutan cuando t\u00fa las pides y generan texto que puede ser inexacto o incompleto. Revisa lo que produzcan antes de confiar en ello, sobre todo en asuntos financieros, legales o de salud.', 'Funciones financieras: son solo para organizaci\u00f3n personal y no constituyen asesoramiento financiero, de inversi\u00f3n, fiscal ni legal. Las decisiones basadas en ellas son \u00fanicamente tuyas.', 'Uso aceptable: no puedes usar la aplicaci\u00f3n para actividades il\u00edcitas, intentar vulnerarla, desactivarla o eludir sus l\u00edmites, ni revenderla o redistribuirla sin permiso.', 'Publicidad: la aplicaci\u00f3n es gratuita y se financia con anuncios mediante Google AdMob. Los anuncios est\u00e1n claramente separados del contenido y nunca incentivamos los clics.', 'Disponibilidad: trabajamos para mantener el servicio en funcionamiento, pero no garantizamos una disponibilidad ininterrumpida. Podemos modificar o retirar funciones, avisando con antelaci\u00f3n razonable cuando sea posible.', 'Limitaci\u00f3n de responsabilidad: la aplicaci\u00f3n se ofrece "tal cual". En la medida permitida por la ley, no respondemos por da\u00f1os indirectos, p\u00e9rdida de datos o lucro cesante derivados de su uso.', 'Fin del uso: puedes dejar de usarla en cualquier momento eliminando la aplicaci\u00f3n. Podemos suspender el acceso en caso de incumplimiento grave de estos t\u00e9rminos.', 'Cambios en estos t\u00e9rminos: podemos actualizarlos. Seguir usando la aplicaci\u00f3n tras una actualizaci\u00f3n significa que aceptas la nueva versi\u00f3n.', 'Ley aplicable y contacto: estos t\u00e9rminos se rigen por la ley marroqu\u00ed. Para cualquier duda o conflicto, escr\u00edbenos primero a zayntahiri1@gmail.com: preferimos resolverlo directamente.'], cards: ['T\u00e9rminos claros', 'Tu contenido es tuyo', 'Responsabilidad compartida'] },
        privacy: { title: 'Política de privacidad', eyebrow: 'Centro de confianza y transparencia', intro: 'La privacidad en Notic Tahiro es un principio central: organización inteligente sin perder el control de tus datos.', body: ['Procesamos solo lo necesario para la experiencia: notas, proyectos, tareas, recordatorios, finanzas, deudas, idioma y preferencias.', 'No vendemos tus datos ni usamos tus notas privadas con fines publicitarios.', 'Las funciones de IA son opcionales y sólo se ejecutan cuando t\u00fa las solicitas. Al usarlas, el contenido necesario para tu petici\u00f3n \u2014 el texto de tu nota o el contexto relevante de tus tareas o registros financieros \u2014 se env\u00eda a la API de Google Gemini a trav\u00e9s de nuestro servidor seguro, \u00fanicamente para generar la respuesta que pediste.',
        'Grabaci\u00f3n de voz y micr\u00f3fono: el micr\u00f3fono se abre \u00fanicamente cuando t\u00fa pulsas el bot\u00f3n de grabar, y se detiene en cuanto finalizas la grabaci\u00f3n. El clip se guarda en el almacenamiento privado de la app en tu dispositivo (una carpeta voice-notes) y no se sube a nuestros servidores. Si tu dispositivo est\u00e1 conectado, el clip se env\u00eda a la API de Google Gemini a trav\u00e9s de nuestro servidor seguro para transcribirlo a texto, y despu\u00e9s no se almacena por nuestra parte; si est\u00e1s sin conexi\u00f3n, el clip permanece solo en tu dispositivo sin ning\u00fan env\u00edo. Puedes revocar el permiso de micr\u00f3fono en cualquier momento en los ajustes del sistema y borrar los clips desde la propia app.', 'Divulgaci\u00f3n de terceros: nuestro proveedor de IA es Google (Gemini API) y su procesamiento se rige por la pol\u00edtica de privacidad de Google. No se env\u00eda ning\u00fan contenido salvo que actives una funci\u00f3n de IA.', 'Uso limitado: no almacenamos el texto de tus peticiones ni de las respuestas de IA en nuestros servidores. S\u00f3lo registramos contadores an\u00f3nimos de uso (modelo, n\u00famero de tokens y un hash de la IP) para prevenir abusos y aplicar cuotas. Tus datos no se usan para entrenar modelos, ni para publicidad, ni se venden.', 'Las notas bloqueadas con PIN nunca se env\u00edan a la IA salvo que las desbloquees y lo elijas expl\u00edcitamente.', 'Cualquier procesamiento de IA pasa por una capa de servidor segura para no exponer claves ni secretos t\u00e9cnicos.', 'Si se utiliza AdMob o AdSense, los anuncios seguir\u00e1n las pol\u00edticas de Google, estar\u00e1n claramente separados del contenido y nunca fomentar\u00e1n clics accidentales o incentivados.', 'Si se activan anuncios personalizados o anal\u00edticas, los usuarios elegibles recibir\u00e1n una solicitud de consentimiento y podr\u00e1n elegir anuncios limitados o el modo de solo lo necesario.', 'La aplicaci\u00f3n no est\u00e1 dirigida a menores de 13 a\u00f1os y no recopila datos de menores de forma consciente.', 'Las funciones financieras son solo para organizaci\u00f3n personal y no constituyen asesoramiento financiero, de inversi\u00f3n, fiscal o legal.'], cards: ['Control total de datos', 'No vendemos datos', 'IA segura en servidor'] },
        'delete-data': { title: 'Eliminar datos', eyebrow: 'Zona de control sensible', intro: 'Esta página ofrece una forma clara de eliminar tus datos de Notic Tahiro cuando quieras empezar de nuevo o limpiar este dispositivo.', body: ['La eliminación borra notas, proyectos, finanzas, deudas, idioma y preferencias guardadas en este dispositivo.', 'Revisa o exporta lo importante antes de borrar, porque la acción es final tras la confirmación.', 'En una versión con nube, la eliminación de cuenta también debe borrar registros vinculados al usuario en la base de datos.', 'Si se añaden cuentas en la nube, anuncios o analíticas, los usuarios deben disponer de una vía de contacto clara para solicitar la eliminación, con un procesamiento razonable según los requisitos de Google Play.'], cards: ['Flujo claro de borrado', 'Datos bajo tu control', 'Confirmación previa'] },
        about: { title: 'Quiénes somos', eyebrow: 'La filosofía de Notic Tahiro', intro: 'Notic Tahiro es una experiencia de productividad con IA para convertir el caos diario en claridad.', body: ['La idea principal es reducir la carga mental y ayudarte a entender ideas, dividir tareas y gestionar compromisos.', 'Combina notas, ideas, recordatorios, deudas, finanzas, mapas mentales y chat con notas.', 'Creemos en herramientas que entienden tu idioma, respetan tu privacidad y te hacen más productivo.'], cards: ['Productividad sin fricción', 'Diseño multilingüe', 'IA práctica'] },
        contact: { title: 'Contáctanos', eyebrow: 'Escuchamos tus ideas', intro: '¿Tienes una idea, error, solicitud de función o propuesta de colaboración?', body: ['Envíanos una descripción clara: función, error o mejora de diseño.', 'Para errores, incluye pasos o capturas. Para ideas, explica cómo ayuda en tu día.', `Correo oficial: ${contactEmail}`], cards: [contactEmail, 'Solicitar función', 'Reportar error'] },
      },
      zh: {
        terms: { title: '条款与条件', eyebrow: '用通俗语言写成的协议', intro: '使用 Notic Tahiro 即表示你同意以下条款。它们以直白的语言写成，因为你看不懂的条款既保护不了你，也保护不了我们。', body: ['许可：我们授予你非独占、不可转让的权利，将本应用用于个人或工作用途。应用本身、其代码与设计仍归我们所有。', '你的内容：你的笔记、项目和财务记录归你所有。我们不主张任何权利，不出售它们，也不用它们训练模型。', '数据责任：本应用主要将数据保存在你的设备上。你需自行备份，并牢记加锁笔记的 PIN 码——一旦遗忘，我们无法为你找回。', 'AI 功能：仅在你请求时运行，生成的文本可能不准确或不完整。在依赖之前请先核对，尤其涉及财务、法律或健康事项时。', '财务功能：仅用于个人整理，不构成财务、投资、税务或法律建议。基于其所做的决定由你自行负责。', '可接受使用：不得将本应用用于违法活动，不得试图破解、停用或绕过其限制，也不得未经许可转售或再分发。', '广告：本应用免费，通过 Google AdMob 投放广告维持运营。广告与内容明确分隔，我们绝不诱导点击。', '可用性：我们努力保持服务运行，但不保证不间断可用。我们可能调整或下线某些功能，并在可能时提前合理告知。', '责任限制：本应用按「现状」提供。在法律允许的范围内，我们不对因使用而产生的间接损失、数据丢失或利润损失承担责任。', '终止使用：你可以随时删除应用以停止使用。若严重违反本条款，我们可暂停你的访问。', '条款变更：我们可能更新本条款。更新后继续使用本应用，即表示你接受新版本。', '适用法律与联系方式：本条款适用摩洛哥法律。如有任何问题或争议，请先通过 zayntahiri1@gmail.com 与我们联系——我们更愿意直接解决。'], cards: ['条款清晰', '内容归你所有', '责任共担'] },
        privacy: { title: '隐私政策', eyebrow: '信任与透明中心', intro: '隐私是 Notic Tahiro 的核心原则：用智能整理生活，同时保留数据控制权。', body: ['我们只处理体验所需的数据：笔记、项目、任务、提醒、财务、债务、语言和界面偏好。', '我们不会出售你的数据，也不会把私人笔记用于广告目的。', 'AI 功能为可选功能，仅在你主动请求时运行。使用时，完成请求所需的内容——你的笔记文本，或来自任务、财务记录的相关上下文——会通过我们的安全服务器发送至 Google Gemini API，仅用于生成你所请求的回复。',
        '语音录制与麦克风：只有在你自己按下录音按钮时才会打开麦克风，并在你结束录音的那一刻停止。录音片段保存在设备上本应用的私有存储中（voice-notes 文件夹），不会上传到我们的服务器。如果设备处于联网状态，该片段会通过我们的安全服务器发送至 Google Gemini API 以转写为文字，之后我们不会存储它；如果你处于离线状态，片段仅保留在你的设备上，不会进行任何发送。你可以随时在系统设置中撤销麦克风权限，并在应用内删除这些片段。', '第三方处理披露：我们的 AI 提供方为 Google（Gemini API），其处理受 Google 隐私政策约束。除非你主动触发 AI 功能，否则不会发送任何内容。', '有限使用：我们不会在服务器上存储你的 AI 请求或回复文本。我们仅记录匿名使用计数（模型名称、令牌数量以及经哈希处理的 IP）以防止滥用并执行配额。你的数据不会用于训练模型、不会用于广告，也绝不出售。', '使用 PIN 锁定的笔记不会发送至 AI，除非你解锁并明确选择这样做。', '任何 AI 处理都通过安全服务器层完成，避免在前端暴露 API 密钥和技术机密。', '如果使用 AdMob 或 AdSense，广告将遵循 Google 政策，与内容明确分隔，绝不诱导意外点击或激励点击。', '如果启用个性化广告或分析功能，符合条件的用户将收到同意选项，可选择受限广告或「仅必要」模式。', '本应用不面向 13 岁以下儿童，也不会在知情的情况下收集儿童数据。', '财务功能仅用于个人整理，不构成财务、投资、税务或法律建议。'], cards: ['完整数据控制', '不出售数据', '安全服务端 AI'] },
        'delete-data': { title: '删除数据', eyebrow: '敏感控制区域', intro: '此页面让你在想重新开始或清理当前设备时，清楚地删除 Notic Tahiro 数据。', body: ['删除会移除此设备上的笔记、项目、财务、债务、语言和界面偏好。', '删除前请检查或导出重要信息，因为确认后无法撤销。', '如果未来启用云端版本，账户删除也应删除数据库中与用户相关的记录。', '如果添加云账户、广告或分析功能，必须为用户提供明确的联系方式以提交删除请求，并按照 Google Play 的要求在合理时间内处理。'], cards: ['清晰删除流程', '用户控制数据', '操作前确认'] },
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
            {(['privacy', 'terms', 'delete-data', 'about', 'contact'] as StaticPageKind[]).map(item => (
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