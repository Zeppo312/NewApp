import SwiftUI
import WidgetKit

// MARK: - Home Screen Quick-Launch Widget

struct QuickLaunchEntry: TimelineEntry {
    let date: Date
}

struct QuickLaunchProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickLaunchEntry {
        QuickLaunchEntry(date: Date())
    }
    func getSnapshot(in context: Context, completion: @escaping (QuickLaunchEntry) -> Void) {
        completion(QuickLaunchEntry(date: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickLaunchEntry>) -> Void) {
        completion(Timeline(entries: [QuickLaunchEntry(date: Date())], policy: .never))
    }
}

private struct QuickActionButton: View {
    let emoji: String
    let label: String
    let url: URL

    var body: some View {
        Link(destination: url) {
            VStack(spacing: 5) {
                Text(emoji)
                    .font(.system(size: 38))
                    .minimumScaleFactor(0.7)
                Text(label)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// Small: 2×2 grid
private struct QuickLaunchSmallView: View {
    var body: some View {
        LazyVGrid(
            columns: [GridItem(.flexible()), GridItem(.flexible())],
            spacing: 14
        ) {
            QuickActionButton(
                emoji: "🌙",
                label: "Schlaf",
                url: URL(string: "com.lottibaby.app://sleep-tracker?autoStart=1")!
            )
            QuickActionButton(
                emoji: "🤱",
                label: "Stillen",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=feeding_breast")!
            )
            QuickActionButton(
                emoji: "🍼",
                label: "Flasche",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=feeding_bottle")!
            )
            QuickActionButton(
                emoji: "💩",
                label: "Windel",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=diaper_both")!
            )
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "com.lottibaby.app://")!)
    }
}

// Medium: single row of 5
private struct QuickLaunchMediumView: View {
    var body: some View {
        HStack(spacing: 6) {
            QuickActionButton(
                emoji: "🌙",
                label: "Schlaf",
                url: URL(string: "com.lottibaby.app://sleep-tracker?autoStart=1")!
            )
            QuickActionButton(
                emoji: "🤱",
                label: "Stillen",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=feeding_breast")!
            )
            QuickActionButton(
                emoji: "🍼",
                label: "Flasche",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=feeding_bottle")!
            )
            QuickActionButton(
                emoji: "🥄",
                label: "Beikost",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=feeding_solids")!
            )
            QuickActionButton(
                emoji: "💩",
                label: "Windel",
                url: URL(string: "com.lottibaby.app://daily_old?quickAction=diaper_both")!
            )
        }
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "com.lottibaby.app://")!)
    }
}

struct QuickLaunchWidgetEntryView: View {
    var entry: QuickLaunchEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            QuickLaunchSmallView()
        default:
            QuickLaunchMediumView()
        }
    }
}

private extension View {
    @ViewBuilder
    func quickLaunchContainerBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(.fill.tertiary, for: .widget)
        } else {
            self
        }
    }
}

struct QuickLaunchWidget: Widget {
    let kind = "LottiBabyQuickLaunch"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickLaunchProvider()) { entry in
            QuickLaunchWidgetEntryView(entry: entry)
                .quickLaunchContainerBackground()
        }
        .configurationDisplayName("Lotti Baby")
        .description("Schlaf, Stillen und Windel schnell erfassen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
