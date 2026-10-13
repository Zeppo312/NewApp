import SwiftUI
import WidgetKit
#if canImport(AppIntents)
import AppIntents
#endif

// MARK: - Planer-Widgets im App-Design
//
// Zwei Widgets aus einem Snapshot (PlannerWidgetStore):
//  • Zeitplan – wie das Apple-Kalender-Widget: großes Datum links, daneben die
//    nächsten Termine mit Personen-/Eintragsfarbe. Im großen Format zusätzlich
//    die Aufgaben mit Uhrzeit, chronologisch einsortiert, mit „Jetzt“-Marke.
//  • Aufgaben – die offenen Aufgaben des Tages (mit und ohne Uhrzeit) zum
//    direkten Abhaken (AppIntent, iOS 17+; auf iOS 16 nur Anzeige).

private enum PlannerWidgetTheme {
    static let accent = Color(red: 0.369, green: 0.239, blue: 0.702)        // #5E3DB3 (PRIMARY)
    static let accentSoft = Color(red: 0.369, green: 0.239, blue: 0.702).opacity(0.12)
    static let done = Color(red: 0.373, green: 0.663, blue: 0.478)          // #5FA97A
    static let textPrimary = Color(red: 0.361, green: 0.251, blue: 0.200)   // #5C4033
    static let textSecondary = Color(red: 0.490, green: 0.353, blue: 0.314) // #7D5A50
    static let textPrimaryDark = Color(red: 0.973, green: 0.941, blue: 0.898)   // #F8F0E5
    static let textSecondaryDark = Color(red: 0.973, green: 0.941, blue: 0.898).opacity(0.72)

    static let backgroundLight = LinearGradient(
        colors: [Color(red: 0.984, green: 0.965, blue: 0.925), Color(red: 0.953, green: 0.918, blue: 0.965)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    static let backgroundDark = LinearGradient(
        colors: [Color(red: 0.122, green: 0.102, blue: 0.094), Color(red: 0.141, green: 0.110, blue: 0.180)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func rowFill(_ scheme: ColorScheme, muted: Bool = false) -> Color {
        if scheme == .dark { return Color.white.opacity(muted ? 0.04 : 0.08) }
        return Color.white.opacity(muted ? 0.30 : 0.58)
    }

    static func textPrimary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? textPrimaryDark : textPrimary
    }

    static func textSecondary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? textSecondaryDark : textSecondary
    }
}

// MARK: - Farben

/// "#rrggbb" → Color. Im Dunkelmodus wie adaptPlannerColor in der App um 18 %
/// aufgehellt, damit die satten Hell-Farben auf dunklem Grund lesbar bleiben.
private func plannerColor(hex: String?, scheme: ColorScheme, fallback: Color = PlannerWidgetTheme.accent) -> Color {
    guard let hex, hex.hasPrefix("#"), hex.count == 7 else { return fallback }
    var value: UInt64 = 0
    guard Scanner(string: String(hex.dropFirst())).scanHexInt64(&value) else { return fallback }
    var r = Double((value >> 16) & 0xFF) / 255
    var g = Double((value >> 8) & 0xFF) / 255
    var b = Double(value & 0xFF) / 255
    if scheme == .dark {
        let amount = 0.18
        r += (1 - r) * amount
        g += (1 - g) * amount
        b += (1 - b) * amount
    }
    return Color(red: r, green: g, blue: b)
}

// MARK: - Deep Links

private enum PlannerWidgetLink {
    static let open = URL(string: "com.lottibaby.app://planner")!
    static let addTodo = URL(string: "com.lottibaby.app://planner?capture=todo")!
    static let addEvent = URL(string: "com.lottibaby.app://planner?capture=event")!
}

// MARK: - Formatierung

/// Datums- und Uhrzeitformat folgen der App-Sprache aus dem Snapshot, nicht
/// der Systemsprache – sonst stünde über deutschen Terminen ein englischer
/// Wochentag.
private struct PlannerFormat {
    let locale: Locale

    init(tag: String) {
        locale = Locale(identifier: tag)
    }

    private func formatter(template: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter
    }

    func time(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    func weekdayShort(_ date: Date) -> String {
        formatter(template: "EEE").string(from: date).replacingOccurrences(of: ".", with: "").uppercased(with: locale)
    }

    func weekdayLong(_ date: Date) -> String {
        formatter(template: "EEEE").string(from: date)
    }

    func dayNumber(_ date: Date) -> String {
        formatter(template: "d").string(from: date).replacingOccurrences(of: ".", with: "")
    }

    func monthLong(_ date: Date) -> String {
        formatter(template: "MMMM").string(from: date)
    }
}

// MARK: - AppIntent zum Abhaken (iOS 17+)

#if canImport(AppIntents)
@available(iOS 17.0, *)
struct TogglePlannerTodoIntent: AppIntent {
    static var title: LocalizedStringResource = "Aufgabe abhaken"
    static var description = IntentDescription("Hakt eine Aufgabe im Planer ab.")
    static var isDiscoverable: Bool = false

    @Parameter(title: "Item")
    var itemId: String

    @Parameter(title: "Completed")
    var completed: Bool

    @Parameter(title: "Series")
    var seriesId: String?

    @Parameter(title: "Occurrence")
    var occurrenceDate: String?

    init() {}

    init(todo: PlannerWidgetTodo) {
        self.itemId = todo.id
        self.completed = !todo.completed
        self.seriesId = todo.seriesId
        self.occurrenceDate = todo.occurrenceDate
    }

    func perform() async throws -> some IntentResult {
        // Sofort im Snapshot spiegeln und in die Warteschlange legen – die App
        // schreibt es beim nächsten Aktivieren nach Supabase.
        PlannerWidgetStore.applyOptimisticToggle(itemId: itemId, completed: completed)
        PlannerWidgetStore.queueToggle(
            itemId: itemId,
            completed: completed,
            seriesId: seriesId,
            occurrenceDate: occurrenceDate
        )
        // Das auslösende Widget lädt iOS selbst neu; das jeweils andere Planer-
        // Widget zeigt dieselbe Aufgabe und muss mitziehen.
        WidgetCenter.shared.reloadTimelines(ofKind: PlannerWidgetStore.timelineWidgetKind)
        WidgetCenter.shared.reloadTimelines(ofKind: PlannerWidgetStore.tasksWidgetKind)
        return .result()
    }
}
#endif

// MARK: - Timeline

struct PlannerWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: PlannerWidgetSnapshot?
}

private func nextMidnight(after date: Date) -> Date {
    Calendar.current.nextDate(
        after: date,
        matching: DateComponents(hour: 0, minute: 0),
        matchingPolicy: .nextTime
    ) ?? date.addingTimeInterval(24 * 3600)
}

struct PlannerTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlannerWidgetEntry {
        PlannerWidgetEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (PlannerWidgetEntry) -> Void) {
        let stored = PlannerWidgetStore.readSnapshot()
        completion(PlannerWidgetEntry(date: Date(), snapshot: stored ?? (context.isPreview ? .placeholder : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlannerWidgetEntry>) -> Void) {
        let now = Date()
        let snapshot = PlannerWidgetStore.readSnapshot()
        let midnight = nextMidnight(after: now)

        // Ein Eintrag pro Terminbeginn und -ende: so rutscht ein vorbeigezogener
        // Termin von selbst aus der Liste, ohne dass die App etwas tun muss.
        var moments: Set<Date> = [now]
        if let snapshot, snapshot.isForToday(now: now) {
            let boundaries = snapshot.events.flatMap { [$0.startDate, $0.endDate] }
                + snapshot.todos.compactMap { $0.dueDate }
            for date in boundaries where date > now && date < midnight {
                moments.insert(date)
            }
        }
        let entries = moments.sorted().prefix(40).map { PlannerWidgetEntry(date: $0, snapshot: snapshot) }

        completion(Timeline(entries: Array(entries), policy: .after(midnight)))
    }
}

struct PlannerTasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlannerWidgetEntry {
        PlannerWidgetEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (PlannerWidgetEntry) -> Void) {
        let stored = PlannerWidgetStore.readSnapshot()
        completion(PlannerWidgetEntry(date: Date(), snapshot: stored ?? (context.isPreview ? .placeholder : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PlannerWidgetEntry>) -> Void) {
        let now = Date()
        let entry = PlannerWidgetEntry(date: now, snapshot: PlannerWidgetStore.readSnapshot())
        // Die App lädt bei jeder Änderung selbst neu; das hier ist das
        // Sicherheitsnetz, spätestens zum Tageswechsel.
        let next = min(now.addingTimeInterval(3600), nextMidnight(after: now))
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Gemeinsame Bausteine

/// Das große Datum links – die Signatur des Kalender-Widgets.
private struct PlannerDateBlock: View {
    let date: Date
    let format: PlannerFormat
    let scheme: ColorScheme
    let dayFontSize: CGFloat
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: -2) {
            Text(format.weekdayShort(date))
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.accent)
                .lineLimit(1)
            Text(format.dayNumber(date))
                .font(.system(size: dayFontSize, weight: .bold, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.textPrimary(scheme))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme))
                    .lineLimit(2)
                    .padding(.top, 4)
            }
        }
    }
}

private struct PlannerColorBar: View {
    let color: Color
    let width: CGFloat

    var body: some View {
        Capsule()
            .fill(color)
            .frame(width: width)
    }
}

private struct PlannerEmptyState: View {
    let title: String
    let hint: String?
    let emoji: String
    let compact: Bool
    let scheme: ColorScheme

    var body: some View {
        VStack(spacing: 4) {
            Text(emoji)
                .font(.system(size: compact ? 22 : 28))
            Text(title)
                .font(.system(size: compact ? 11 : 13, weight: .heavy, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.textPrimary(scheme))
                .multilineTextAlignment(.center)
                .lineLimit(2)
            if let hint, !compact {
                Text(hint)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme).opacity(0.85))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct PlannerSignedOutState: View {
    let scheme: ColorScheme

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "calendar")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(PlannerWidgetTheme.accent)
            Text(PlannerWidgetStrings.fallback.signedOut)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(10)
    }
}

private struct PlannerMoreLine: View {
    let template: String
    let count: Int
    let scheme: ColorScheme

    var body: some View {
        Text(String(format: template, count))
            .font(.system(size: 10, weight: .bold, design: .rounded))
            .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme).opacity(0.7))
            .lineLimit(1)
    }
}

// MARK: - Zeitplan: Zeilen

/// Termine und Aufgaben mit Uhrzeit in einer Liste, chronologisch.
private enum PlannerTimelineRow: Identifiable {
    case event(PlannerWidgetEvent)
    case todo(PlannerWidgetTodo)

    var id: String {
        switch self {
        case .event(let event): return "event:\(event.id)"
        case .todo(let todo): return "todo:\(todo.id)"
        }
    }

    var sortDate: Date {
        switch self {
        case .event(let event): return event.startDate
        case .todo(let todo): return todo.dueDate ?? .distantFuture
        }
    }

    var isAllDay: Bool {
        if case .event(let event) = self { return event.isAllDay }
        return false
    }

    /// Ist der Eintrag zu diesem Zeitpunkt vorbei?
    func isPast(at now: Date) -> Bool {
        switch self {
        case .event(let event): return !event.isAllDay && event.endDate <= now
        case .todo(let todo): return todo.completed
        }
    }
}

private func timelineRows(from snapshot: PlannerWidgetSnapshot, includeTodos: Bool) -> [PlannerTimelineRow] {
    var rows: [PlannerTimelineRow] = snapshot.events.map { .event($0) }
    if includeTodos {
        rows += snapshot.todos.filter { $0.dueAt != nil }.map { .todo($0) }
    }
    // Ganztägiges zuerst, dann nach Uhrzeit.
    return rows.sorted { lhs, rhs in
        if lhs.isAllDay != rhs.isAllDay { return lhs.isAllDay }
        return lhs.sortDate < rhs.sortDate
    }
}

private struct PlannerEventRow: View {
    let row: PlannerTimelineRow
    let now: Date
    let format: PlannerFormat
    let strings: PlannerWidgetStrings
    let scheme: ColorScheme
    let height: CGFloat
    let showRange: Bool
    let showDetails: Bool

    private var isPast: Bool { row.isPast(at: now) }

    private var barColor: Color {
        switch row {
        case .event(let event): return plannerColor(hex: event.color, scheme: scheme)
        case .todo(let todo): return plannerColor(hex: todo.color, scheme: scheme, fallback: PlannerWidgetTheme.textSecondary(scheme).opacity(0.5))
        }
    }

    private var title: String {
        switch row {
        case .event(let event): return event.title
        case .todo(let todo): return todo.title
        }
    }

    private var timeLabel: String {
        switch row {
        case .event(let event):
            if event.isAllDay { return strings.allDayLabel }
            if showRange { return "\(format.time(event.startDate)) – \(format.time(event.endDate))" }
            return format.time(event.startDate)
        case .todo(let todo):
            guard let due = todo.dueDate else { return strings.flexibleLabel }
            return format.time(due)
        }
    }

    private var detail: String? {
        switch row {
        case .event(let event):
            let parts = [event.location, event.person].compactMap { $0 }.filter { !$0.isEmpty }
            return parts.isEmpty ? nil : parts.joined(separator: " · ")
        case .todo(let todo):
            return todo.person
        }
    }

    var body: some View {
        HStack(spacing: 7) {
            PlannerColorBar(color: barColor, width: 3)
                .padding(.vertical, 3)

            if case .todo(let todo) = row {
                Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(todo.completed ? PlannerWidgetTheme.done : barColor)
            }

            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(.system(size: height >= 34 ? 13 : 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(PlannerWidgetTheme.textPrimary(scheme))
                    .strikethrough(isPast && row.isTodo, color: PlannerWidgetTheme.textSecondary(scheme).opacity(0.5))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                HStack(spacing: 4) {
                    Text(timeLabel)
                    if showDetails, let detail {
                        Text("·")
                        Text(detail)
                    }
                }
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme))
                .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .opacity(isPast ? 0.5 : 1)
        .frame(height: height)
    }
}

private extension PlannerTimelineRow {
    var isTodo: Bool {
        if case .todo = self { return true }
        return false
    }
}

/// Dünne Linie mit „Jetzt“ zwischen Vergangenem und Kommendem.
private struct PlannerNowDivider: View {
    let label: String
    let time: String

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(PlannerWidgetTheme.accent)
                .frame(width: 6, height: 6)
            Rectangle()
                .fill(PlannerWidgetTheme.accent.opacity(0.6))
                .frame(height: 1)
            Text("\(label) \(time)")
                .font(.system(size: 9, weight: .heavy, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.accent)
                .lineLimit(1)
        }
        .frame(height: 12)
    }
}

// MARK: - Zeitplan: Layouts

private struct PlannerTimelineMetrics {
    let rowHeight: CGFloat
    let spacing: CGFloat

    static func of(_ family: WidgetFamily) -> PlannerTimelineMetrics {
        switch family {
        case .systemSmall: return PlannerTimelineMetrics(rowHeight: 30, spacing: 3)
        case .systemLarge: return PlannerTimelineMetrics(rowHeight: 34, spacing: 4)
        default: return PlannerTimelineMetrics(rowHeight: 32, spacing: 3)
        }
    }
}

/// Liste der kommenden Einträge, gefüllt bis zur verfügbaren Höhe. Vergangene
/// Termine fallen heraus – wie im Kalender-Widget zählt, was noch ansteht.
private struct PlannerUpcomingList: View {
    let rows: [PlannerTimelineRow]
    let now: Date
    let snapshot: PlannerWidgetSnapshot
    let format: PlannerFormat
    let scheme: ColorScheme
    let metrics: PlannerTimelineMetrics
    let showRange: Bool
    let showDetails: Bool
    let compact: Bool

    private var upcoming: [PlannerTimelineRow] { rows.filter { !$0.isPast(at: now) } }

    var body: some View {
        GeometryReader { geo in
            let slot = metrics.rowHeight + metrics.spacing
            let footer: CGFloat = 14
            let plainCapacity = max(1, Int((geo.size.height + metrics.spacing) / slot))
            let needsFooter = upcoming.count > plainCapacity
            let usable = needsFooter ? max(0, geo.size.height - footer - metrics.spacing) : geo.size.height
            let capacity = max(1, Int((usable + metrics.spacing) / slot))
            let visible = Array(upcoming.prefix(capacity))
            let hidden = max(0, upcoming.count - visible.count)

            VStack(alignment: .leading, spacing: metrics.spacing) {
                if upcoming.isEmpty {
                    PlannerEmptyState(
                        title: rows.isEmpty ? snapshot.strings.noEventsTitle : snapshot.strings.noMoreEventsTitle,
                        hint: rows.isEmpty ? snapshot.strings.noEventsHint : nil,
                        emoji: rows.isEmpty ? "🌿" : "✨",
                        compact: compact,
                        scheme: scheme
                    )
                } else {
                    ForEach(visible) { row in
                        PlannerEventRow(
                            row: row,
                            now: now,
                            format: format,
                            strings: snapshot.strings,
                            scheme: scheme,
                            height: metrics.rowHeight,
                            showRange: showRange,
                            showDetails: showDetails
                        )
                    }
                    if hidden > 0 {
                        PlannerMoreLine(template: snapshot.strings.moreItems, count: hidden, scheme: scheme)
                            .frame(height: footer)
                            .padding(.leading, 10)
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
    }
}

private struct PlannerTimelineSmall: View {
    let snapshot: PlannerWidgetSnapshot
    let now: Date
    let format: PlannerFormat
    let scheme: ColorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            PlannerDateBlock(date: now, format: format, scheme: scheme, dayFontSize: 30)
            PlannerUpcomingList(
                rows: timelineRows(from: snapshot, includeTodos: false),
                now: now,
                snapshot: snapshot,
                format: format,
                scheme: scheme,
                metrics: .of(.systemSmall),
                showRange: false,
                showDetails: false,
                compact: true
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct PlannerTimelineMedium: View {
    let snapshot: PlannerWidgetSnapshot
    let now: Date
    let format: PlannerFormat
    let scheme: ColorScheme

    private var eventsSubtitle: String {
        String(format: snapshot.strings.eventsCount, snapshot.events.count)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            PlannerDateBlock(
                date: now,
                format: format,
                scheme: scheme,
                dayFontSize: 34,
                subtitle: eventsSubtitle
            )
            .frame(width: 66, alignment: .leading)

            PlannerUpcomingList(
                rows: timelineRows(from: snapshot, includeTodos: false),
                now: now,
                snapshot: snapshot,
                format: format,
                scheme: scheme,
                metrics: .of(.systemMedium),
                showRange: true,
                showDetails: false,
                compact: false
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// Großes Widget: der ganze Tag inklusive Aufgaben mit Uhrzeit. Vergangenes
/// bleibt abgeblendet stehen, dazwischen die „Jetzt“-Marke.
private struct PlannerTimelineLarge: View {
    let snapshot: PlannerWidgetSnapshot
    let now: Date
    let format: PlannerFormat
    let scheme: ColorScheme

    private let metrics = PlannerTimelineMetrics.of(.systemLarge)
    private let headerHeight: CGFloat = 44

    var body: some View {
        let rows = timelineRows(from: snapshot, includeTodos: true)
        let past = rows.filter { $0.isPast(at: now) }
        let upcoming = rows.filter { !$0.isPast(at: now) }

        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(format.weekdayLong(now))
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(PlannerWidgetTheme.accent)
                Text("\(format.dayNumber(now)). \(format.monthLong(now))")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(PlannerWidgetTheme.textPrimary(scheme))
                Spacer(minLength: 4)
                Text(String(format: snapshot.strings.eventsCount, snapshot.events.count))
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(PlannerWidgetTheme.accent))
                Link(destination: PlannerWidgetLink.addEvent) {
                    Image(systemName: "plus")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(PlannerWidgetTheme.accent)
                        .frame(width: 22, height: 22)
                        .background(Circle().fill(PlannerWidgetTheme.accentSoft))
                }
                .buttonStyle(.plain)
            }
            .frame(height: 24)

            if rows.isEmpty {
                PlannerEmptyState(
                    title: snapshot.strings.noEventsTitle,
                    hint: snapshot.strings.noEventsHint,
                    emoji: "🌿",
                    compact: false,
                    scheme: scheme
                )
            } else {
                GeometryReader { geo in
                    let slot = metrics.rowHeight + metrics.spacing
                    let dividerBlock: CGFloat = past.isEmpty ? 0 : 12 + metrics.spacing
                    let footer: CGFloat = 14
                    let available = geo.size.height - dividerBlock
                    let plainCapacity = max(1, Int((available + metrics.spacing) / slot))
                    let needsFooter = rows.count > plainCapacity
                    let usable = needsFooter ? max(0, available - footer - metrics.spacing) : available
                    let capacity = max(1, Int((usable + metrics.spacing) / slot))

                    // Kommendes hat Vorrang; Vergangenes füllt nur den Rest
                    // von hinten auf, damit der Anschluss an „Jetzt“ stimmt.
                    let upcomingVisible = Array(upcoming.prefix(capacity))
                    let pastVisible = Array(past.suffix(max(0, capacity - upcomingVisible.count)))
                    let hidden = rows.count - upcomingVisible.count - pastVisible.count

                    VStack(alignment: .leading, spacing: metrics.spacing) {
                        ForEach(pastVisible) { row in
                            PlannerEventRow(row: row, now: now, format: format, strings: snapshot.strings, scheme: scheme, height: metrics.rowHeight, showRange: true, showDetails: true)
                        }
                        if !past.isEmpty {
                            PlannerNowDivider(label: snapshot.strings.nowLabel, time: format.time(now))
                        }
                        ForEach(upcomingVisible) { row in
                            PlannerEventRow(row: row, now: now, format: format, strings: snapshot.strings, scheme: scheme, height: metrics.rowHeight, showRange: true, showDetails: true)
                        }
                        if upcomingVisible.isEmpty {
                            Text(snapshot.strings.noMoreEventsTitle)
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                                .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme))
                                .padding(.leading, 10)
                        }
                        if hidden > 0 {
                            PlannerMoreLine(template: snapshot.strings.moreItems, count: hidden, scheme: scheme)
                                .frame(height: footer)
                                .padding(.leading, 10)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// Zeigt den Tageskopf mit Hinweis, wenn der Snapshot noch von gestern ist.
private struct PlannerStaleState: View {
    let now: Date
    let format: PlannerFormat
    let strings: PlannerWidgetStrings
    let scheme: ColorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PlannerDateBlock(date: now, format: format, scheme: scheme, dayFontSize: 30)
            Spacer(minLength: 0)
            Text(strings.staleHint)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme))
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct PlannerTimelineWidgetEntryView: View {
    var entry: PlannerWidgetEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    private var systemHandlesMargins: Bool {
        if #available(iOS 17.0, *) { return true }
        return false
    }

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                let format = PlannerFormat(tag: snapshot.localeTag)
                if !snapshot.isForToday(now: entry.date) {
                    PlannerStaleState(now: entry.date, format: format, strings: snapshot.strings, scheme: colorScheme)
                } else {
                    switch family {
                    case .systemSmall:
                        PlannerTimelineSmall(snapshot: snapshot, now: entry.date, format: format, scheme: colorScheme)
                    case .systemLarge:
                        PlannerTimelineLarge(snapshot: snapshot, now: entry.date, format: format, scheme: colorScheme)
                    default:
                        PlannerTimelineMedium(snapshot: snapshot, now: entry.date, format: format, scheme: colorScheme)
                    }
                }
            } else {
                PlannerSignedOutState(scheme: colorScheme)
            }
        }
        .padding(systemHandlesMargins ? 0 : 12)
        .widgetURL(PlannerWidgetLink.open)
    }
}

// MARK: - Aufgaben: Layouts

private struct PlannerTasksMetrics {
    let rowHeight: CGFloat
    let spacing: CGFloat
    let headerHeight: CGFloat
    let compact: Bool

    static func of(_ family: WidgetFamily) -> PlannerTasksMetrics {
        switch family {
        case .systemSmall: return PlannerTasksMetrics(rowHeight: 25, spacing: 3, headerHeight: 20, compact: true)
        case .systemLarge: return PlannerTasksMetrics(rowHeight: 32, spacing: 5, headerHeight: 26, compact: false)
        default: return PlannerTasksMetrics(rowHeight: 26, spacing: 3, headerHeight: 22, compact: false)
        }
    }
}

private struct PlannerTasksHeader: View {
    let snapshot: PlannerWidgetSnapshot
    let metrics: PlannerTasksMetrics
    let scheme: ColorScheme
    let showAdd: Bool

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "checklist")
                .font(.system(size: metrics.compact ? 10 : 11, weight: .bold))
                .foregroundStyle(PlannerWidgetTheme.accent)
                .frame(width: metrics.headerHeight, height: metrics.headerHeight)
                .background(Circle().fill(PlannerWidgetTheme.accentSoft))

            Text(snapshot.strings.tasksTitle)
                .font(.system(size: metrics.compact ? 12 : 14, weight: .heavy, design: .rounded))
                .foregroundStyle(PlannerWidgetTheme.textPrimary(scheme))
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Spacer(minLength: 4)

            Text(metrics.compact ? "\(snapshot.openTodoCount)" : "\(snapshot.openTodoCount) \(snapshot.strings.openLabel)")
                .font(.system(size: metrics.compact ? 10 : 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Capsule().fill(PlannerWidgetTheme.accent))

            if showAdd {
                Link(destination: PlannerWidgetLink.addTodo) {
                    Image(systemName: "plus")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(PlannerWidgetTheme.accent)
                        .frame(width: metrics.headerHeight, height: metrics.headerHeight)
                        .background(Circle().fill(PlannerWidgetTheme.accentSoft))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(height: metrics.headerHeight)
    }
}

private struct PlannerTaskRow: View {
    let todo: PlannerWidgetTodo
    let format: PlannerFormat
    let strings: PlannerWidgetStrings
    let metrics: PlannerTasksMetrics
    let scheme: ColorScheme

    private var accent: Color {
        plannerColor(hex: todo.color, scheme: scheme, fallback: PlannerWidgetTheme.accent)
    }

    private var meta: String? {
        if let due = todo.dueDate { return format.time(due) }
        if metrics.compact { return nil }
        return strings.flexibleLabel
    }

    var body: some View {
        HStack(spacing: metrics.compact ? 6 : 8) {
            checkControl

            Text(todo.title)
                .font(.system(size: metrics.compact ? 12 : 13, weight: .semibold, design: .rounded))
                .foregroundStyle(todo.completed ? PlannerWidgetTheme.textSecondary(scheme).opacity(0.5) : PlannerWidgetTheme.textPrimary(scheme))
                .strikethrough(todo.completed, color: PlannerWidgetTheme.textSecondary(scheme).opacity(0.5))
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            Spacer(minLength: 2)

            if !metrics.compact, let person = todo.person, !person.isEmpty {
                Text(person)
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme).opacity(todo.completed ? 0.5 : 0.85))
                    .lineLimit(1)
            }

            if todo.isRecurring {
                Image(systemName: "repeat")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(PlannerWidgetTheme.textSecondary(scheme).opacity(0.6))
            }

            if let meta {
                Text(meta)
                    .font(.system(size: metrics.compact ? 9 : 10, weight: .bold, design: .rounded))
                    .foregroundStyle(todo.completed ? PlannerWidgetTheme.textSecondary(scheme).opacity(0.5) : accent)
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(
                        Capsule().fill(todo.completed ? Color.white.opacity(0.2) : accent.opacity(0.12))
                    )
            }
        }
        .padding(.horizontal, metrics.compact ? 7 : 9)
        .frame(height: metrics.rowHeight)
        .background(
            RoundedRectangle(cornerRadius: metrics.rowHeight / 2.6, style: .continuous)
                .fill(PlannerWidgetTheme.rowFill(scheme, muted: todo.completed))
        )
    }

    private var checkIcon: some View {
        Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
            .font(.system(size: metrics.compact ? 15 : 17, weight: .medium))
            .foregroundStyle(todo.completed ? PlannerWidgetTheme.done : accent)
            .frame(width: metrics.compact ? 20 : 22, height: metrics.rowHeight)
            .contentShape(Rectangle())
    }

    @ViewBuilder
    private var checkControl: some View {
        #if canImport(AppIntents)
        if #available(iOS 17.0, *) {
            Button(intent: TogglePlannerTodoIntent(todo: todo)) {
                checkIcon
            }
            .buttonStyle(.plain)
        } else {
            checkIcon
        }
        #else
        checkIcon
        #endif
    }
}

private struct PlannerTasksContent: View {
    let snapshot: PlannerWidgetSnapshot
    let metrics: PlannerTasksMetrics
    let family: WidgetFamily
    let scheme: ColorScheme

    private let footerHeight: CGFloat = 14

    var body: some View {
        let format = PlannerFormat(tag: snapshot.localeTag)
        GeometryReader { geo in
            let available = max(0, geo.size.height - metrics.headerHeight - metrics.spacing)
            let slot = metrics.rowHeight + metrics.spacing
            let plainCapacity = max(1, Int((available + metrics.spacing) / slot))
            let needsFooter = snapshot.todos.count > plainCapacity
            let usable = needsFooter ? max(0, available - footerHeight - metrics.spacing) : available
            let rowCount = max(1, Int((usable + metrics.spacing) / slot))
            let visible = Array(snapshot.todos.prefix(rowCount))
            let hidden = max(0, snapshot.todos.count - visible.count)

            VStack(alignment: .leading, spacing: metrics.spacing) {
                // Im kleinen Widget gibt es keine Links neben widgetURL, deshalb
                // dort kein Plus.
                PlannerTasksHeader(snapshot: snapshot, metrics: metrics, scheme: scheme, showAdd: family != .systemSmall)

                if snapshot.todos.isEmpty {
                    PlannerEmptyState(
                        title: snapshot.strings.noTasksTitle,
                        hint: snapshot.strings.noTasksHint,
                        emoji: "🎉",
                        compact: metrics.compact,
                        scheme: scheme
                    )
                } else {
                    // Die App liefert Offenes zuerst. Nicht neu sortieren: eine
                    // gerade abgehakte Aufgabe bleibt an Ort und Stelle, damit
                    // sich ein Fehlgriff sofort korrigieren lässt.
                    ForEach(visible) { todo in
                        PlannerTaskRow(todo: todo, format: format, strings: snapshot.strings, metrics: metrics, scheme: scheme)
                    }
                    if hidden > 0 {
                        PlannerMoreLine(template: snapshot.strings.moreItems, count: hidden, scheme: scheme)
                            .frame(height: footerHeight)
                            .padding(.leading, 9)
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
        }
    }
}

struct PlannerTasksWidgetEntryView: View {
    var entry: PlannerWidgetEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    private var systemHandlesMargins: Bool {
        if #available(iOS 17.0, *) { return true }
        return false
    }

    var body: some View {
        let metrics = PlannerTasksMetrics.of(family)
        Group {
            if let snapshot = entry.snapshot {
                if snapshot.isForToday(now: entry.date) {
                    PlannerTasksContent(snapshot: snapshot, metrics: metrics, family: family, scheme: colorScheme)
                } else {
                    // Ein alter Snapshot würde gestrige Erledigungen zeigen –
                    // lieber zum Öffnen der App auffordern.
                    PlannerEmptyState(
                        title: snapshot.strings.tasksTitle,
                        hint: snapshot.strings.staleHint,
                        emoji: "☀️",
                        compact: metrics.compact,
                        scheme: colorScheme
                    )
                }
            } else {
                PlannerSignedOutState(scheme: colorScheme)
            }
        }
        .padding(systemHandlesMargins ? 0 : 12)
        .widgetURL(PlannerWidgetLink.open)
    }
}

// MARK: - Container & Widgets

private extension View {
    @ViewBuilder
    func plannerContainerBackground(_ colorScheme: ColorScheme) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                colorScheme == .dark ? PlannerWidgetTheme.backgroundDark : PlannerWidgetTheme.backgroundLight
            }
        } else {
            ZStack {
                (colorScheme == .dark ? PlannerWidgetTheme.backgroundDark : PlannerWidgetTheme.backgroundLight)
                self
            }
        }
    }
}

private struct PlannerTimelineWidgetContainer: View {
    var entry: PlannerWidgetEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        PlannerTimelineWidgetEntryView(entry: entry)
            .plannerContainerBackground(colorScheme)
    }
}

private struct PlannerTasksWidgetContainer: View {
    var entry: PlannerWidgetEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        PlannerTasksWidgetEntryView(entry: entry)
            .plannerContainerBackground(colorScheme)
    }
}

struct PlannerTimelineWidget: Widget {
    let kind = PlannerWidgetStore.timelineWidgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlannerTimelineProvider()) { entry in
            PlannerTimelineWidgetContainer(entry: entry)
        }
        .configurationDisplayName("Planer")
        .description("Deine Termine des Tages auf einen Blick.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct PlannerTasksWidget: Widget {
    let kind = PlannerWidgetStore.tasksWidgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlannerTasksProvider()) { entry in
            PlannerTasksWidgetContainer(entry: entry)
        }
        .configurationDisplayName("Aufgaben")
        .description("Offene Aufgaben aus dem Planer direkt abhaken.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
