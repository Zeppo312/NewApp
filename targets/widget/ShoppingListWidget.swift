import SwiftUI
import WidgetKit
#if canImport(AppIntents)
import AppIntents
#endif

// MARK: - Einkaufslisten-Widget im App-Design

private enum ShoppingWidgetTheme {
    static let primary = Color(red: 0.557, green: 0.306, blue: 0.776)      // #8E4EC6
    static let primarySoft = Color(red: 0.557, green: 0.306, blue: 0.776).opacity(0.12)
    static let done = Color(red: 0.373, green: 0.663, blue: 0.478)         // #5FA97A
    static let textPrimary = Color(red: 0.227, green: 0.180, blue: 0.125)  // #3A2E20
    static let textSecondary = Color(red: 0.373, green: 0.275, blue: 0.227) // #5F463A
    static let quantityText = Color(red: 0.478, green: 0.290, blue: 0.651) // #7A4AA6

    static let backgroundLight = LinearGradient(
        colors: [Color(red: 1.0, green: 0.973, blue: 0.945), Color(red: 0.965, green: 0.925, blue: 0.984)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    static let backgroundDark = LinearGradient(
        colors: [Color(red: 0.114, green: 0.086, blue: 0.145), Color(red: 0.157, green: 0.106, blue: 0.204)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - AppIntent zum direkten Abhaken (iOS 17+)

#if canImport(AppIntents)
@available(iOS 17.0, *)
struct ToggleShoppingItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Einkauf abhaken"
    static var description = IntentDescription("Hakt einen Posten der Einkaufsliste ab.")
    static var isDiscoverable: Bool = false

    @Parameter(title: "Item")
    var itemId: String

    @Parameter(title: "Purchased")
    var purchased: Bool

    init() {}

    init(itemId: String, purchased: Bool) {
        self.itemId = itemId
        self.purchased = purchased
    }

    func perform() async throws -> some IntentResult {
        // Sofort im Snapshot spiegeln, damit das Widget ohne Verzögerung umschaltet,
        // und in die Warteschlange legen — die App schreibt es beim nächsten
        // Aktivieren nach Supabase.
        ShoppingWidgetStore.applyOptimisticToggle(itemId: itemId, purchased: purchased)
        ShoppingWidgetStore.queueToggle(itemId: itemId, purchased: purchased)
        return .result()
    }
}
#endif

// MARK: - Timeline

struct ShoppingListEntry: TimelineEntry {
    let date: Date
    let snapshot: ShoppingWidgetSnapshot?
}

struct ShoppingListProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShoppingListEntry {
        ShoppingListEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (ShoppingListEntry) -> Void) {
        let snapshot = ShoppingWidgetStore.readSnapshot()?.forToday() ?? (context.isPreview ? .placeholder : nil)
        completion(ShoppingListEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShoppingListEntry>) -> Void) {
        let entry = ShoppingListEntry(date: Date(), snapshot: ShoppingWidgetStore.readSnapshot()?.forToday())
        // Die App lädt das Widget bei jeder Änderung selbst neu; der Refresh ist
        // ein Sicherheitsnetz — spätestens zum Tageswechsel, damit die gestrigen
        // Abhakungen verschwinden.
        let hourly = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        let midnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 0),
            matchingPolicy: .nextTime
        ) ?? hourly
        let next = min(hourly, midnight)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Maße je Widget-Größe

/// Feste Maße pro Familie. Ohne sie wuchsen die Zeilen über die Widget-Höhe
/// hinaus und iOS hat Header und letzte Zeilen abgeschnitten.
private struct ShoppingMetrics {
    let rowHeight: CGFloat
    let spacing: CGFloat
    let headerHeight: CGFloat
    let padding: CGFloat
    let compact: Bool
    let showProgress: Bool

    static func of(_ family: WidgetFamily) -> ShoppingMetrics {
        switch family {
        case .systemSmall:
            return ShoppingMetrics(rowHeight: 25, spacing: 3, headerHeight: 20, padding: 11, compact: true, showProgress: false)
        case .systemLarge:
            return ShoppingMetrics(rowHeight: 30, spacing: 5, headerHeight: 26, padding: 13, compact: false, showProgress: true)
        default:
            // Das mittlere Widget ist nur 170pt hoch — hier zählt jede Zeile
            // mehr als der Fortschrittsbalken.
            return ShoppingMetrics(rowHeight: 24, spacing: 3, headerHeight: 22, padding: 12, compact: false, showProgress: false)
        }
    }
}

// MARK: - Bausteine

private struct ShoppingHeader: View {
    let snapshot: ShoppingWidgetSnapshot
    let compact: Bool
    let height: CGFloat

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "cart.fill")
                .font(.system(size: compact ? 10 : 11, weight: .bold))
                .foregroundStyle(ShoppingWidgetTheme.primary)
                .frame(width: height, height: height)
                .background(Circle().fill(ShoppingWidgetTheme.primarySoft))

            Text(snapshot.strings.title)
                .font(.system(size: compact ? 12 : 14, weight: .heavy, design: .rounded))
                .foregroundStyle(ShoppingWidgetTheme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Spacer(minLength: 4)

            Text(compact ? "\(snapshot.openCount)" : "\(snapshot.openCount) \(snapshot.strings.openLabel)")
                .font(.system(size: compact ? 10 : 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Capsule().fill(ShoppingWidgetTheme.primary))
        }
        .frame(height: height)
    }
}

/// Dünner Fortschrittsbalken: wie viel der Liste schon erledigt ist.
private struct ShoppingProgress: View {
    let snapshot: ShoppingWidgetSnapshot
    let height: CGFloat

    private var total: Int { snapshot.openCount + snapshot.purchasedCount }
    private var ratio: Double {
        guard total > 0 else { return 0 }
        return Double(snapshot.purchasedCount) / Double(total)
    }

    var body: some View {
        HStack(spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(ShoppingWidgetTheme.primary.opacity(0.15))
                    Capsule()
                        .fill(ShoppingWidgetTheme.done)
                        .frame(width: max(ratio > 0 ? 4 : 0, geo.size.width * ratio))
                }
            }
            .frame(height: 4)

            Text("\(snapshot.purchasedCount)/\(total)")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(ShoppingWidgetTheme.textSecondary.opacity(0.75))
                .lineLimit(1)
        }
        .frame(height: height)
    }
}

private struct ShoppingRow: View {
    let item: ShoppingWidgetItem
    let compact: Bool
    let height: CGFloat

    var body: some View {
        HStack(spacing: compact ? 6 : 8) {
            checkControl

            if !compact {
                Text(item.categoryEmoji)
                    .font(.system(size: 12))
            }

            Text(item.title)
                .font(.system(size: compact ? 12 : 13, weight: .semibold, design: .rounded))
                .foregroundStyle(item.purchased ? ShoppingWidgetTheme.textSecondary.opacity(0.5) : ShoppingWidgetTheme.textPrimary)
                .strikethrough(item.purchased, color: ShoppingWidgetTheme.textSecondary.opacity(0.5))
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            Spacer(minLength: 2)

            if let quantity = item.quantity, !quantity.isEmpty {
                Text(quantity)
                    .font(.system(size: compact ? 9 : 10, weight: .bold, design: .rounded))
                    .foregroundStyle(item.purchased ? ShoppingWidgetTheme.textSecondary.opacity(0.5) : ShoppingWidgetTheme.quantityText)
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(
                        Capsule().fill(
                            item.purchased
                                ? Color.white.opacity(0.35)
                                : ShoppingWidgetTheme.primarySoft
                        )
                    )
            }
        }
        .padding(.horizontal, compact ? 7 : 9)
        .frame(height: height)
        .background(
            RoundedRectangle(cornerRadius: height / 2.6, style: .continuous)
                .fill(Color.white.opacity(item.purchased ? 0.3 : 0.62))
        )
    }

    private var checkIcon: some View {
        Image(systemName: item.purchased ? "checkmark.circle.fill" : "circle")
            .font(.system(size: compact ? 15 : 17, weight: .medium))
            .foregroundStyle(item.purchased ? ShoppingWidgetTheme.done : ShoppingWidgetTheme.primary)
            // Ganze Zeilenhöhe als Trefferfläche, damit der Haken sicher sitzt.
            .frame(width: compact ? 20 : 22, height: height)
            .contentShape(Rectangle())
    }

    @ViewBuilder
    private var checkControl: some View {
        #if canImport(AppIntents)
        if #available(iOS 17.0, *) {
            Button(intent: ToggleShoppingItemIntent(itemId: item.id, purchased: !item.purchased)) {
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

private struct ShoppingEmptyState: View {
    let snapshot: ShoppingWidgetSnapshot
    let compact: Bool

    var body: some View {
        VStack(spacing: 5) {
            Text("🎉")
                .font(.system(size: compact ? 26 : 32))
            Text(snapshot.strings.emptyTitle)
                .font(.system(size: compact ? 12 : 14, weight: .heavy, design: .rounded))
                .foregroundStyle(ShoppingWidgetTheme.textPrimary)
                .multilineTextAlignment(.center)
            if !compact {
                Text(snapshot.strings.emptyHint)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(ShoppingWidgetTheme.textSecondary.opacity(0.8))
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ShoppingSignedOutState: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "cart.fill")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(ShoppingWidgetTheme.primary)
            Text(ShoppingWidgetStrings.fallback.signedOut)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(ShoppingWidgetTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(10)
    }
}

// MARK: - Familien-Layouts

private struct ShoppingListContent: View {
    let snapshot: ShoppingWidgetSnapshot
    let metrics: ShoppingMetrics

    private var totalCount: Int { snapshot.openCount + snapshot.purchasedCount }
    private let footerHeight: CGFloat = 14

    var body: some View {
        // Die Zeilenzahl ergibt sich aus der echten Höhe: feste Werte pro Familie
        // liefen auf kleineren Geräten über und wurden von iOS abgeschnitten.
        GeometryReader { geo in
            let progressBlock: CGFloat = metrics.showProgress ? 12 + metrics.spacing : 0
            let available = max(0, geo.size.height - metrics.headerHeight - progressBlock - metrics.spacing)
            let slot = metrics.rowHeight + metrics.spacing

            // Zwei Durchgänge: erst ohne Hinweiszeile rechnen — und nur wenn
            // wirklich Posten wegfallen, deren Höhe zusätzlich reservieren.
            let plainCapacity = max(1, Int((available + metrics.spacing) / slot))
            let needsFooter = totalCount > plainCapacity
            let usable = needsFooter ? max(0, available - footerHeight - metrics.spacing) : available
            let rowCount = max(1, Int((usable + metrics.spacing) / slot))

            let visible = Array(snapshot.items.prefix(rowCount))
            let hidden = max(0, totalCount - visible.count)

            VStack(alignment: .leading, spacing: metrics.spacing) {
                ShoppingHeader(snapshot: snapshot, compact: metrics.compact, height: metrics.headerHeight)

                if metrics.showProgress && totalCount > 0 {
                    ShoppingProgress(snapshot: snapshot, height: 12)
                }

                if snapshot.items.isEmpty {
                    ShoppingEmptyState(snapshot: snapshot, compact: metrics.compact)
                } else {
                    // Die App liefert offene Posten zuerst. Bewusst nicht neu
                    // sortieren: ein gerade abgehakter Posten bleibt an Ort und
                    // Stelle, sodass sich ein Fehlgriff direkt korrigieren lässt.
                    ForEach(visible) { item in
                        ShoppingRow(item: item, compact: metrics.compact, height: metrics.rowHeight)
                    }

                    if hidden > 0 {
                        Text(String(format: snapshot.strings.moreItems, hidden))
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(ShoppingWidgetTheme.textSecondary.opacity(0.7))
                            .lineLimit(1)
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

struct ShoppingListWidgetEntryView: View {
    var entry: ShoppingListEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    /// Ab iOS 17 setzt WidgetKit selbst Ränder um den Inhalt. Ein zusätzliches
    /// eigenes Padding kostete dort zwei Zeilen.
    private var systemHandlesMargins: Bool {
        if #available(iOS 17.0, *) { return true }
        return false
    }

    var body: some View {
        let metrics = ShoppingMetrics.of(family)
        Group {
            if let snapshot = entry.snapshot {
                ShoppingListContent(snapshot: snapshot, metrics: metrics)
            } else {
                ShoppingSignedOutState()
            }
        }
        .padding(systemHandlesMargins ? 0 : metrics.padding)
        .widgetURL(URL(string: "com.lottibaby.app://shopping-list"))
    }
}

private extension View {
    @ViewBuilder
    func shoppingContainerBackground(_ colorScheme: ColorScheme) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) {
                colorScheme == .dark ? ShoppingWidgetTheme.backgroundDark : ShoppingWidgetTheme.backgroundLight
            }
        } else {
            ZStack {
                (colorScheme == .dark ? ShoppingWidgetTheme.backgroundDark : ShoppingWidgetTheme.backgroundLight)
                self
            }
        }
    }
}

private struct ShoppingListWidgetContainer: View {
    var entry: ShoppingListEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        ShoppingListWidgetEntryView(entry: entry)
            .shoppingContainerBackground(colorScheme)
    }
}

struct ShoppingListWidget: Widget {
    let kind = ShoppingWidgetStore.widgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShoppingListProvider()) { entry in
            ShoppingListWidgetContainer(entry: entry)
        }
        .configurationDisplayName("Einkaufsliste")
        .description("Deine Einkaufsliste direkt abhaken.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
