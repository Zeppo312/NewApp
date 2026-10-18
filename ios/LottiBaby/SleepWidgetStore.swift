import Foundation

// MARK: - Geteilter Speicher für das Schlaf-Widget
//
// Wie ShoppingWidgetStore die einzige Quelle der Wahrheit für das Datenformat
// zwischen App und Widget. Sie wird in das Widget-Target kompiliert und von
// plugins/withSleepWidgetModule.js zusätzlich in das App-Target kopiert.
//
// Zeitpunkte liegen als Unix-Sekunden vor, damit das Widget sie an
// `Text(_:style:)` weiterreichen kann: der Timer läuft dann ohne
// Timeline-Aktualisierung weiter.

public enum SleepWidgetStore {
    public static let appGroup = "group.com.LottiBaby.app"
    public static let widgetKind = "LottiBabySleep"

    private static let snapshotKey = "sleep.snapshot.v1"

    public static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }

    public static func writeSnapshot(json: String) {
        defaults?.set(json, forKey: snapshotKey)
    }

    public static func clearSnapshot() {
        defaults?.removeObject(forKey: snapshotKey)
    }

    public static func readSnapshot() -> SleepWidgetSnapshot? {
        guard
            let raw = defaults?.string(forKey: snapshotKey),
            let data = raw.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(SleepWidgetSnapshot.self, from: data)
        else {
            return nil
        }
        return snapshot
    }
}

// MARK: - Modelle

/// Ein Schlafabschnitt des heutigen Tages, bereits auf die Tagesgrenzen
/// zugeschnitten. Ein Nachtschlaf über Mitternacht kommt also als Abschnitt ab
/// 00:00 an, nicht mit seiner echten Startzeit vom Vorabend.
public struct SleepWidgetSegment: Codable, Equatable, Identifiable {
    public let id: String
    public let start: TimeInterval
    public let end: TimeInterval
    public let isNight: Bool
    /// Läuft dieser Abschnitt gerade noch? Dann endet er im Verlauf bei „jetzt".
    public let ongoing: Bool

    public var startDate: Date { Date(timeIntervalSince1970: start) }
    public var endDate: Date { Date(timeIntervalSince1970: end) }
}

public struct SleepWidgetStrings: Codable, Equatable {
    public let title: String
    public let sleepingLabel: String
    public let awakeLabel: String
    public let nextNapLabel: String
    public let nextBedtimeLabel: String
    public let windowOpenLabel: String
    public let todayLabel: String
    public let napsLabel: String
    public let lastSleepLabel: String
    public let startAction: String
    public let noWindowHint: String
    public let signedOut: String
    /// Kurzformen für Dauern ("Std"/"Min"), damit die Formatierung im Widget
    /// derselben Sprache folgt wie die App.
    public let hourShort: String
    public let minuteShort: String
    public let timelineLabel: String
    public let timelineEmpty: String

    public static let fallback = SleepWidgetStrings(
        title: "Schlaf",
        sleepingLabel: "schläft seit",
        awakeLabel: "wach seit",
        nextNapLabel: "Nächstes Schläfchen",
        nextBedtimeLabel: "Schlafenszeit",
        windowOpenLabel: "Fenster offen",
        todayLabel: "Heute",
        napsLabel: "%d Schläfchen",
        lastSleepLabel: "Zuletzt",
        startAction: "Schlaf starten",
        noWindowHint: "Noch keine Vorhersage",
        signedOut: "In Lotti Baby öffnen",
        hourShort: "Std",
        minuteShort: "Min",
        timelineLabel: "Verlauf",
        timelineEmpty: "Heute noch kein Schlaf"
    )
}

public struct SleepWidgetSnapshot: Codable, Equatable {
    public var updatedAt: TimeInterval
    public var babyName: String?

    /// Läuft gerade ein Schlaf-Timer?
    public var isSleeping: Bool
    /// Beginn des laufenden Schlafs — nur gesetzt, wenn `isSleeping`.
    public var sleepStartedAt: TimeInterval?
    /// Ende des letzten abgeschlossenen Schlafs, Grundlage für „wach seit".
    public var awakeSince: TimeInterval?
    /// Dauer des letzten abgeschlossenen Schlafs in Minuten.
    public var lastSleepMinutes: Int?

    /// Empfohlener Beginn des nächsten Schlafs plus Fenstergrenzen. Fehlen sie,
    /// war die Vorhersage zu unsicher (dieselbe Schwelle wie für die
    /// Schlafenszeit-Erinnerung).
    public var windowStart: TimeInterval?
    public var windowEarliest: TimeInterval?
    public var windowLatest: TimeInterval?
    /// "nap" oder "night_sleep"
    public var windowKind: String?

    public var todayMinutes: Int
    public var todayNapCount: Int

    /// Beginn des Tages, auf den sich Segmente und Tagesbilanz beziehen.
    /// Kommt aus der App, damit Widget und App dieselbe Zeitzone benutzen.
    public var dayStart: TimeInterval?
    /// Schlafabschnitte des Tages für den Verlaufsbalken. Optional, damit ein
    /// älterer Snapshot ohne dieses Feld nicht die ganze Dekodierung sprengt.
    public var segments: [SleepWidgetSegment]?

    public var strings: SleepWidgetStrings

    public var isNightSleepWindow: Bool { windowKind == "night_sleep" }

    public var daySegments: [SleepWidgetSegment] { segments ?? [] }

    /// Tagesbeginn für den Verlauf. Fehlt er im Snapshot (ältere Fassung),
    /// rechnet das Widget ihn selbst aus.
    public func dayStartDate(now: Date = Date()) -> Date {
        if let dayStart { return Date(timeIntervalSince1970: dayStart) }
        return Calendar.current.startOfDay(for: now)
    }

    /// Liegt der empfohlene Beginn schon in der Vergangenheit, ist das Fenster
    /// offen — das Widget sagt dann „jetzt", statt eine vergangene Uhrzeit zu
    /// zeigen.
    public func isWindowOpen(now: Date = Date()) -> Bool {
        guard let windowStart else { return false }
        return windowStart <= now.timeIntervalSince1970
    }

    public var startDate: Date? {
        sleepStartedAt.map { Date(timeIntervalSince1970: $0) }
    }

    public var awakeSinceDate: Date? {
        awakeSince.map { Date(timeIntervalSince1970: $0) }
    }

    public var windowStartDate: Date? {
        windowStart.map { Date(timeIntervalSince1970: $0) }
    }

    public var windowLatestDate: Date? {
        windowLatest.map { Date(timeIntervalSince1970: $0) }
    }

    /// Räumt einen Snapshot auf, der aus einem früheren Tag stammt.
    ///
    /// Wird die App über Nacht nicht geöffnet, stünde sonst die Tagesbilanz von
    /// gestern im Widget — „Heute 12 Std." am nächsten Morgen wäre schlicht
    /// falsch. Ein laufender Schlaf über Mitternacht bleibt dagegen stehen: der
    /// Timer ist auch am Folgetag noch die richtige Antwort.
    public func normalized(now: Date = Date()) -> SleepWidgetSnapshot {
        var result = self

        // Ein Timer, der seit über 24 Stunden läuft, wurde in der App vergessen
        // zu stoppen. Ihn weiterzuzählen sähe nach einem Defekt aus.
        if let startedAt = sleepStartedAt, now.timeIntervalSince1970 - startedAt > 24 * 3600 {
            result.isSleeping = false
            result.sleepStartedAt = nil
        }

        let writtenAt = Date(timeIntervalSince1970: updatedAt)
        if !Calendar.current.isDate(writtenAt, inSameDayAs: now) {
            result.todayMinutes = 0
            result.todayNapCount = 0
            // Der Verlauf gehört zum selben Tag wie die Bilanz — sonst zeigte
            // der Balken am Morgen noch die Abschnitte von gestern.
            result.segments = []
            result.dayStart = Calendar.current.startOfDay(for: now).timeIntervalSince1970
        }

        // Ein Fenster, dessen spätester Zeitpunkt lange vorbei ist, taugt nicht
        // mehr als Vorhersage.
        if let latest = windowLatest, now.timeIntervalSince1970 - latest > 3 * 3600 {
            result.windowStart = nil
            result.windowEarliest = nil
            result.windowLatest = nil
            result.windowKind = nil
        }

        return result
    }

    public static let placeholder = SleepWidgetSnapshot(
        updatedAt: Date().timeIntervalSince1970,
        babyName: nil,
        isSleeping: false,
        sleepStartedAt: nil,
        awakeSince: Date().addingTimeInterval(-72 * 60).timeIntervalSince1970,
        lastSleepMinutes: 45,
        windowStart: Date().addingTimeInterval(23 * 60).timeIntervalSince1970,
        windowEarliest: Date().addingTimeInterval(13 * 60).timeIntervalSince1970,
        windowLatest: Date().addingTimeInterval(43 * 60).timeIntervalSince1970,
        windowKind: "nap",
        todayMinutes: 260,
        todayNapCount: 3,
        dayStart: Calendar.current.startOfDay(for: Date()).timeIntervalSince1970,
        segments: {
            let dayStart = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970
            let hour: TimeInterval = 3600
            return [
                SleepWidgetSegment(id: "n", start: dayStart, end: dayStart + 6 * hour, isNight: true, ongoing: false),
                SleepWidgetSegment(id: "a", start: dayStart + 9 * hour, end: dayStart + 10.25 * hour, isNight: false, ongoing: false),
                SleepWidgetSegment(id: "b", start: dayStart + 12.5 * hour, end: dayStart + 14 * hour, isNight: false, ongoing: false),
                SleepWidgetSegment(id: "c", start: dayStart + 16.5 * hour, end: dayStart + 17.25 * hour, isNight: false, ongoing: false),
            ]
        }(),
        strings: .fallback
    )
}
