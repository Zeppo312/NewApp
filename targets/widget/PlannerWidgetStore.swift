import Foundation

// MARK: - Geteilter Speicher für die Planer-Widgets
//
// Ein Snapshot versorgt beide Planer-Widgets (Zeitplan und Aufgaben). Wie bei
// der Einkaufsliste ist diese Datei die einzige Quelle der Wahrheit für das
// Datenformat zwischen App und Widget: sie wird in das Widget-Target
// kompiliert und von plugins/withPlannerWidgetModule.js zusätzlich in das
// App-Target kopiert.
//
// Zeitpunkte liegen als Unix-Sekunden vor; Farben als "#rrggbb" in der
// Hell-Variante, das Widget hellt sie im Dunkelmodus selbst auf (wie
// adaptPlannerColor in constants/PlannerColors.ts).

public enum PlannerWidgetStore {
    public static let appGroup = "group.com.LottiBaby.app"
    public static let timelineWidgetKind = "LottiBabyPlannerTimeline"
    public static let tasksWidgetKind = "LottiBabyPlannerTasks"

    private static let snapshotKey = "planner.snapshot.v1"
    private static let pendingKey = "planner.pendingToggles.v1"

    public static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }

    // MARK: Snapshot (App → Widget)

    public static func writeSnapshot(json: String) {
        defaults?.set(json, forKey: snapshotKey)
    }

    public static func clearSnapshot() {
        defaults?.removeObject(forKey: snapshotKey)
    }

    public static func readSnapshot() -> PlannerWidgetSnapshot? {
        guard
            let raw = defaults?.string(forKey: snapshotKey),
            let data = raw.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(PlannerWidgetSnapshot.self, from: data)
        else {
            return nil
        }
        return snapshot
    }

    /// Spiegelt ein Abhaken sofort im Snapshot, damit das Widget nicht auf den
    /// nächsten App-Start warten muss.
    public static func applyOptimisticToggle(itemId: String, completed: Bool) {
        guard var snapshot = readSnapshot() else { return }
        guard let index = snapshot.todos.firstIndex(where: { $0.id == itemId }) else { return }
        snapshot.todos[index].completed = completed
        snapshot.openTodoCount = snapshot.todos.filter { !$0.completed }.count
        snapshot.doneTodoCount = snapshot.todos.filter { $0.completed }.count

        if
            let encoded = try? JSONEncoder().encode(snapshot),
            let encodedString = String(data: encoded, encoding: .utf8)
        {
            defaults?.set(encodedString, forKey: snapshotKey)
        }
    }

    // MARK: Ausstehende Änderungen (Widget → App)

    public static func queueToggle(itemId: String, completed: Bool, seriesId: String?, occurrenceDate: String?) {
        var pending = readPendingToggles()
        // Mehrfaches Tippen ersetzt den alten Eintrag: nur der zuletzt
        // gewünschte Zustand geht nach Supabase.
        pending.removeAll { $0.id == itemId }
        pending.append(
            PlannerWidgetPendingToggle(
                id: itemId,
                completed: completed,
                at: Date().timeIntervalSince1970,
                seriesId: seriesId,
                occurrenceDate: occurrenceDate
            )
        )
        writePendingToggles(pending)
    }

    public static func readPendingToggles() -> [PlannerWidgetPendingToggle] {
        guard
            let raw = defaults?.string(forKey: pendingKey),
            let data = raw.data(using: .utf8),
            let pending = try? JSONDecoder().decode([PlannerWidgetPendingToggle].self, from: data)
        else {
            return []
        }
        return pending
    }

    public static func readPendingTogglesJSON() -> String {
        let pending = readPendingToggles()
        guard
            let encoded = try? JSONEncoder().encode(pending),
            let json = String(data: encoded, encoding: .utf8)
        else {
            return "[]"
        }
        return json
    }

    public static func clearPendingToggles() {
        defaults?.removeObject(forKey: pendingKey)
    }

    private static func writePendingToggles(_ toggles: [PlannerWidgetPendingToggle]) {
        guard
            let encoded = try? JSONEncoder().encode(toggles),
            let json = String(data: encoded, encoding: .utf8)
        else {
            return
        }
        defaults?.set(json, forKey: pendingKey)
    }
}

// MARK: - Modelle

public struct PlannerWidgetPendingToggle: Codable, Equatable {
    public let id: String
    public let completed: Bool
    public let at: TimeInterval
    /// Nur bei wiederkehrenden Aufgaben gesetzt: die App schreibt dann eine
    /// Ausnahme für diesen Tag statt den Eintrag selbst zu ändern.
    public let seriesId: String?
    public let occurrenceDate: String?
}

public struct PlannerWidgetEvent: Codable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public let start: TimeInterval
    public let end: TimeInterval
    public let isAllDay: Bool
    /// "#rrggbb" – Personen- oder Eintragsfarbe, bereits in der App aufgelöst.
    public let color: String
    public let location: String?
    /// Anzeigename der Person, falls der Termin nicht "mir" gehört.
    public let person: String?

    public var startDate: Date { Date(timeIntervalSince1970: start) }
    public var endDate: Date { Date(timeIntervalSince1970: end) }
}

public struct PlannerWidgetTodo: Codable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public var completed: Bool
    /// Fälligkeit; nil bei flexiblen Aufgaben ohne Datum.
    public let dueAt: TimeInterval?
    /// Eigene Farbe des Eintrags ("#rrggbb") oder nil für neutral.
    public let color: String?
    public let person: String?
    public let isRecurring: Bool
    public let seriesId: String?
    public let occurrenceDate: String?

    public var dueDate: Date? {
        guard let dueAt else { return nil }
        return Date(timeIntervalSince1970: dueAt)
    }
}

public struct PlannerWidgetStrings: Codable, Equatable {
    public let timelineTitle: String
    public let tasksTitle: String
    public let openLabel: String
    public let doneLabel: String
    public let flexibleLabel: String
    public let allDayLabel: String
    public let nowLabel: String
    public let noEventsTitle: String
    public let noEventsHint: String
    public let noMoreEventsTitle: String
    public let noTasksTitle: String
    public let noTasksHint: String
    public let moreItems: String
    public let eventsCount: String
    public let signedOut: String
    public let staleHint: String
    public let addTask: String

    public static let fallback = PlannerWidgetStrings(
        timelineTitle: "Planer",
        tasksTitle: "Aufgaben",
        openLabel: "offen",
        doneLabel: "erledigt",
        flexibleLabel: "Flexibel",
        allDayLabel: "Ganztägig",
        nowLabel: "Jetzt",
        noEventsTitle: "Keine Termine",
        noEventsHint: "Heute ist nichts geplant",
        noMoreEventsTitle: "Keine weiteren Termine",
        noTasksTitle: "Alles erledigt",
        noTasksHint: "Keine offenen Aufgaben",
        moreItems: "+%d weitere",
        eventsCount: "%d Termine",
        signedOut: "In Lotti Baby öffnen",
        staleHint: "Zum Aktualisieren App öffnen",
        addTask: "Aufgabe"
    )
}

public struct PlannerWidgetSnapshot: Codable, Equatable {
    public var updatedAt: TimeInterval
    /// Tag, für den der Snapshot gilt ("yyyy-MM-dd" in der Zeitzone der App).
    public var dayKey: String
    public var dayStart: TimeInterval
    /// BCP-47-Tag der App-Sprache für Datums- und Uhrzeitformat.
    public var localeTag: String
    public var events: [PlannerWidgetEvent]
    public var todos: [PlannerWidgetTodo]
    public var openTodoCount: Int
    public var doneTodoCount: Int
    public var strings: PlannerWidgetStrings

    public var dayStartDate: Date { Date(timeIntervalSince1970: dayStart) }

    /// Gilt der Snapshot noch für den heutigen Tag? Ohne App-Start über Nacht
    /// stünden sonst die gestrigen Termine unter dem heutigen Datum.
    public func isForToday(now: Date = Date()) -> Bool {
        Calendar.current.isDate(dayStartDate, inSameDayAs: now)
    }

    public static var placeholder: PlannerWidgetSnapshot {
        let calendar = Calendar.current
        let now = Date()
        let dayStart = calendar.startOfDay(for: now)
        // Die Galerie-Vorschau soll zu jeder Tageszeit Termine zeigen: die
        // Beispiel-Termine liegen deshalb relativ zu „jetzt“ (auf 15 Minuten
        // gerundet), nicht auf festen Uhrzeiten, die abends alle vorbei wären.
        let quarter = ceil(now.timeIntervalSince1970 / 900) * 900
        func at(_ hour: Int, _ minute: Int = 0) -> TimeInterval {
            quarter + TimeInterval(hour * 3600 + minute * 60) - 9 * 3600 - 1800
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        return PlannerWidgetSnapshot(
            updatedAt: Date().timeIntervalSince1970,
            dayKey: formatter.string(from: dayStart),
            dayStart: dayStart.timeIntervalSince1970,
            localeTag: "de-DE",
            events: [
                PlannerWidgetEvent(id: "e1", title: "Kinderarzt U4", start: at(9, 30), end: at(10, 15), isAllDay: false, color: "#4F7FCE", location: "Praxis Dr. Meier", person: "Lotti"),
                PlannerWidgetEvent(id: "e2", title: "Krabbelgruppe", start: at(11), end: at(12), isAllDay: false, color: "#D97A2F", location: nil, person: nil),
                PlannerWidgetEvent(id: "e3", title: "Oma kommt zu Besuch", start: at(15), end: at(17, 30), isAllDay: false, color: "#6E4DBD", location: nil, person: "Familie"),
                PlannerWidgetEvent(id: "e4", title: "Abendessen mit Freunden", start: at(19), end: at(21), isAllDay: false, color: "#3F9A6B", location: "Bei Anna", person: nil),
            ],
            todos: [
                PlannerWidgetTodo(id: "t1", title: "Windeln bestellen", completed: false, dueAt: at(10), color: nil, person: nil, isRecurring: false, seriesId: nil, occurrenceDate: nil),
                PlannerWidgetTodo(id: "t2", title: "Vitamin D geben", completed: false, dueAt: at(8), color: "#C9911C", person: "Lotti", isRecurring: true, seriesId: nil, occurrenceDate: nil),
                PlannerWidgetTodo(id: "t3", title: "Kinderwagen putzen", completed: false, dueAt: nil, color: nil, person: nil, isRecurring: false, seriesId: nil, occurrenceDate: nil),
                PlannerWidgetTodo(id: "t4", title: "Impfpass raussuchen", completed: true, dueAt: nil, color: nil, person: nil, isRecurring: false, seriesId: nil, occurrenceDate: nil),
            ],
            openTodoCount: 3,
            doneTodoCount: 1,
            strings: .fallback
        )
    }
}
