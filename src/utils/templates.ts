/**
 * templates.ts — مكتبة قوالب احترافية عالمية.
 *
 * كلّ قالب يَحوي عنوان البداية، محتوى Markdown منظَّماً، ووسوماً مقترحة.
 * الصياغة متعدّدة اللغات وعامّة بصرف النظر عن الثقافة، تناسب المهنيين عالمياً.
 */

import type { AppLanguage } from '../i18n';

export interface NoteTemplate {
  id: string;
  icon: string;
  /** اسم القالب بكلّ اللغات */
  name: Record<AppLanguage, string>;
  /** وصف موجز */
  description: Record<AppLanguage, string>;
  /** محتوى Markdown بكلّ اللغات */
  content: Record<AppLanguage, string>;
  tags?: string[];
}

const today = (lang: AppLanguage) => {
  const locale = lang === 'ar' ? 'ar' : lang === 'es' ? 'es-ES' : lang === 'zh' ? 'zh-CN' : 'en-US';
  return new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export function getTemplates(lang: AppLanguage = 'en'): NoteTemplate[] {
  const t = today(lang);
  return [
    {
      id: 'meeting',
      icon: '🤝',
      name: {
        ar: 'ملاحظات اجتماع',
        en: 'Meeting Notes',
        es: 'Notas de reunión',
        zh: '会议笔记',
      },
      description: {
        ar: 'جدول أعمال، حضور، قرارات، ومهام المتابعة',
        en: 'Agenda, attendees, decisions, and action items',
        es: 'Agenda, asistentes, decisiones y tareas de seguimiento',
        zh: '议程、与会者、决定和后续任务',
      },
      content: {
        ar: `# اجتماع
**التاريخ:** ${t}
**الحضور:** 

## 📋 جدول الأعمال
1. 
2. 

## 💬 نقاط النقاش
- 

## ✅ القرارات
- 

## 📌 المهام التالية
- [ ] 
- [ ] 

## 🔗 ملاحظات ذات صلة
[[]]
`,
        en: `# Meeting
**Date:** ${t}
**Attendees:** 

## 📋 Agenda
1. 
2. 

## 💬 Discussion
- 

## ✅ Decisions
- 

## 📌 Action items
- [ ] 
- [ ] 

## 🔗 Related notes
[[]]
`,
        es: `# Reunión
**Fecha:** ${t}
**Asistentes:** 

## 📋 Agenda
1. 
2. 

## 💬 Discusión
- 

## ✅ Decisiones
- 

## 📌 Tareas de seguimiento
- [ ] 
- [ ] 

## 🔗 Notas relacionadas
[[]]
`,
        zh: `# 会议
**日期:** ${t}
**与会者:** 

## 📋 议程
1. 
2. 

## 💬 讨论
- 

## ✅ 决定
- 

## 📌 后续任务
- [ ] 
- [ ] 

## 🔗 相关笔记
[[]]
`,
      },
      tags: ['meeting'],
    },
    {
      id: 'journal',
      icon: '📓',
      name: {
        ar: 'يوميّات اليوم',
        en: 'Daily Journal',
        es: 'Diario de hoy',
        zh: '每日日记',
      },
      description: {
        ar: 'تأمّل في اليوم، إنجازات، وامتنان',
        en: 'Reflect on your day, accomplishments, and gratitude',
        es: 'Reflexiona sobre tu día, logros y gratitud',
        zh: '反思一天、成就和感恩',
      },
      content: {
        ar: `# ${t}

## 🌅 كيف كان يومي
> 

## 🏆 ثلاثة إنجازات
1. 
2. 
3. 

## 🌱 ما تعلّمته
- 

## 🙏 ممتنّ لـ
- 
- 
- 

## 🎯 أولوية الغد
- 
`,
        en: `# ${t}

## 🌅 How my day went
> 

## 🏆 Three wins
1. 
2. 
3. 

## 🌱 What I learned
- 

## 🙏 Grateful for
- 
- 
- 

## 🎯 Tomorrow's focus
- 
`,
        es: `# ${t}

## 🌅 Cómo fue mi día
> 

## 🏆 Tres logros
1. 
2. 
3. 

## 🌱 Lo que aprendí
- 

## 🙏 Agradecido por
- 
- 
- 

## 🎯 Prioridad para mañana
- 
`,
        zh: `# ${t}

## 🌅 我的一天
> 

## 🏆 三个胜利
1. 
2. 
3. 

## 🌱 我学到了
- 

## 🙏 感恩
- 
- 
- 

## 🎯 明天的重点
- 
`,
      },
      tags: ['journal'],
    },
    {
      id: 'project',
      icon: '🚀',
      name: {
        ar: 'مشروع جديد',
        en: 'Project Brief',
        es: 'Resumen de proyecto',
        zh: '项目简介',
      },
      description: {
        ar: 'الهدف، الجمهور، المعالم، والمخاطر',
        en: 'Goal, audience, milestones, and risks',
        es: 'Objetivo, audiencia, hitos y riesgos',
        zh: '目标、受众、里程碑和风险',
      },
      content: {
        ar: `# 

## 🎯 الهدف
ما الذي يحقّقه هذا المشروع؟

## 👥 الجمهور
لمن هذا المشروع؟

## 🗓 المعالم
- [ ] المعلم 1 — 
- [ ] المعلم 2 — 
- [ ] الإطلاق — 

## ⚠️ المخاطر
- 

## 📚 المراجع
- [[]]
`,
        en: `# 

## 🎯 Goal
What does this project achieve?

## 👥 Audience
Who is this for?

## 🗓 Milestones
- [ ] Milestone 1 — 
- [ ] Milestone 2 — 
- [ ] Launch — 

## ⚠️ Risks
- 

## 📚 References
- [[]]
`,
        es: `# 

## 🎯 Objetivo
¿Qué logra este proyecto?

## 👥 Audiencia
¿Para quién es?

## 🗓 Hitos
- [ ] Hito 1 — 
- [ ] Hito 2 — 
- [ ] Lanzamiento — 

## ⚠️ Riesgos
- 

## 📚 Referencias
- [[]]
`,
        zh: `# 

## 🎯 目标
该项目实现什么?

## 👥 受众
为谁服务?

## 🗓 里程碑
- [ ] 里程碑 1 — 
- [ ] 里程碑 2 — 
- [ ] 发布 — 

## ⚠️ 风险
- 

## 📚 参考
- [[]]
`,
      },
      tags: ['project'],
    },
    {
      id: 'book',
      icon: '📚',
      name: {
        ar: 'ملاحظات كتاب',
        en: 'Book Notes',
        es: 'Notas de libro',
        zh: '读书笔记',
      },
      description: {
        ar: 'فكرة رئيسية، اقتباسات، وتطبيقات',
        en: 'Big idea, quotes, and applications',
        es: 'Idea principal, citas y aplicaciones',
        zh: '主要思想、引文和应用',
      },
      content: {
        ar: `# 
**المؤلّف:** 
**القراءة:** ${t}

## 💡 الفكرة الكبرى
> 

## ⭐ أهمّ النقاط
1. 
2. 
3. 

## 📝 اقتباسات
> 

## 🛠 التطبيق العملي
- [ ] 

## 🔗 صلات
[[]]
`,
        en: `# 
**Author:** 
**Read:** ${t}

## 💡 Big idea
> 

## ⭐ Key takeaways
1. 
2. 
3. 

## 📝 Quotes
> 

## 🛠 How I'll apply this
- [ ] 

## 🔗 Connections
[[]]
`,
        es: `# 
**Autor:** 
**Leído:** ${t}

## 💡 Idea principal
> 

## ⭐ Puntos clave
1. 
2. 
3. 

## 📝 Citas
> 

## 🛠 Cómo lo aplicaré
- [ ] 

## 🔗 Conexiones
[[]]
`,
        zh: `# 
**作者:** 
**阅读:** ${t}

## 💡 主要思想
> 

## ⭐ 关键要点
1. 
2. 
3. 

## 📝 引文
> 

## 🛠 我将如何应用
- [ ] 

## 🔗 关联
[[]]
`,
      },
      tags: ['book'],
    },
    {
      id: 'decision',
      icon: '⚖️',
      name: {
        ar: 'قرار',
        en: 'Decision',
        es: 'Decisión',
        zh: '决策',
      },
      description: {
        ar: 'الخيارات، المعايير، والنتيجة',
        en: 'Options, criteria, and outcome',
        es: 'Opciones, criterios y resultado',
        zh: '选项、标准和结果',
      },
      content: {
        ar: `# 
**التاريخ:** ${t}

## 🤔 السياق
ماذا أحاول أن أقرّر؟

## 🎯 المعايير
1. 
2. 

## 🔀 الخيارات
**أ.** 
   - مزايا: 
   - عيوب: 

**ب.** 
   - مزايا: 
   - عيوب: 

## ✅ القرار
> 

## 🔍 المتابعة
- [ ] أعِد التقييم بعد: 
`,
        en: `# 
**Date:** ${t}

## 🤔 Context
What am I trying to decide?

## 🎯 Criteria
1. 
2. 

## 🔀 Options
**A.** 
   - Pros: 
   - Cons: 

**B.** 
   - Pros: 
   - Cons: 

## ✅ Decision
> 

## 🔍 Follow-up
- [ ] Re-evaluate on: 
`,
        es: `# 
**Fecha:** ${t}

## 🤔 Contexto
¿Qué estoy tratando de decidir?

## 🎯 Criterios
1. 
2. 

## 🔀 Opciones
**A.** 
   - Pros: 
   - Contras: 

**B.** 
   - Pros: 
   - Contras: 

## ✅ Decisión
> 

## 🔍 Seguimiento
- [ ] Reevaluar el: 
`,
        zh: `# 
**日期:** ${t}

## 🤔 背景
我在尝试决定什么?

## 🎯 标准
1. 
2. 

## 🔀 选项
**A.** 
   - 优点: 
   - 缺点: 

**B.** 
   - 优点: 
   - 缺点: 

## ✅ 决定
> 

## 🔍 后续
- [ ] 重新评估日期: 
`,
      },
      tags: ['decision'],
    },
    {
      id: 'shopping',
      icon: '🛒',
      name: {
        ar: 'قائمة تسوق',
        en: 'Shopping List',
        es: 'Lista de compras',
        zh: '购物清单',
      },
      description: {
        ar: 'قائمة مشتريات سريعة مع خانات شطب',
        en: 'Quick checklist for groceries',
        es: 'Lista rápida con casillas',
        zh: '快速购物核对清单',
      },
      content: {
        ar: `# 🛒 قائمة التسوق

## 🥦 خضر وفواكه
- [ ] 
- [ ] 

## 🥖 أساسيات
- [ ] خبز
- [ ] حليب
- [ ] 

## 🧴 منزل ونظافة
- [ ] 

## 💰 الميزانية المتوقعة
> _____ درهم
`,
        en: `# 🛒 Shopping List

## 🥦 Produce
- [ ] 
- [ ] 

## 🥖 Essentials
- [ ] Bread
- [ ] Milk
- [ ] 

## 🧴 Household
- [ ] 

## 💰 Budget
> _____
`,
        es: `# 🛒 Lista de compras

## 🥦 Frutas y verduras
- [ ] 
- [ ] 

## 🥖 Básicos
- [ ] Pan
- [ ] Leche
- [ ] 

## 🧴 Hogar
- [ ] 

## 💰 Presupuesto
> _____
`,
        zh: `# 🛒 购物清单

## 🥦 蔬果
- [ ] 
- [ ] 

## 🥖 主食
- [ ] 面包
- [ ] 牛奶
- [ ] 

## 🧴 家居
- [ ] 

## 💰 预算
> _____
`,
      },
      tags: ['shopping', 'تسوق'],
    },
    {
      id: 'weekly-plan',
      icon: '🗓️',
      name: {
        ar: 'خطة الأسبوع',
        en: 'Weekly Plan',
        es: 'Plan semanal',
        zh: '周计划',
      },
      description: {
        ar: 'أهداف الأسبوع وتوزيع الأيام',
        en: 'Weekly goals and daily breakdown',
        es: 'Metas semanales y desglose diario',
        zh: '每周目标与每日安排',
      },
      content: {
        ar: `# 🗓️ خطة الأسبوع

## 🎯 أهم 3 أهداف هذا الأسبوع
1. 
2. 
3. 

## 📅 توزيع الأيام
**الإثنين:** 
**الثلاثاء:** 
**الأربعاء:** 
**الخميس:** 
**الجمعة:** 
**السبت:** 
**الأحد:** راحة ومراجعة

## 🔁 مراجعة نهاية الأسبوع
- ما الذي أنجزته؟ 
- ما الذي يُرحَّل للأسبوع القادم؟ 
`,
        en: `# 🗓️ Weekly Plan

## 🎯 Top 3 Goals
1. 
2. 
3. 

## 📅 Daily Breakdown
**Mon:** 
**Tue:** 
**Wed:** 
**Thu:** 
**Fri:** 
**Sat:** 
**Sun:** Rest & review

## 🔁 End-of-week Review
- What got done? 
- What rolls over? 
`,
        es: `# 🗓️ Plan semanal

## 🎯 3 metas principales
1. 
2. 
3. 

## 📅 Por día
**Lun:** 
**Mar:** 
**Mié:** 
**Jue:** 
**Vie:** 
**Sáb:** 
**Dom:** Descanso y revisión

## 🔁 Revisión semanal
- ¿Qué se logró? 
- ¿Qué pasa a la próxima semana? 
`,
        zh: `# 🗓️ 周计划

## 🎯 本周三大目标
1. 
2. 
3. 

## 📅 每日安排
**周一:** 
**周二:** 
**周三:** 
**周四:** 
**周五:** 
**周六:** 
**周日:** 休息与回顾

## 🔁 周末回顾
- 完成了什么？
- 顺延什么？
`,
      },
      tags: ['planning', 'تخطيط'],
    },
  ];
}
