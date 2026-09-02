import SwiftUI
import WidgetKit

// MARK: - Schlaf-Widget im App-Design
//
// Zeigt den Schlafstatus des Babys: läuft gerade ein Schlaf, zählt das Widget
// mit; ist das Baby wach, steht dort die Wachzeit und das nächste
// Müdigkeitsfenster. Getippt wird in die App gesprungen — im wachen Zustand
// mit `autoStart=1`, damit der Schlaf dort sofort startet (inklusive Live
// Activity, die ein reiner Widget-Intent nicht auslösen könnte).

private enum SleepWidgetTheme {
    static let accent = Color(red: 0.29, green: 0.66, blue: 0.96)          // #4AA8F5
    static let night = Color(red: 0.36, green: 0.38, blue: 0.75)           // #5C61BF
    static let awake = Color(red: 0.96, green: 0.67, blue: 0.31)           // #F5AB4F
    static let textPrimary = Color(red: 0.227, green: 0.180, blue: 0.125)  // #3A2E20
    static let textSecondary = Color(red: 0.373, green: 0.275, blue: 0.227) // #5F463A
    static let textPrimaryDark = Color(red: 0.94, green: 0.95, blue: 0.98)
    static let textSecondaryDark = Color(red: 0.70, green: 0.75, blue: 0.85)

    static let backgroundLight = LinearGradient(
        colors: [Color(red: 0.960, green: 0.980, blue: 1.0), Color(red: 0.906, green: 0.937, blue: 0.996)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    static let backgroundDark = LinearGradient(
        colors: [Color(red: 0.09, green: 0.13, blue: 0.23), Color(red: 0.03, green: 0.05, blue: 0.10)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Deep Links

private enum SleepWidgetLink {
    static let open = URL(string: "com.lottibaby.app://sleep-tracker")!
    static let start = URL(string: "com.lottibaby.app://sleep-tracker?autoStart=1")!
}

// MARK: - Timeline

struct SleepWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: SleepWidgetSnapshot?
}

struct SleepWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> SleepWidgetEntry {
        SleepWidgetEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (SleepWidgetEntry) -> Void) {
        let stored = SleepWidgetStore.readSnapshot()?.normalized()
        completion(SleepWidgetEntry(date: Date(), snapshot: stored ?? (context.isPreview ? .placeholder : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SleepWidgetEntry>) -> Void) {
        let now = Date()
        let snapshot = SleepWidgetStore.readSnapshot()?.normalized(now: now)
        let entry = SleepWidgetEntry(date: now, snapshot: snapshot)

        // Die laufenden Zeiten rendert das System selbst (Text(_:style:)), die
        // Timeline muss dafür nicht ticken. Aktualisiert werden muss nur, wenn
        // sich die *Aussage* ändert: wenn das Fenster aufgeht und spätestens zum
        // Tageswechsel, damit die Tagesbilanz nicht von gestern stammt.
        var next = now.addingTimeInterval(30 * 60)

        if let windowStart = snapshot?.windowStartDate, windowStart > now {
            next = min(next, windowStart)
        }
        if let midnight = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(hour: 0, minute: 0),
            matchingPolicy: .nextTime
        ) {
            next = min(next, midnight)
        }

        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Formatierung

private enum SleepWidgetFormat {
    /// Minuten als „4 Std 20" bzw. „45 Min" — kurz genug für die schmalen
    /// Widget-Spalten. Die Einheiten kommen aus dem Snapshot, damit das Widget
    /// der Sprachwahl der App folgt.
    static func duration(_ minutes: Int, _ strings: SleepWidgetStrings) -> String {
        let clamped = max(0, minutes)
        let hours = clamped / 60
        let rest = clamped % 60
        if hours == 0 { return "\(rest) \(strings.minuteShort)" }
        if rest == 0 { return "\(hours) \(strings.hourShort)" }
        return "\(hours) \(strings.hourShort) \(rest)"
    }

    static func naps(_ template: String, _ count: Int) -> String {
        String(format: template, count)
    }
}

// MARK: - Tagesverlauf

/// Der Schlaf des Tages als Balken über 24 Stunden.
///
/// Bewusst die volle Tageslänge und nicht nur der bisher vergangene Teil: Ein
/// Balken, der mitwächst, ließe die Abschnitte im Lauf des Tages wandern —
/// dieselbe Uhrzeit soll aber immer an derselben Stelle liegen.
private struct SleepDayTimeline: View {
    let snapshot: SleepWidgetSnapshot
    let showHourLabels: Bool
    let height: CGFloat
    let textSecondary: Color

    private let now = Date()

    private var dayStart: Date { snapshot.dayStartDate(now: now) }
    private var daySeconds: TimeInterval { 24 * 3600 }

    private func fraction(of date: Date) -> CGFloat {
        let offset = date.timeIntervalSince(dayStart)
        return CGFloat(min(max(offset / daySeconds, 0), 1))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            GeometryReader { geo in
                let width = geo.size.width

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(textSecondary.opacity(0.14))

                    // Stundenraster alle 6 Stunden — genug Orientierung, ohne
                    // den Balken zu zerhacken.
                    ForEach([6, 12, 18], id: \.self) { hour in
                        Rectangle()
                            .fill(textSecondary.opacity(0.22))
                            .frame(width: 1)
                            .offset(x: width * CGFloat(hour) / 24)
                    }

                    ForEach(snapshot.daySegments) { segment in
                        let start = fraction(of: segment.startDate)
                        let end = fraction(of: segment.endDate)
                        // Sehr kurze Schläfe wären sonst unsichtbar.
                        let barWidth = max(width * (end - start), 3)

                        Capsule()
                            .fill(segment.isNight ? SleepWidgetTheme.night : SleepWidgetTheme.accent)
                            .frame(width: barWidth)
                            .offset(x: width * start)
                    }

                    // Jetzt-Marke, damit klar ist, wie viel vom Tag schon vorbei ist.
                    Rectangle()
                        .fill(SleepWidgetTheme.awake)
                        .frame(width: 1.5)
                        .offset(x: width * fraction(of: now))
                }
                .frame(height: height)
                .clipShape(Capsule())
            }
            .frame(height: height)

            if showHourLabels {
                HStack(spacing: 0) {
                    ForEach([0, 6, 12, 18], id: \.self) { hour in
                        Text("\(hour)")
                            .font(.system(size: 9, weight: .medium, design: .rounded))
                            .foregroundStyle(textSecondary.opacity(0.8))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }
}

// MARK: - Bausteine


private struct SleepStatusIcon: View {
    let isSleeping: Bool
    let size: CGFloat

    var body: some View {
        Text(isSleeping ? "🌙" : "☀️")
            .font(.system(size: size))
    }
}

/// Mitlaufende Dauer seit `since`. Das System aktualisiert den Text selbst,
/// deshalb braucht das Widget dafür keine neue Timeline.
private struct SleepElapsedText: View {
    let since: Date
    let font: Font
    let color: Color

    var body: some View {
        Text(since, style: .timer)
            .font(font)
            .monospacedDigit()
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }
}

private struct SleepCaption: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }
}

/// Die Kernaussage: schläft seit … bzw. wach seit … — in beiden Größen gleich,
/// nur mit anderen Schriftgrößen.
private struct SleepStatusBlock: View {
    let snapshot: SleepWidgetSnapshot
    let compact: Bool
    let textPrimary: Color
    let textSecondary: Color

    private var timerFont: Font {
        .system(size: compact ? 26 : 30, weight: .bold, design: .rounded)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 2 : 3) {
            HStack(spacing: 5) {
                SleepStatusIcon(isSleeping: snapshot.isSleeping, size: compact ? 14 : 16)
                SleepCaption(
                    text: snapshot.isSleeping ? snapshot.strings.sleepingLabel : snapshot.strings.awakeLabel,
                    color: textSecondary
                )
            }

            if snapshot.isSleeping, let start = snapshot.startDate {
                SleepElapsedText(since: start, font: timerFont, color: SleepWidgetTheme.accent)
            } else if let awakeSince = snapshot.awakeSinceDate {
                SleepElapsedText(since: awakeSince, font: timerFont, color: SleepWidgetTheme.awake)
            } else {
                Text("–")
                    .font(timerFont)
                    .foregroundStyle(textPrimary)
            }
        }
    }
}

/// Nächstes Müdigkeitsfenster bzw. Schlafenszeit. Ist der empfohlene Beginn
/// schon vorbei, zeigt das Widget „Fenster offen" statt einer vergangenen Zeit.
private struct SleepWindowBlock: View {
    let snapshot: SleepWidgetSnapshot
    let textPrimary: Color
    let textSecondary: Color
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 2) {
            SleepCaption(
                text: snapshot.isNightSleepWindow ? snapshot.strings.nextBedtimeLabel : snapshot.strings.nextNapLabel,
                color: textSecondary
            )

            if let windowStart = snapshot.windowStartDate {
                if snapshot.isWindowOpen() {
                    Text(snapshot.strings.windowOpenLabel)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(SleepWidgetTheme.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else {
                    Text(windowStart, style: .time)
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundStyle(textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            } else {
                Text(snapshot.strings.noWindowHint)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(textSecondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
        }
    }
}

private struct SleepStartButton: View {
    let label: String

    var body: some View {
        Link(destination: SleepWidgetLink.start) {
            HStack(spacing: 5) {
                Image(systemName: "moon.zzz.fill")
                    .font(.system(size: 11, weight: .bold))
                Text(label)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .fill(SleepWidgetTheme.accent)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Inhalte je Größe

/// Eine Zeile aus Tagesbilanz und Anzahl Schläfchen — unter dem Verlaufsbalken
/// die knappste Form, den Balken in Zahlen zu übersetzen.
private struct SleepTodaySummaryLine: View {
    let snapshot: SleepWidgetSnapshot
    let textPrimary: Color
    let textSecondary: Color

    var body: some View {
        HStack(spacing: 5) {
            Text(SleepWidgetFormat.duration(snapshot.todayMinutes, snapshot.strings))
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(textPrimary)

            Text("·")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(textSecondary.opacity(0.6))

            Text(SleepWidgetFormat.naps(snapshot.strings.napsLabel, snapshot.todayNapCount))
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(textSecondary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
}

private struct SleepSmallContent: View {
    let snapshot: SleepWidgetSnapshot
    let textPrimary: Color
    let textSecondary: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            SleepStatusBlock(
                snapshot: snapshot,
                compact: true,
                textPrimary: textPrimary,
                textSecondary: textSecondary
            )

            // Solange kein Timer läuft, ist das nächste Fenster die wichtigere
            // Information; währenddessen zählt der Timer oben ohnehin mit.
            if !snapshot.isSleeping {
                SleepWindowBlock(
                    snapshot: snapshot,
                    textPrimary: textPrimary,
                    textSecondary: textSecondary
                )
            }

            Spacer(minLength: 0)

            // Im kleinen Widget ohne Stundenbeschriftung: die Marke für „jetzt"
            // reicht als Orientierung, Ziffern wären hier nur Rauschen.
            SleepDayTimeline(
                snapshot: snapshot,
                showHourLabels: false,
                height: 7,
                textSecondary: textSecondary
            )

            SleepTodaySummaryLine(
                snapshot: snapshot,
                textPrimary: textPrimary,
                textSecondary: textSecondary
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct SleepMediumContent: View {
    let snapshot: SleepWidgetSnapshot
    let textPrimary: Color
    let textSecondary: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Kopfzeile: Zustand links, nächstes Fenster rechts.
            HStack(alignment: .top, spacing: 12) {
                SleepStatusBlock(
                    snapshot: snapshot,
                    compact: false,
                    textPrimary: textPrimary,
                    textSecondary: textSecondary
                )

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 2) {
                    SleepWindowBlock(
                        snapshot: snapshot,
                        textPrimary: textPrimary,
                        textSecondary: textSecondary,
                        alignment: .trailing
                    )
                }
            }

            Spacer(minLength: 0)

            SleepDayTimeline(
                snapshot: snapshot,
                showHourLabels: true,
                height: 9,
                textSecondary: textSecondary
            )

            HStack(alignment: .center, spacing: 10) {
                SleepTodaySummaryLine(
                    snapshot: snapshot,
                    textPrimary: textPrimary,
                    textSecondary: textSecondary
                )

                Spacer(minLength: 0)

                if snapshot.isSleeping {
                    if let lastSleepMinutes = snapshot.lastSleepMinutes {
                        Text("\(snapshot.strings.lastSleepLabel) \(SleepWidgetFormat.duration(lastSleepMinutes, snapshot.strings))")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(textSecondary)
                            .lineLimit(1)
                    }
                } else {
                    SleepStartButton(label: snapshot.strings.startAction)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct SleepSignedOutState: View {
    let textPrimary: Color

    var body: some View {
        VStack(spacing: 6) {
            Text("🌙")
                .font(.system(size: 30))
            Text(SleepWidgetStrings.fallback.signedOut)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(textPrimary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Widget

struct SleepWidgetEntryView: View {
    var entry: SleepWidgetEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    /// Ab iOS 17 setzt WidgetKit die Ränder selbst; ein eigenes Padding käme
    /// dort obendrauf und kostete eine Zeile.
    private var systemHandlesMargins: Bool {
        if #available(iOS 17.0, *) { return true }
        return false
    }

    private var textPrimary: Color {
        colorScheme == .dark ? SleepWidgetTheme.textPrimaryDark : SleepWidgetTheme.textPrimary
    }

    private var textSecondary: Color {
        colorScheme == .dark ? SleepWidgetTheme.textSecondaryDark : SleepWidgetTheme.textSecondary
    }

    /// Im wachen Zustand startet ein Tippen den Schlaf direkt in der App. Beim
    /// mittleren Widget übernimmt das der eigene Knopf, damit die Fläche
    /// daneben gefahrlos antippbar bleibt.
    private var tapTarget: URL {
        guard let snapshot = entry.snapshot else { return SleepWidgetLink.open }
        if snapshot.isSleeping || family != .systemSmall { return SleepWidgetLink.open }
        return SleepWidgetLink.start
    }

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                if family == .systemSmall {
                    SleepSmallContent(
                        snapshot: snapshot,
                        textPrimary: textPrimary,
                        textSecondary: textSecondary
                    )
                } else {
                    SleepMediumContent(
                        snapshot: snapshot,
                        textPrimary: textPrimary,
                        textSecondary: textSecondary
                    )
                }
            } else {
                SleepSignedOutState(textPrimary: textPrimary)
            }
        }
        .padding(systemHandlesMargins ? 0 : 12)
        .widgetURL(tapTarget)
    }
}

private extension View {
    @ViewBuilder
    func sleepContainerBackground(_ colorScheme: ColorScheme) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                colorScheme == .dark ? SleepWidgetTheme.backgroundDark : SleepWidgetTheme.backgroundLight
            }
        } else {
            ZStack {
                (colorScheme == .dark ? SleepWidgetTheme.backgroundDark : SleepWidgetTheme.backgroundLight)
                self
            }
        }
    }
}

private struct SleepWidgetContainer: View {
    var entry: SleepWidgetEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        SleepWidgetEntryView(entry: entry)
            .sleepContainerBackground(colorScheme)
    }
}

struct SleepWidget: Widget {
    let kind = SleepWidgetStore.widgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SleepWidgetProvider()) { entry in
            SleepWidgetContainer(entry: entry)
        }
        .configurationDisplayName("Schlaf")
        .description("Schlafstatus, Wachzeit und das nächste Müdigkeitsfenster.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
