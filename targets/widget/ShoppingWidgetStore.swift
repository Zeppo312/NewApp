import Foundation

// MARK: - Geteilter Speicher für das Einkaufslisten-Widget
//
// Diese Datei ist die einzige Quelle der Wahrheit für das Datenformat zwischen
// App und Widget. Sie wird in das Widget-Target kompiliert und von
// plugins/withShoppingWidgetModule.js zusätzlich in das App-Target kopiert.

public enum ShoppingWidgetStore {
    public static let appGroup = "group.com.LottiBaby.app"
    public static let widgetKind = "LottiBabyShoppingList"

    private static let snapshotKey = "shopping.snapshot.v1"
    private static let pendingKey = "shopping.pendingToggles.v1"

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

    public static func readSnapshot() -> ShoppingWidgetSnapshot? {
        guard
            let raw = defaults?.string(forKey: snapshotKey),
            let data = raw.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(ShoppingWidgetSnapshot.self, from: data)
        else {
            return nil
        }
        return snapshot
    }

    /// Wendet ein Abhaken direkt auf den Snapshot an, damit das Widget sofort
    /// reagiert, ohne auf den nächsten App-Start zu warten.
    public static func applyOptimisticToggle(itemId: String, purchased: Bool) {
        guard
            let raw = defaults?.string(forKey: snapshotKey),
            let data = raw.data(using: .utf8),
            var snapshot = try? JSONDecoder().decode(ShoppingWidgetSnapshot.self, from: data)
        else {
            return
        }

        guard let index = snapshot.items.firstIndex(where: { $0.id == itemId }) else { return }
        snapshot.items[index].purchased = purchased
        snapshot.openCount = snapshot.items.filter { !$0.purchased }.count
        snapshot.purchasedCount = snapshot.items.filter { $0.purchased }.count

        if
            let encoded = try? JSONEncoder().encode(snapshot),
            let encodedString = String(data: encoded, encoding: .utf8)
        {
            defaults?.set(encodedString, forKey: snapshotKey)
        }
    }

    // MARK: Ausstehende Änderungen (Widget → App)

    public static func queueToggle(itemId: String, purchased: Bool) {
        var pending = readPendingToggles()
        // Mehrfaches Tippen auf dieselbe Position ersetzt den alten Eintrag,
        // damit nur der zuletzt gewünschte Zustand synchronisiert wird.
        pending.removeAll { $0.id == itemId }
        pending.append(
            ShoppingWidgetPendingToggle(
                id: itemId,
                purchased: purchased,
                at: Date().timeIntervalSince1970
            )
        )
        writePendingToggles(pending)
    }

    public static func readPendingToggles() -> [ShoppingWidgetPendingToggle] {
        guard
            let raw = defaults?.string(forKey: pendingKey),
            let data = raw.data(using: .utf8),
            let pending = try? JSONDecoder().decode([ShoppingWidgetPendingToggle].self, from: data)
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

    private static func writePendingToggles(_ toggles: [ShoppingWidgetPendingToggle]) {
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

public struct ShoppingWidgetPendingToggle: Codable, Equatable {
    public let id: String
    public let purchased: Bool
    public let at: TimeInterval
}

public struct ShoppingWidgetItem: Codable, Identifiable, Equatable {
    public let id: String
    public let title: String
    public let quantity: String?
    public let category: String
    public var purchased: Bool

    public var categoryEmoji: String {
        switch category {
        case "diapers": return "🧷"
        case "formula": return "🍼"
        case "care": return "🧴"
        case "food": return "🥕"
        default: return "🛒"
        }
    }
}

public struct ShoppingWidgetStrings: Codable, Equatable {
    public let title: String
    public let openLabel: String
    public let doneLabel: String
    public let emptyTitle: String
    public let emptyHint: String
    public let signedOut: String
    public let moreItems: String

    public static let fallback = ShoppingWidgetStrings(
        title: "Einkaufsliste",
        openLabel: "offen",
        doneLabel: "erledigt",
        emptyTitle: "Alles erledigt",
        emptyHint: "Nichts mehr auf der Liste",
        signedOut: "In Lotti Baby öffnen",
        moreItems: "+%d weitere"
    )
}

public struct ShoppingWidgetSnapshot: Codable, Equatable {
    public var updatedAt: TimeInterval
    public var babyName: String?
    public var openCount: Int
    public var purchasedCount: Int
    public var items: [ShoppingWidgetItem]
    public var strings: ShoppingWidgetStrings

    /// Der Snapshot zeigt den heutigen Einkauf. Wird die App über Nacht nicht
    /// geöffnet, ist der gespeicherte Stand von gestern — dann fallen die
    /// abgehakten Posten hier heraus, statt bis zum nächsten App-Start zu bleiben.
    public func forToday(now: Date = Date()) -> ShoppingWidgetSnapshot {
        let writtenAt = Date(timeIntervalSince1970: updatedAt)
        if Calendar.current.isDate(writtenAt, inSameDayAs: now) {
            return self
        }

        var trimmed = self
        trimmed.items = items.filter { !$0.purchased }
        trimmed.purchasedCount = 0
        trimmed.openCount = trimmed.items.count
        return trimmed
    }

    public static let placeholder = ShoppingWidgetSnapshot(
        updatedAt: Date().timeIntervalSince1970,
        babyName: nil,
        openCount: 3,
        purchasedCount: 1,
        items: [
            ShoppingWidgetItem(id: "1", title: "Windeln Gr. 3", quantity: "2 Pkg.", category: "diapers", purchased: false),
            ShoppingWidgetItem(id: "2", title: "Pre-Milch", quantity: "1 Pkg.", category: "formula", purchased: false),
            ShoppingWidgetItem(id: "3", title: "Feuchttücher", quantity: nil, category: "care", purchased: false),
            ShoppingWidgetItem(id: "4", title: "Karotten", quantity: "500 g", category: "food", purchased: true),
        ],
        strings: .fallback
    )
}
