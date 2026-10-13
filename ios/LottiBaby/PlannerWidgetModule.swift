import Foundation
import React
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Brücke für die Planer-Widgets (Zeitplan + Aufgaben). Wie beim
/// Einkaufslisten-Widget in beide Richtungen: die App schreibt den Snapshot,
/// im Widget abgehakte Aufgaben kommen als Warteschlange zurück.
@objc(PlannerWidgetModule)
class PlannerWidgetModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private func reloadWidgets() {
    #if canImport(WidgetKit)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: PlannerWidgetStore.timelineWidgetKind)
      WidgetCenter.shared.reloadTimelines(ofKind: PlannerWidgetStore.tasksWidgetKind)
    }
    #endif
  }

  /// Schreibt den Tagesstand des Planers in die App-Group und lädt beide
  /// Widgets neu. `json` ist ein serialisierter PlannerWidgetSnapshot.
  @objc
  func syncSnapshot(
    _ json: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard PlannerWidgetStore.defaults != nil else {
      reject("app_group_unavailable", "App-Group \(PlannerWidgetStore.appGroup) ist nicht verfügbar.", nil)
      return
    }
    PlannerWidgetStore.writeSnapshot(json: json as String)
    reloadWidgets()
    resolve(true)
  }

  /// Entfernt den Snapshot, z. B. beim Abmelden.
  @objc
  func clearSnapshot(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    PlannerWidgetStore.clearSnapshot()
    PlannerWidgetStore.clearPendingToggles()
    reloadWidgets()
    resolve(true)
  }

  /// Liefert die im Widget abgehakten Aufgaben als JSON-Array und leert die
  /// Warteschlange. Wird beim Aktivieren der App aufgerufen.
  @objc
  func consumePendingToggles(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let json = PlannerWidgetStore.readPendingTogglesJSON()
    PlannerWidgetStore.clearPendingToggles()
    resolve(json)
  }

  @objc
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(PlannerWidgetStore.defaults != nil)
  }
}
