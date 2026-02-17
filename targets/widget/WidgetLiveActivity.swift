import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
struct SleepActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var isTracking: Bool
        var elapsedTimeText: String
        var quality: String?
    }

    var startTime: String
    var startTimestamp: Double?
    var elapsedTimeText: String?
    var babyName: String?
}

@available(iOS 16.1, *)
private enum SleepActivityTheme {
    static let accent = Color(red: 0.45, green: 0.80, blue: 1.00)
    static let accentStrong = Color(red: 0.29, green: 0.66, blue: 0.96)
    static let darkBgTop = Color(red: 0.09, green: 0.13, blue: 0.23)
    static let darkBgBottom = Color(red: 0.03, green: 0.05, blue: 0.10)
    static let stopButton = Color(red: 0.95, green: 0.53, blue: 0.66)
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
private struct SleepActivityMainView: View {
    let context: ActivityViewContext<SleepActivityAttributes>

    private var trackerURL: URL {
        URL(string: "com.lottibaby.app://sleep-tracker")!
    }

    private var stopURL: URL {
        URL(string: "com.lottibaby.app://sleep-tracker?liveStop=1")!
    }

    private var startDate: Date? {
        SleepActivityDateParser.parse(
            startTime: context.attributes.startTime,
            startTimestamp: context.attributes.startTimestamp
        )
    }

    private var babyName: String {
        context.attributes.babyName ?? "Baby"
    }

    private var startTimeLabel: String {
        guard let startDate else { return "--:--" }
        return DateFormatter.activityStartFormatter.string(from: startDate)
    }

    var body: some View {
        ZStack {
            VStack(spacing: 6) {
                // Header: "Levi schläft seit 21:30"
                Text("\(babyName) schläft seit \(startTimeLabel)")
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.70))

                // Timer row: teddy left + centered timer + stop button right
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(.white.opacity(0.14))
                        Text("\u{1F9F8}")
                            .font(.system(size: 24))
                    }
                    .frame(width: 42, height: 42)
                    .accessibilityHidden(true)

                    Group {
                        if let startDate {
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

                    Link(destination: stopURL) {
                        Circle()
                            .fill(SleepActivityTheme.stopButton)
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
        .widgetURL(trackerURL)
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
            let trackerURL = URL(string: "com.lottibaby.app://sleep-tracker")
            let stopURL = URL(string: "com.lottibaby.app://sleep-tracker?liveStop=1")
            let startDate = SleepActivityDateParser.parse(
                startTime: context.attributes.startTime,
                startTimestamp: context.attributes.startTimestamp
            )

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "moon.fill")
                        .foregroundStyle(SleepActivityTheme.accent)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let startDate {
                        Text("Seit \(DateFormatter.activityStartFormatter.string(from: startDate))")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.70))
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    Text("\(context.attributes.babyName ?? "Baby") schläft")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                }

                DynamicIslandExpandedRegion(.bottom) {
                    ZStack(alignment: .trailing) {
                        Group {
                            if let startDate {
                                Text(startDate, style: .timer)
                            } else {
                                Text(context.state.elapsedTimeText)
                            }
                        }
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .frame(maxWidth: .infinity, alignment: .center)

                        if let stopURL {
                            Link(destination: stopURL) {
                                Label("Stop", systemImage: "stop.fill")
                                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(
                                        Capsule()
                                            .fill(SleepActivityTheme.stopButton.opacity(0.88))
                                    )
                                    .foregroundStyle(.white)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            } compactLeading: {
                Image(systemName: "moon.fill")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(SleepActivityTheme.accent)
            } compactTrailing: {
                SleepCompactTrailingTimerView(
                    startDate: startDate,
                    elapsedFallbackText: context.state.elapsedTimeText
                )
            } minimal: {
                Image(systemName: "moon.fill")
                    .foregroundStyle(SleepActivityTheme.accent)
            }
            .widgetURL(trackerURL)
            .keylineTint(SleepActivityTheme.accentStrong)
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
