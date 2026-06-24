package expo.modules.youversion.scriptureparagraph

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YouVersionScriptureParagraphModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YouVersionScriptureParagraph")

    View(YouVersionScriptureParagraphView::class) {
      Events("onSizeChange", "onVersePress", "onFootnotePress")

      Prop("runs") { view: YouVersionScriptureParagraphView, runs: List<ScriptureRun> ->
        view.setRuns(runs)
      }
      Prop("firstIndent") { view: YouVersionScriptureParagraphView, value: Double ->
        view.setFirstIndent(value)
      }
      Prop("restIndent") { view: YouVersionScriptureParagraphView, value: Double ->
        view.setRestIndent(value)
      }
      Prop("lineHeightMultiple") { view: YouVersionScriptureParagraphView, value: Double ->
        view.setLineHeightMultiple(value)
      }
    }
  }
}
