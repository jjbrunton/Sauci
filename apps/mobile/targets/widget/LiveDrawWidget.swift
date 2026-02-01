import WidgetKit
import SwiftUI

struct LiveDrawEntry: TimelineEntry {
    let date: Date
    let image: UIImage?
}

struct LiveDrawProvider: TimelineProvider {
    let suiteName = "group.com.sauci.app"
    let dataKey = "LiveDrawImage"

    func placeholder(in context: Context) -> LiveDrawEntry {
        LiveDrawEntry(date: Date(), image: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (LiveDrawEntry) -> Void) {
        completion(getEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LiveDrawEntry>) -> Void) {
        let entry = getEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func getEntry() -> LiveDrawEntry {
        guard let suite = UserDefaults(suiteName: suiteName),
              let base64 = suite.string(forKey: dataKey),
              let imageData = Data(base64Encoded: base64),
              let image = UIImage(data: imageData)
        else {
            return LiveDrawEntry(date: Date(), image: nil)
        }
        return LiveDrawEntry(date: Date(), image: image)
    }
}

struct LiveDrawWidgetEntryView: View {
    var entry: LiveDrawProvider.Entry

    var body: some View {
        if let image = entry.image {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        } else {
            ZStack {
                Color(red: 26/255, green: 26/255, blue: 46/255)
                VStack(spacing: 8) {
                    Image(systemName: "pencil.tip.crop.circle")
                        .font(.system(size: 32))
                        .foregroundColor(.white.opacity(0.5))
                    Text("Draw together")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
        }
    }
}

struct LiveDrawWidget: Widget {
    let kind: String = "LiveDrawWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LiveDrawProvider()) { entry in
            if #available(iOS 17.0, *) {
                LiveDrawWidgetEntryView(entry: entry)
                    .widgetURL(URL(string: "app.sauci://live-draw"))
                    .containerBackground(Color(red: 26/255, green: 26/255, blue: 46/255), for: .widget)
            } else {
                LiveDrawWidgetEntryView(entry: entry)
                    .widgetURL(URL(string: "app.sauci://live-draw"))
            }
        }
        .configurationDisplayName("Live Draw")
        .description("See your shared drawing with your partner.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
