import ExpoModulesCore
import UIKit

/// One styled run of scripture text, serialized from the JS renderer. Mirrors
/// `ScriptureRun` in the JS binding.
struct ScriptureRun: Record {
  @Field var text: String = ""
  @Field var fontSize: Double = 16
  @Field var fontFamily: String?
  @Field var color: String?
  @Field var bold: Bool = false
  @Field var italic: Bool = false
  @Field var smallCaps: Bool = false
  /// Baseline shift as a fraction of `fontSize` (positive = up, for superscripts).
  @Field var baselineShiftEm: Double = 0
  /// Render the note-bubble footnote icon for this run (text is empty).
  @Field var footnote: Bool = false
  /// Footnote index reported on tap.
  @Field var footnoteIndex: Int = 0
}

/// Custom attribute marking a footnote attachment's index, read back on tap.
private let footnoteIndexKey = NSAttributedString.Key("yvFootnoteIndex")

/// Renders scripture runs in a non-scrolling `UITextView` with a hanging indent via
/// `NSParagraphStyle.firstLineHeadIndent`/`headIndent` (ADR 0010/0011). Footnote markers
/// render as the web SDK's note-bubble icon (an inline `NSTextAttachment`) and are
/// tappable (character hit-testing → `onFootnotePress`). Self-measures its height and
/// reports it via `onSizeChange`.
final class YouVersionScriptureParagraphView: ExpoView {
  private let textView = UITextView()
  let onSizeChange = EventDispatcher()
  let onVersePress = EventDispatcher()
  let onFootnotePress = EventDispatcher()

  private var runs: [ScriptureRun] = []
  private var firstIndent: CGFloat = 0
  private var restIndent: CGFloat = 0
  private var lineHeightMultiple: CGFloat = 1
  private var lastHeight: CGFloat = -1
  // Measure exactly once per content. Any later layout pass (e.g. the footnote sheet
  // animating open, or a width wobble during it) is ignored, so the reported height
  // never drifts and the reader can't shift. Reset only when the content changes.
  private var hasMeasured = false
  private var runsSignature = ""
  // Footnote marker hit rects (in textView coords), computed once during the measure
  // pass. Tapping reads these instead of querying the live layout manager — querying it
  // forces a glyph re-layout that nudges the text (the actual cause of the shift).
  private var footnoteRects: [(rect: CGRect, index: Int)] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    textView.isEditable = false
    textView.isScrollEnabled = false
    textView.isSelectable = false
    // A UITextView is a scroll view; by default it adjusts its content inset for safe
    // areas. When the footnote sheet opens and iOS recomputes safe-area insets, that
    // pushes the text down inside the (fixed-height) view — making the reader appear to
    // shift. Disable the auto-adjustment so content position stays put. (ADR 0011)
    textView.contentInsetAdjustmentBehavior = .never
    textView.backgroundColor = .clear
    textView.textContainerInset = .zero
    textView.textContainer.lineFragmentPadding = 0
    addSubview(textView)
    textView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    let point = gesture.location(in: textView)
    // Read cached marker rects — do NOT query the layout manager here; that re-ensures
    // layout and shifts the text (ADR 0011). Pad the rect for an easier touch target.
    for marker in footnoteRects where marker.rect.insetBy(dx: -8, dy: -8).contains(point) {
      onFootnotePress(["index": marker.index])
      return
    }
    onVersePress([:])
  }

  /// Cache each footnote marker's rect. Call only while layout is already being computed
  /// (the measure pass), never on tap, so it never causes a visible re-layout.
  private func computeFootnoteRects() {
    var rects: [(CGRect, Int)] = []
    let storage = textView.textStorage
    let full = NSRange(location: 0, length: storage.length)
    storage.enumerateAttribute(footnoteIndexKey, in: full) { value, range, _ in
      guard let index = value as? Int else { return }
      let glyphRange = textView.layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
      var rect = textView.layoutManager.boundingRect(forGlyphRange: glyphRange, in: textView.textContainer)
      rect.origin.x += textView.textContainerInset.left
      rect.origin.y += textView.textContainerInset.top
      rects.append((rect, index))
    }
    footnoteRects = rects
  }

  func update(runs: [ScriptureRun]) {
    // The renderer hands us a new array with identical content on every re-render (e.g.
    // a footnote-tap re-render). Skip the rebuild + re-measure when nothing changed.
    let signature = runs.map {
      "\($0.text)\u{1}\($0.fontSize)\u{1}\($0.bold)\u{1}\($0.italic)\u{1}\($0.smallCaps)"
        + "\u{1}\($0.baselineShiftEm)\u{1}\($0.color ?? "")\u{1}\($0.fontFamily ?? "")"
        + "\u{1}\($0.footnote)\u{1}\($0.footnoteIndex)"
    }.joined(separator: "\u{2}")
    if signature == runsSignature { return }
    runsSignature = signature
    self.runs = runs
    rebuild()
  }
  func update(firstIndent value: Double) { firstIndent = CGFloat(value); rebuild() }
  func update(restIndent value: Double) { restIndent = CGFloat(value); rebuild() }
  func update(lineHeightMultiple value: Double) { lineHeightMultiple = CGFloat(value); rebuild() }

  private func font(for run: ScriptureRun) -> UIFont {
    let size = CGFloat(run.fontSize)
    var font: UIFont
    if let family = run.fontFamily, let custom = UIFont(name: family, size: size) {
      font = custom
    } else {
      var traits: UIFontDescriptor.SymbolicTraits = []
      if run.bold { traits.insert(.traitBold) }
      if run.italic { traits.insert(.traitItalic) }
      let system = UIFont.systemFont(ofSize: size)
      font = system.fontDescriptor.withSymbolicTraits(traits)
        .map { UIFont(descriptor: $0, size: size) } ?? system
    }
    if run.smallCaps {
      let feature: [UIFontDescriptor.FeatureKey: Int] = [
        .featureIdentifier: kLowerCaseType,
        .typeIdentifier: kLowerCaseSmallCapsSelector,
      ]
      let desc = font.fontDescriptor.addingAttributes([.featureSettings: [feature]])
      font = UIFont(descriptor: desc, size: size)
    }
    return font
  }

  private func footnoteAttachment(_ run: ScriptureRun) -> NSAttributedString {
    let color = run.color.flatMap { UIColor(scriptureHex: $0) } ?? .gray
    let size = CGFloat(run.fontSize) * 1.4 // ~web 1.5em note bubble
    let attachment = NSTextAttachment()
    attachment.image = FootnoteIcon.image(size: size, color: color)
    // Center the bubble on the line (it is not superscripted in the web reader).
    attachment.bounds = CGRect(x: 0, y: -size * 0.2, width: size, height: size)
    let string = NSMutableAttributedString(attachment: attachment)
    string.addAttribute(footnoteIndexKey, value: run.footnoteIndex, range: NSRange(location: 0, length: string.length))
    return string
  }

  private func rebuild() {
    // Reserve descender room *inside* the content (not by inflating the frame), so the
    // bottom tips of y/g/p aren't clipped at the view's edge and the line doesn't shift
    // on tap. ~0.15em of the largest run; tune on device.
    let descenderPad = ceil(CGFloat(runs.map(\.fontSize).max() ?? 16) * 0.15)
    textView.textContainerInset = UIEdgeInsets(top: 0, left: 0, bottom: descenderPad, right: 0)

    let paragraph = NSMutableParagraphStyle()
    paragraph.firstLineHeadIndent = firstIndent
    paragraph.headIndent = restIndent
    if lineHeightMultiple > 0 { paragraph.lineHeightMultiple = lineHeightMultiple }

    let string = NSMutableAttributedString()
    for run in runs {
      if run.footnote {
        string.append(footnoteAttachment(run))
        continue
      }
      var attrs: [NSAttributedString.Key: Any] = [.font: font(for: run)]
      if let hex = run.color, let color = UIColor(scriptureHex: hex) {
        attrs[.foregroundColor] = color
      }
      if run.baselineShiftEm != 0 {
        // iOS `.baselineOffset`: positive = up, matching our convention directly.
        attrs[.baselineOffset] = CGFloat(run.baselineShiftEm) * CGFloat(run.fontSize)
      }
      string.append(NSAttributedString(string: run.text, attributes: attrs))
    }
    string.addAttribute(
      .paragraphStyle, value: paragraph, range: NSRange(location: 0, length: string.length)
    )
    textView.attributedText = string
    hasMeasured = false // content/layout changed — allow one fresh measure
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    let width = bounds.width
    guard width > 0 else { return }
    // Measure once per content. Ignore every later layout pass — the footnote sheet
    // animating open triggers layout passes (and width wobbles) that otherwise make
    // UITextView.sizeThatFits drift taller and shift the reader (ADR 0011).
    if hasMeasured { return }
    hasMeasured = true
    // Descender room is reserved inside the content via `textContainerInset.bottom`
    // (see rebuild), so the fitted size already includes it — report it as-is.
    let height = ceil(textView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height)
    // Layout is now ensured by sizeThatFits — safe to read glyph rects for hit-testing
    // here (not on tap).
    computeFootnoteRects()
    if abs(height - lastHeight) > 0.5 {
      lastHeight = height
      onSizeChange(["height": Double(height)])
    }
  }
}

/// Draws the web SDK's note-bubble footnote icon (the same 24×24 path as the JS
/// `FootnoteMarkerIcon`) into a tinted `UIImage`. The path uses only absolute M/L/H/V/C/Z
/// commands with positive coordinates, so a minimal parser suffices.
private enum FootnoteIcon {
  // Keep in sync with FOOTNOTE_ICON_PATH in scripture-footnote-icon.tsx.
  static let pathData =
    "M5.00033 4.16667C4.09255 4.16667 3.33366 4.92556 3.33366 5.83333V12.5C3.33366 13.4078 4.09255 14.1667 5.00033 14.1667H6.66699C7.12723 14.1667 7.50033 14.5398 7.50033 15V16.0282L10.4049 14.2854C10.5344 14.2077 10.6826 14.1667 10.8337 14.1667H15.0003C15.9081 14.1667 16.667 13.4078 16.667 12.5V5.83333C16.667 4.92556 15.9081 4.16667 15.0003 4.16667H5.00033ZM5.00033 2.5H15.0003C16.8159 2.5 18.3337 4.01778 18.3337 5.83333V12.5C18.3337 14.3156 16.8159 15.8333 15.0003 15.8333H11.0645L7.09574 18.2146C6.55059 18.5417 5.83366 18.1357 5.83366 17.5V15.8333H5.00033C3.18477 15.8333 1.66699 14.3156 1.66699 12.5V5.83333C1.66699 4.01778 3.18477 2.5 5.00033 2.5ZM5.83366 7.5C5.83366 7.03976 6.20675 6.66667 6.66699 6.66667H13.3337C13.7939 6.66667 14.167 7.03976 14.167 7.5C14.167 7.96024 13.7939 8.33333 13.3337 8.33333H6.66699C6.20675 8.33333 5.83366 7.96024 5.83366 7.5ZM5.83366 10.8333C5.83366 10.3731 6.20675 10 6.66699 10H11.667C12.1272 10 12.5003 10.3731 12.5003 10.8333C12.5003 11.2936 12.1272 11.6667 11.667 11.6667H6.66699C6.20675 11.6667 5.83366 11.2936 5.83366 10.8333Z"

  static func image(size: CGFloat, color: UIColor) -> UIImage {
    let path = parse(scale: size / 24.0)
    path.usesEvenOddFillRule = true
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
    return renderer.image { _ in
      color.setFill()
      path.fill()
    }
  }

  private static func parse(scale: CGFloat) -> UIBezierPath {
    let path = UIBezierPath()
    var current = CGPoint.zero
    var command: Character = " "
    var numbers: [CGFloat] = []
    var buffer = ""

    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * scale, y: y * scale) }

    func execute() {
      switch command {
      case "M":
        var i = 0
        while i + 1 < numbers.count {
          let p = point(numbers[i], numbers[i + 1])
          if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
          current = p; i += 2
        }
      case "L":
        var i = 0
        while i + 1 < numbers.count {
          current = point(numbers[i], numbers[i + 1]); path.addLine(to: current); i += 2
        }
      case "H":
        for x in numbers { current = CGPoint(x: x * scale, y: current.y); path.addLine(to: current) }
      case "V":
        for y in numbers { current = CGPoint(x: current.x, y: y * scale); path.addLine(to: current) }
      case "C":
        var i = 0
        while i + 5 < numbers.count {
          path.addCurve(
            to: point(numbers[i + 4], numbers[i + 5]),
            controlPoint1: point(numbers[i], numbers[i + 1]),
            controlPoint2: point(numbers[i + 2], numbers[i + 3])
          )
          current = point(numbers[i + 4], numbers[i + 5]); i += 6
        }
      case "Z":
        path.close()
      default:
        break
      }
    }

    func flushNumber() {
      if !buffer.isEmpty { numbers.append(CGFloat(Double(buffer) ?? 0)); buffer = "" }
    }

    for ch in pathData {
      if ch.isLetter {
        flushNumber()
        if command != " " { execute() }
        command = ch
        numbers = []
      } else if ch == " " || ch == "," {
        flushNumber()
      } else {
        buffer.append(ch)
      }
    }
    flushNumber()
    if command != " " { execute() }
    return path
  }
}

private extension UIColor {
  /// Parse `#RGB`-style hex (`#rrggbb` or `#rrggbbaa`) as emitted by the renderer palette.
  convenience init?(scriptureHex hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard let v = UInt64(s, radix: 16) else { return nil }
    let r, g, b, a: CGFloat
    if s.count == 8 {
      r = CGFloat((v >> 24) & 0xff) / 255; g = CGFloat((v >> 16) & 0xff) / 255
      b = CGFloat((v >> 8) & 0xff) / 255;  a = CGFloat(v & 0xff) / 255
    } else {
      r = CGFloat((v >> 16) & 0xff) / 255; g = CGFloat((v >> 8) & 0xff) / 255
      b = CGFloat(v & 0xff) / 255;          a = 1
    }
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}
