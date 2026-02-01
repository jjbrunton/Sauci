import ExpoModulesCore
import WidgetKit

public class WidgetBridgeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("WidgetBridge")

        Function("setWidgetData") { (key: String, value: String) in
            let suite = UserDefaults(suiteName: "group.com.sauci.app")
            suite?.set(value, forKey: key)
        }

        Function("reloadWidgets") {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
}
