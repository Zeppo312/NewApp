import Foundation
import React
#if canImport(WidgetKit)
import WidgetKit
#endif

@objc(ShoppingWidgetModule)
class ShoppingWidgetModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private func reloadWidget() {
    #if canImport(WidgetKit)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: ShoppingWidgetStore.widgetKind)
    }
    #endif
  }

  /// Schreibt den aktuellen Stand der Einkaufsliste in die App-Group und lädt
  /// das Widget neu. `json` ist ein serialisierter ShoppingWidgetSnapshot.
  @objc
  func syncSnapshot(
    _ json: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard ShoppingWidgetStore.defaults != nil else {
      reject("app_group_unavailable", "App-Group \(ShoppingWidgetStore.appGroup) ist nicht verfügbar.", nil)
      return
    }
    ShoppingWidgetStore.writeSnapshot(json: json as String)
    reloadWidget()
    resolve(true)
  }

  /// Entfernt den Snapshot (z. B. beim Abmelden oder Baby-Wechsel ohne Daten).
  @objc
  func clearSnapshot(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    ShoppingWidgetStore.clearSnapshot()
    ShoppingWidgetStore.clearPendingToggles()
    reloadWidget()
    resolve(true)
  }

  /// Liefert die im Widget abgehakten Posten als JSON-Array und leert die
  /// Warteschlange. Wird beim Aktivieren der App aufgerufen.
  @objc
  func consumePendingToggles(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let json = ShoppingWidgetStore.readPendingTogglesJSON()
    ShoppingWidgetStore.clearPendingToggles()
    resolve(json)
  }

  @objc
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(ShoppingWidgetStore.defaults != nil)
  }
}
