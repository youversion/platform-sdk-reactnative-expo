package expo.modules.youversion.scriptureparagraph

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.style.AbsoluteSizeSpan
import android.text.style.ForegroundColorSpan
import android.text.style.LeadingMarginSpan
import android.text.style.MetricAffectingSpan
import android.text.style.ReplacementSpan
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.TextView
import com.facebook.react.views.text.ReactFontManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** One styled run of scripture text, serialized from the JS renderer. */
class ScriptureRun : Record {
  @Field var text: String = ""
  @Field var fontSize: Double = 16.0
  @Field var fontFamily: String? = null
  @Field var color: String? = null
  @Field var bold: Boolean = false
  @Field var italic: Boolean = false
  @Field var smallCaps: Boolean = false
  /** Baseline shift as a fraction of fontSize (positive = up, for superscripts). */
  @Field var baselineShiftEm: Double = 0.0
  /** Render the note-bubble footnote icon for this run (text is empty). */
  @Field var footnote: Boolean = false
  /** Footnote index reported on tap. */
  @Field var footnoteIndex: Int = 0
}

/** Shifts a run off the baseline by a pixel amount (negative = up). */
private class BaselineShiftSpan(private val shiftPx: Int) : MetricAffectingSpan() {
  override fun updateDrawState(tp: TextPaint) { tp.baselineShift += shiftPx }
  override fun updateMeasureState(tp: TextPaint) { tp.baselineShift += shiftPx }
}

/** Applies a Typeface to a span range, preserving the paint's existing style bits.
 *  (android.text.style.TypefaceSpan(Typeface) requires API 28; min is 24.) */
private class TypefaceSpanCompat(private val typeface: Typeface) : MetricAffectingSpan() {
  override fun updateDrawState(tp: TextPaint) = apply(tp)
  override fun updateMeasureState(tp: TextPaint) = apply(tp)
  private fun apply(tp: TextPaint) {
    tp.typeface = Typeface.create(typeface, tp.typeface?.style ?: Typeface.NORMAL)
  }
}

/** Draws the note-bubble icon inline, vertically centered on the line, and carries the
 *  footnote index for tap hit-testing. */
private class FootnoteBubbleSpan(private val drawable: Drawable, val footnoteIndex: Int) :
  ReplacementSpan() {
  override fun getSize(
    paint: Paint, text: CharSequence?, start: Int, end: Int, fm: Paint.FontMetricsInt?
  ): Int = drawable.bounds.width()

  override fun draw(
    canvas: Canvas, text: CharSequence?, start: Int, end: Int,
    x: Float, top: Int, y: Int, bottom: Int, paint: Paint
  ) {
    val transY = top + (bottom - top - drawable.bounds.height()) / 2f
    canvas.save()
    canvas.translate(x, transY)
    drawable.draw(canvas)
    canvas.restore()
  }
}

/**
 * Renders scripture runs in a single TextView with a hanging indent via
 * `LeadingMarginSpan.Standard(first, rest)` — the faithful hang RN cannot express
 * (ADR 0010/0011). Footnote markers render as the web SDK's note-bubble icon (a
 * `ReplacementSpan` drawing the same path) and are tappable (touch → cached `Layout`
 * offset → `onFootnotePress`). Self-measures its height and reports it via `onSizeChange`.
 */
class YouVersionScriptureParagraphView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  private val onSizeChange by EventDispatcher()
  private val onVersePress by EventDispatcher()
  private val onFootnotePress by EventDispatcher()
  private val textView = TextView(context)

  private var runs: List<ScriptureRun> = emptyList()
  private var firstIndentDp: Double = 0.0
  private var restIndentDp: Double = 0.0
  private var lineHeightMultiple: Double = 1.0
  private var lastHeight = -1

  private val density get() = resources.displayMetrics.density

  init {
    textView.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
    )
    addView(textView)
    // Touch → cached-Layout offset → footnote bubble or verse. (`Layout` is immutable, so
    // reading it doesn't re-flow the text — none of the iOS hit-test shift applies here.)
    textView.setOnTouchListener { _, event ->
      if (event.action == MotionEvent.ACTION_UP) handleTouch(event.x, event.y)
      true
    }
  }

  private fun handleTouch(rawX: Float, rawY: Float) {
    val layout = textView.layout ?: run { onVersePress(mapOf()); return }
    val x = rawX - textView.totalPaddingLeft + textView.scrollX
    val y = rawY - textView.totalPaddingTop + textView.scrollY
    val line = layout.getLineForVertical(y.toInt())
    val offset = layout.getOffsetForHorizontal(line, x)
    val text = textView.text
    if (text is Spanned) {
      val from = if (offset > 0) offset - 1 else 0
      val spans = text.getSpans(from, offset + 1, FootnoteBubbleSpan::class.java)
      if (spans.isNotEmpty()) {
        onFootnotePress(mapOf("index" to spans[0].footnoteIndex))
        return
      }
    }
    onVersePress(mapOf())
  }

  fun setRuns(value: List<ScriptureRun>) { runs = value; rebuild() }
  fun setFirstIndent(value: Double) { firstIndentDp = value; rebuild() }
  fun setRestIndent(value: Double) { restIndentDp = value; rebuild() }
  fun setLineHeightMultiple(value: Double) { lineHeightMultiple = value; rebuild() }

  private fun typeface(run: ScriptureRun): Typeface? {
    val style = when {
      run.bold && run.italic -> Typeface.BOLD_ITALIC
      run.bold -> Typeface.BOLD
      run.italic -> Typeface.ITALIC
      else -> Typeface.NORMAL
    }
    val family = run.fontFamily ?: return Typeface.defaultFromStyle(style)
    // Fonts loaded via expo-font register with ReactFontManager under their JS family
    // name (e.g. "SourceSerif4_400Regular"), so a raw TextView can resolve them here.
    return try {
      ReactFontManager.getInstance().getTypeface(family, style, context.assets)
    } catch (e: Throwable) {
      Typeface.defaultFromStyle(style)
    }
  }

  private fun parseColor(hex: String?): Int? =
    try { hex?.let { Color.parseColor(it) } } catch (e: Throwable) { null }

  private fun footnoteDrawable(run: ScriptureRun): Drawable {
    val sizePx = (run.fontSize * 1.4 * density).toInt() // ~web 1.5em bubble
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.style = Paint.Style.FILL
      this.color = parseColor(run.color) ?: Color.GRAY
    }
    canvas.drawPath(FootnoteIcon.path(sizePx / 24f), paint)
    return BitmapDrawable(resources, bitmap).apply { setBounds(0, 0, sizePx, sizePx) }
  }

  private fun rebuild() {
    val sb = SpannableStringBuilder()
    val flag = Spannable.SPAN_INCLUSIVE_EXCLUSIVE
    for (run in runs) {
      val start = sb.length
      if (run.footnote) {
        sb.append("￼") // object-replacement char; the span draws the bubble over it
        sb.setSpan(FootnoteBubbleSpan(footnoteDrawable(run), run.footnoteIndex), start, sb.length, flag)
        continue
      }
      // Android has no small-caps span; approximate with uppercase (small caps is
      // iOS-only — matches the existing RN gap). Real text otherwise (i18n-safe).
      sb.append(if (run.smallCaps) run.text.uppercase() else run.text)
      val end = sb.length
      sb.setSpan(AbsoluteSizeSpan(run.fontSize.toInt(), true), start, end, flag) // dip = true
      typeface(run)?.let { sb.setSpan(TypefaceSpanCompat(it), start, end, flag) }
      parseColor(run.color)?.let { sb.setSpan(ForegroundColorSpan(it), start, end, flag) }
      if (run.baselineShiftEm != 0.0) {
        // Android `baselineShift`: negative = up (opposite of iOS) — negate to honour
        // our positive-is-up convention.
        val shiftPx = (-run.baselineShiftEm * run.fontSize * density).toInt()
        sb.setSpan(BaselineShiftSpan(shiftPx), start, end, flag)
      }
    }
    val first = (firstIndentDp * density).toInt()
    val rest = (restIndentDp * density).toInt()
    sb.setSpan(
      LeadingMarginSpan.Standard(first, rest), 0, sb.length, Spannable.SPAN_INCLUSIVE_INCLUSIVE
    )
    if (lineHeightMultiple > 0) textView.setLineSpacing(0f, lineHeightMultiple.toFloat())
    textView.text = sb
    post { reportHeight() }
  }

  private fun reportHeight() {
    if (width <= 0) return
    textView.measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
    )
    val h = textView.measuredHeight
    if (h != lastHeight) {
      lastHeight = h
      onSizeChange(mapOf("height" to h / density)) // report in logical px
    }
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    super.onLayout(changed, l, t, r, b)
    if (changed) reportHeight()
  }
}

/**
 * Builds the web SDK's note-bubble footnote icon (the same 24×24 path as the JS
 * `FootnoteMarkerIcon`) as an `android.graphics.Path`. The path uses only absolute
 * M/L/H/V/C/Z commands with positive coordinates, so a minimal parser suffices.
 */
private object FootnoteIcon {
  // Keep in sync with FOOTNOTE_ICON_PATH in scripture-footnote-icon.tsx.
  private const val PATH_DATA =
    "M5.00033 4.16667C4.09255 4.16667 3.33366 4.92556 3.33366 5.83333V12.5C3.33366 13.4078 4.09255 14.1667 5.00033 14.1667H6.66699C7.12723 14.1667 7.50033 14.5398 7.50033 15V16.0282L10.4049 14.2854C10.5344 14.2077 10.6826 14.1667 10.8337 14.1667H15.0003C15.9081 14.1667 16.667 13.4078 16.667 12.5V5.83333C16.667 4.92556 15.9081 4.16667 15.0003 4.16667H5.00033ZM5.00033 2.5H15.0003C16.8159 2.5 18.3337 4.01778 18.3337 5.83333V12.5C18.3337 14.3156 16.8159 15.8333 15.0003 15.8333H11.0645L7.09574 18.2146C6.55059 18.5417 5.83366 18.1357 5.83366 17.5V15.8333H5.00033C3.18477 15.8333 1.66699 14.3156 1.66699 12.5V5.83333C1.66699 4.01778 3.18477 2.5 5.00033 2.5ZM5.83366 7.5C5.83366 7.03976 6.20675 6.66667 6.66699 6.66667H13.3337C13.7939 6.66667 14.167 7.03976 14.167 7.5C14.167 7.96024 13.7939 8.33333 13.3337 8.33333H6.66699C6.20675 8.33333 5.83366 7.96024 5.83366 7.5ZM5.83366 10.8333C5.83366 10.3731 6.20675 10 6.66699 10H11.667C12.1272 10 12.5003 10.3731 12.5003 10.8333C12.5003 11.2936 12.1272 11.6667 11.667 11.6667H6.66699C6.20675 11.6667 5.83366 11.2936 5.83366 10.8333Z"

  fun path(scale: Float): Path {
    val path = Path().apply { fillType = Path.FillType.EVEN_ODD }
    var curX = 0f
    var curY = 0f
    var command = ' '
    val numbers = ArrayList<Float>()
    val buffer = StringBuilder()

    fun execute() {
      when (command) {
        'M' -> {
          var i = 0
          while (i + 1 < numbers.size) {
            curX = numbers[i] * scale; curY = numbers[i + 1] * scale
            if (i == 0) path.moveTo(curX, curY) else path.lineTo(curX, curY); i += 2
          }
        }
        'L' -> {
          var i = 0
          while (i + 1 < numbers.size) {
            curX = numbers[i] * scale; curY = numbers[i + 1] * scale; path.lineTo(curX, curY); i += 2
          }
        }
        'H' -> for (n in numbers) { curX = n * scale; path.lineTo(curX, curY) }
        'V' -> for (n in numbers) { curY = n * scale; path.lineTo(curX, curY) }
        'C' -> {
          var i = 0
          while (i + 5 < numbers.size) {
            path.cubicTo(
              numbers[i] * scale, numbers[i + 1] * scale,
              numbers[i + 2] * scale, numbers[i + 3] * scale,
              numbers[i + 4] * scale, numbers[i + 5] * scale
            )
            curX = numbers[i + 4] * scale; curY = numbers[i + 5] * scale; i += 6
          }
        }
        'Z' -> path.close()
      }
    }

    fun flush() {
      if (buffer.isNotEmpty()) { numbers.add(buffer.toString().toFloat()); buffer.clear() }
    }

    for (ch in PATH_DATA) {
      when {
        ch.isLetter() -> { flush(); if (command != ' ') execute(); command = ch; numbers.clear() }
        ch == ' ' || ch == ',' -> flush()
        else -> buffer.append(ch)
      }
    }
    flush()
    if (command != ' ') execute()
    return path
  }
}
