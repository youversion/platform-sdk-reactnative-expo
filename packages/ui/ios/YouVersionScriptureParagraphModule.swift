import ExpoModulesCore

public class YouVersionScriptureParagraphModule: Module {
  public func definition() -> ModuleDefinition {
    Name("YouVersionScriptureParagraph")

    View(YouVersionScriptureParagraphView.self) {
      Events("onSizeChange", "onVersePress", "onFootnotePress")

      Prop("runs") { (view: YouVersionScriptureParagraphView, runs: [ScriptureRun]) in
        view.update(runs: runs)
      }
      Prop("firstIndent") { (view: YouVersionScriptureParagraphView, value: Double) in
        view.update(firstIndent: value)
      }
      Prop("restIndent") { (view: YouVersionScriptureParagraphView, value: Double) in
        view.update(restIndent: value)
      }
      Prop("lineHeightMultiple") { (view: YouVersionScriptureParagraphView, value: Double) in
        view.update(lineHeightMultiple: value)
      }
    }
  }
}
