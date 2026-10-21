/**
 * ttsPlayer.ts — مشغّل نطق بمقاطع، يدعم الإيقاف والاستئناف
 * ───────────────────────────────────────────────────────────────────────
 * لماذا طبقة فوق speak() بدل تعديلها
 * ──────────────────────────────────
 * `speak()` تنطق نصّاً واحداً دفعةً واحدة، ولا تملك إيقافاً مؤقّتاً — فقط
 * إلغاء. وهذا يفرض ثلاثة قيود كانت كلّها ظاهرة للمستخدم:
 *
 *   1. لا استئناف. إيقاف النطق يعني البدء من أوّل النصّ مرّة أخرى.
 *   2. النصّ الطويل يتجاوز مهلة Gemini (أكثر من ~1200 حرف) فيسقط إلى
 *      محرّك الجهاز بعد انتظار طويل — أي أن صوت Gemini لا يُسمع أصلاً
 *      في الملاحظات الطويلة.
 *   3. لا يمكن نطق محادثة كاملة: هي نصوص متعدّدة لا نصّ واحد.
 *
 * التقطيع يحلّ الثلاثة معاً: كل مقطع قصير بما يكفي ليُولَّد بسرعة، وموضع
 * المقطع هو نفسه موضع الاستئناف، وسلسلة المقاطع تقبل محادثة بأكملها.
 *
 * والاستئناف على مستويين عن قصد:
 *   • داخل المقطع — حين يدعمه المحرّك (عنصر <audio> لصوت Gemini،
 *     و speechSynthesis في المتصفح): استئناف دقيق من الثانية نفسها.
 *   • على مستوى المقطع — لمحرّك أندرويد الأصلي، فهو لا يملك إيقافاً
 *     مؤقّتاً إطلاقاً. فنُعيد تشغيل المقطع الذي توقّفنا عنده.
 * فيبقى السلوك واحداً عند المستخدم مهما اختلف المحرّك تحته.
 */
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking } from './tts';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused';

export interface PlayerOptions {
  lang?: string;
  style?: string;
  voiceName?: string;
  rate?: number;
  pitch?: number;
  /**
   * مَن طلب هذا التشغيل.
   *
   * ⚠️ ضروري لا تجميلي: المشغّل واحد في التطبيق كلّه، وأزرار الاستماع
   * كثيرة (واحد تحت كل ردّ، وواحد في أعلى كل نافذة). فبلا مالكٍ معروف
   * تُضيء كلّها معاً عند أي تشغيل، ويصير «إيقاف» أيّها إيقافاً للآخر.
   */
  owner?: string;
}

/**
 * الحدّ الأقصى لطول المقطع.
 *
 * ⚠️ ليس رقماً اعتباطياً: مهلة طلب الصوت في العميل 45 ثانية، وتوليد
 * صوت Gemini يتناسب مع طول النصّ. وقد قيس أن ~1200 حرف عربي تقارب
 * الحدّ، فنأخذ 700 هامشاً مريحاً — ومقطعٌ أقصر يعني كذلك أوّل صوت
 * يُسمَع أسرع.
 */
const MAX_CHUNK = 700;

/**
 * يُقطّع النصّ عند حدود الجُمل.
 *
 * القطع عند حدّ أحرف أعمى يبتر الجملة في منتصفها، فيخرج الصوت مقطوعاً
 * بلا معنى. لذلك نقطع عند علامات نهاية الجملة أولاً (عربية ولاتينية)،
 * ثم عند الفواصل، ثم عند المسافات — والأخير فقط لجملة واحدة طويلة
 * بلا أي علامة.
 */
export function splitIntoChunks(raw: string, max = MAX_CHUNK): string[] {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  if (text.length <= max) return [text];

  // الفاصل يبقى ملتصقاً بالجملة التي ينهيها.
  // ⚠️ بلا lookbehind عمداً: هدف البناء يشمل chrome61، و (?<=) يحتاج 62.
  // قاعدةٌ تعمل في المتصفحات الحديثة وتنهار في WebView قديم ليست قاعدة.
  const sentences = (text.match(/[^.!?؟۔:；;]+[.!?؟۔:；;]*\s*/g) ?? [text])
    .map(s => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buf = '';

  const flush = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ''; };

  for (const s of sentences) {
    if (s.length > max) {
      // جملة واحدة أطول من الحدّ: نقطعها عند الفواصل ثم المسافات
      flush();
      let rest = s;
      while (rest.length > max) {
        const window = rest.slice(0, max);
        const at = Math.max(
          window.lastIndexOf('، '), window.lastIndexOf(', '),
          window.lastIndexOf('؛ '), window.lastIndexOf(' — '),
        );
        const cut = at > max * 0.5 ? at + 1 : window.lastIndexOf(' ');
        const idx = cut > 0 ? cut : max;
        chunks.push(rest.slice(0, idx).trim());
        rest = rest.slice(idx).trim();
      }
      if (rest) buf = rest;
      continue;
    }
    if ((buf + ' ' + s).trim().length > max) flush();
    buf = buf ? `${buf} ${s}` : s;
  }
  flush();
  return chunks.filter(Boolean);
}

// ─── الحالة ────────────────────────────────────────────────────────────
let _chunks: string[] = [];
let _index = 0;
let _state: PlayerState = 'idle';
let _opts: PlayerOptions = {};
/**
 * عدّاد الأجيال — حارسٌ ضدّ التسابق.
 * تشغيلٌ جديد يبدأ بينما القديم ما زال ينتظر انتهاء مقطعه. فبلا هذا
 * العدّاد يُكمل القديمُ سلسلتَه فوق الجديد — صوتان معاً.
 */
let _gen = 0;
/** يُسوّي وعد المقطع الجاري عند الإيقاف القسري. */
let _settleCurrent: ((finished: boolean) => void) | null = null;

const _subs = new Set<(s: PlayerState, i: number, total: number) => void>();

function emit(): void {
  for (const fn of _subs) {
    try { fn(_state, _index, _chunks.length); } catch { /* مشترك واحد لا يُسقط البقية */ }
  }
}

export function subscribe(fn: (s: PlayerState, i: number, total: number) => void): () => void {
  _subs.add(fn);
  fn(_state, _index, _chunks.length);
  return () => { _subs.delete(fn); };
}

/**
 * قراءة الحالة عبر دالّة لا مباشرةً.
 *
 * ⚠️ ليس تجميلاً: داخل الحلقة نُسند `_state = 'loading'` ثم ننتظر
 * انتهاء المقطع. ويستنتج المدقّق أن النوع بقي 'loading'، فيَعدّ فحص
 * `_state === 'paused'` بعد الـawait مستحيلاً — وهو ليس كذلك: pause()
 * تُبدّله أثناء الانتظار. القراءة عبر دالّة تمنع هذا التضييق الخاطئ،
 * وتُبقي الفحص الذي يمنع استئناف الحلقة بعد التجميد.
 */
export const getState = (): PlayerState => _state;
/** مَن يملك التشغيل الجاري (انظر PlayerOptions.owner). */
export const getOwner = (): string | null => _opts.owner ?? null;

/** ينطق مقطعاً واحداً وينتظر انتهاءه فعلياً (لا بدايته). */
function speakChunk(text: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      _settleCurrent = null;
      clearTimeout(guard);
      resolve(v);
    };
    _settleCurrent = finish;

    // ⚠️ حارس زمني: لو لم يُطلق المحرّك onEnd (يقع فعلاً في بعض محرّكات
    // أندرويد) لبقي المشغّل منتظراً إلى الأبد والزرّ معلّقاً. التقدير
    // سخيّ: ~95 مللي لكل حرف + 15 ثانية هامشاً.
    const guard = setTimeout(() => finish(true), text.length * 95 + 15_000);

    void speak({
      text,
      lang: _opts.lang,
      style: _opts.style,
      voiceName: _opts.voiceName,
      rate: _opts.rate,
      pitch: _opts.pitch,
      onEnd: () => finish(true),
      onError: () => finish(false),
    }).then((started) => { if (!started) finish(false); });
  });
}

async function runLoop(gen: number): Promise<void> {
  while (_index < _chunks.length) {
    if (gen !== _gen) return;                    // أُلغي أو استُبدل
    if (getState() === 'paused') return;         // ينتظر resume()

    _state = 'loading'; emit();
    const chunk = _chunks[_index];
    const okPromise = speakChunk(chunk);

    // الحالة تصير "يعمل" فور بدء النطق — المهلة القصيرة تكفي لأن
    // speak() تُرجع بعد بدء التشغيل لا بعد انتهائه.
    setTimeout(() => {
      if (gen === _gen && getState() === 'loading') { _state = 'playing'; emit(); }
    }, 120);

    const ok = await okPromise;
    if (gen !== _gen) return;
    if (getState() === 'paused') return;          // أُوقف أثناء هذا المقطع
    if (!ok) { stop(); return; }                  // فشل النطق — لا نُكمل بصمت

    _index += 1;
    emit();
  }
  // انتهت السلسلة
  if (gen === _gen) { _state = 'idle'; _index = 0; _chunks = []; emit(); }
}

/** يبدأ نطق نصّ (أو نصوص) من أوّله. */
export async function play(text: string | string[], opts: PlayerOptions = {}): Promise<void> {
  await stop();
  const parts = Array.isArray(text) ? text : [text];
  _chunks = parts.flatMap(p => splitIntoChunks(p));
  if (!_chunks.length) return;
  _opts = opts;
  _index = 0;
  _state = 'loading';
  emit();
  const gen = ++_gen;
  void runLoop(gen);
}

/**
 * يُجمّد النطق.
 * إن لم يدعم المحرّك التجميد (أندرويد الأصلي) نُلغي المقطع الجاري
 * ونُبقي مؤشّره — فالاستئناف يُعيده من أوّله لا من أوّل النصّ.
 */
export function pause(): void {
  if (_state !== 'playing' && _state !== 'loading') return;
  _state = 'paused';
  const frozen = pauseSpeaking();
  if (!frozen) {
    void stopSpeaking();
    _settleCurrent?.(false);   // يحرّر الحلقة؛ المؤشّر يبقى على مقطعه
  }
  emit();
}

/** يستأنف من حيث توقّف. */
export function resume(): void {
  if (_state !== 'paused') return;
  const inner = resumeSpeaking();
  _state = 'playing';
  emit();
  if (!inner) {
    // المحرّك لا يستأنف داخلياً — نُعيد تشغيل المقطع الموقوف
    const gen = ++_gen;
    void runLoop(gen);
  }
}

/** يوقف كلّ شيء ويعود للبداية. */
export async function stop(): Promise<void> {
  _gen += 1;                 // يُبطل أي حلقة جارية
  _settleCurrent?.(false);
  _state = 'idle';
  _index = 0;
  _chunks = [];
  _opts = {};                // وإلا بقي المالك قديماً بعد التوقّف
  emit();
  await stopSpeaking();
}

/** زرّ واحد: يشغّل / يُجمّد / يستأنف حسب الحالة. */
export async function toggle(text: string | string[], opts: PlayerOptions = {}): Promise<void> {
  if (_state === 'playing' || _state === 'loading') { pause(); return; }
  if (_state === 'paused') { resume(); return; }
  await play(text, opts);
}
