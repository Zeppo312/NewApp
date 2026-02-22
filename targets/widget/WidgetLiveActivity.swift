import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct SleepActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var isTracking: Bool
        var elapsedTimeText: String
        var quality: String?
        var feedingType: String?
    }

    var startTime: String
    var startTimestamp: Double?
    var elapsedTimeText: String?
    var babyName: String?
    var activityType: String?
    var feedingType: String?
}

@available(iOS 16.1, *)
private enum SleepActivityTheme {
    static let sleepAccent = Color(red: 0.45, green: 0.80, blue: 1.00)
    static let sleepAccentStrong = Color(red: 0.29, green: 0.66, blue: 0.96)
    static let feedingAccent = Color(red: 0.72, green: 0.50, blue: 0.92)
    static let feedingAccentStrong = Color(red: 0.62, green: 0.40, blue: 0.86)
    static let darkBgTop = Color(red: 0.09, green: 0.13, blue: 0.23)
    static let darkBgBottom = Color(red: 0.03, green: 0.05, blue: 0.10)
    static let sleepStopButton = Color(red: 0.95, green: 0.53, blue: 0.66)
    static let feedingStopButton = Color(red: 0.89, green: 0.44, blue: 0.70)
}

@available(iOS 16.1, *)
private enum SleepActivityDateParser {
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let internetDateTime: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ value: String) -> Date? {
        let normalized = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\"", with: "")
        if let date = withFractionalSeconds.date(from: normalized) {
            return date
        }
        if let date = internetDateTime.date(from: normalized) {
            return date
        }
        if let raw = TimeInterval(normalized) {
            return raw > 1_000_000_000_000
                ? Date(timeIntervalSince1970: raw / 1000.0)
                : Date(timeIntervalSince1970: raw)
        }
        return nil
    }

    static func parse(startTime: String, startTimestamp: Double?) -> Date? {
        if let startTimestamp, startTimestamp > 0 {
            return Date(timeIntervalSince1970: startTimestamp)
        }
        return parse(startTime)
    }
}

@available(iOS 16.1, *)
private enum LiveActivityKind: String {
    case sleep
    case feeding

    static func from(_ value: String?) -> LiveActivityKind {
        guard let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !normalized.isEmpty else {
            return .sleep
        }

        return LiveActivityKind(rawValue: normalized) ?? .sleep
    }
}

@available(iOS 16.1, *)
private enum FeedingKind: String {
    case breast = "BREAST"
    case bottle = "BOTTLE"
    case solids = "SOLIDS"

    static func from(_ value: String?) -> FeedingKind {
        guard let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(), !normalized.isEmpty else {
            return .breast
        }

        return FeedingKind(rawValue: normalized) ?? .breast
    }
}

@available(iOS 16.1, *)
private struct LiveActivityPresentation {
    let context: ActivityViewContext<SleepActivityAttributes>

    var kind: LiveActivityKind {
        LiveActivityKind.from(context.attributes.activityType)
    }

    var feedingKind: FeedingKind {
        FeedingKind.from(context.attributes.feedingType ?? context.state.feedingType)
    }

    var startDate: Date? {
        SleepActivityDateParser.parse(
            startTime: context.attributes.startTime,
            startTimestamp: context.attributes.startTimestamp
        )
    }

    var babyName: String {
        context.attributes.babyName ?? "Baby"
    }

    var trackerURL: URL {
        switch kind {
        case .sleep:
            return URL(string: "com.lottibaby.app://sleep-tracker")!
        case .feeding:
            return URL(string: "com.lottibaby.app://daily_old")!
        }
    }

    var stopURL: URL {
        switch kind {
        case .sleep:
            return URL(string: "com.lottibaby.app://sleep-tracker?liveStop=1")!
        case .feeding:
            return URL(string: "com.lottibaby.app://daily_old?liveStop=1&liveType=feeding")!
        }
    }

    var startTimeLabel: String {
        guard let startDate else { return "--:--" }
        return DateFormatter.activityStartFormatter.string(from: startDate)
    }

    var headerText: String {
        switch kind {
        case .sleep:
            return "\(babyName) schläft seit \(startTimeLabel)"
        case .feeding:
            return "\(feedingTitle) seit \(startTimeLabel)"
        }
    }

    var centerTitleText: String {
        switch kind {
        case .sleep:
            return "\(babyName) schläft"
        case .feeding:
            return feedingTitle
        }
    }

    var leadingSystemIcon: String {
        switch kind {
        case .sleep:
            return "moon.fill"
        case .feeding:
            return "heart.fill"
        }
    }

    var leadingEmoji: String {
        switch kind {
        case .sleep:
            return "\u{1F9F8}"
        case .feeding:
            switch feedingKind {
            case .breast:
                return "\u{1F931}"
            case .bottle:
                return "\u{1F37C}"
            case .solids:
                return "\u{1F944}"
            }
        }
    }

    var accent: Color {
        switch kind {
        case .sleep:
            return SleepActivityTheme.sleepAccent
        case .feeding:
            return SleepActivityTheme.feedingAccent
        }
    }

    var accentStrong: Color {
        switch kind {
        case .sleep:
            return SleepActivityTheme.sleepAccentStrong
        case .feeding:
            return SleepActivityTheme.feedingAccentStrong
        }
    }

    var stopButtonColor: Color {
        switch kind {
        case .sleep:
            return SleepActivityTheme.sleepStopButton
        case .feeding:
            return SleepActivityTheme.feedingStopButton
        }
    }

    var feedingTitle: String {
        switch feedingKind {
        case .breast:
            return "\(babyName) stillt"
        case .bottle:
            return "\(babyName) trinkt"
        case .solids:
            return "\(babyName) isst"
        }
    }
}

@available(iOS 16.1, *)
private struct SleepActivityMainView: View {
    let context: ActivityViewContext<SleepActivityAttributes>

    private var presentation: LiveActivityPresentation {
        LiveActivityPresentation(context: context)
    }

    var body: some View {
        ZStack {
            VStack(spacing: 6) {
                Text(presentation.headerText)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.70))

                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(.white.opacity(0.14))
                        Text(presentation.leadingEmoji)
                            .font(.system(size: 24))
                    }
                    .frame(width: 42, height: 42)
                    .accessibilityHidden(true)

                    Group {
                        if let startDate = presentation.startDate {
                            Text(startDate, style: .timer)
                        } else {
                            Text(context.state.elapsedTimeText)
                        }
                    }
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .frame(maxWidth: .infinity, alignment: .center)

                    Link(destination: presentation.stopURL) {
                        Circle()
                            .fill(presentation.stopButtonColor)
                            .frame(width: 42, height: 42)
                            .overlay(
                                Image(systemName: "stop.fill")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(.white)
                            )
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
        .widgetURL(presentation.trackerURL)
    }
}

@available(iOS 16.1, *)
private struct SleepCompactTrailingTimerView: View {
    let startDate: Date?
    let elapsedFallbackText: String

    private var compactFallbackText: String {
        let cleaned = elapsedFallbackText.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.count <= 5 {
            return cleaned
        }
        return String(cleaned.suffix(5))
    }

    var body: some View {
        Group {
            if let startDate {
                Text(startDate, style: .timer)
            } else {
                Text(compactFallbackText)
            }
        }
        .font(.system(size: 11, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: 38, alignment: .trailing)
    }
}

@available(iOS 16.1, *)
struct WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SleepActivityAttributes.self) { context in
            SleepActivityMainView(context: context)
                .activityBackgroundTint(SleepActivityTheme.darkBgTop)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let presentation = LiveActivityPresentation(context: context)

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: presentation.leadingSystemIcon)
                        .foregroundStyle(presentation.accent)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let startDate = presentation.startDate {
                        Text("Seit \(DateFormatter.activityStartFormatter.string(from: startDate))")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.70))
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(presentation.centerTitleText)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                }

                DynamicIslandExpandedRegion(.bottom) {
                    ZStack(alignment: .trailing) {
                        Group {
                            if let startDate = presentation.startDate {
                                Text(startDate, style: .timer)
                            } else {
                                Text(context.state.elapsedTimeText)
                            }
                        }
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .frame(maxWidth: .infinity, alignment: .center)

                        Link(destination: presentation.stopURL) {
                            Label("Stop", systemImage: "stop.fill")
                                .font(.system(size: 13, weight: .semibold, design: .rounded))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(
                                    Capsule()
                                        .fill(presentation.stopButtonColor.opacity(0.88))
                                )
                                .foregroundStyle(.white)
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(maxWidth: .infinity)
                }
            } compactLeading: {
                Image(systemName: presentation.leadingSystemIcon)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(presentation.accent)
            } compactTrailing: {
                SleepCompactTrailingTimerView(
                    startDate: presentation.startDate,
                    elapsedFallbackText: context.state.elapsedTimeText
                )
            } minimal: {
                Image(systemName: presentation.leadingSystemIcon)
                    .foregroundStyle(presentation.accent)
            }
            .widgetURL(presentation.trackerURL)
            .keylineTint(presentation.accentStrong)
        }
    }
}

@available(iOS 16.1, *)
private extension DateFormatter {
    static let activityStartFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()
}
