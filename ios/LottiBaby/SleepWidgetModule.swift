import Foundation
import React
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Brücke für das Schlaf-Widget. Bewusst schmaler als ShoppingWidgetModule:
/// das Widget schreibt nichts zurück, es zeigt nur an und verlinkt in die App.
@objc(SleepWidgetModule)
class SleepWidgetModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private func reloadWidget() {
    #if canImport(WidgetKit)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: SleepWidgetStore.widgetKind)
    }
    #endif
  }

  /// Schreibt den aktuellen Schlafstand in die App-Group und lädt das Widget
  /// neu. `json` ist ein serialisierter SleepWidgetSnapshot.
  @objc
  func syncSnapshot(
    _ json: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard SleepWidgetStore.defaults != nil else {
      reject("app_group_unavailable", "App-Group \(SleepWidgetStore.appGroup) ist nicht verfügbar.", nil)
      return
    }
    SleepWidgetStore.writeSnapshot(json: json as String)
    reloadWidget()
    resolve(true)
  }

  /// Entfernt den Snapshot, z. B. beim Abmelden oder ohne aktives Baby.
  @objc
  func clearSnapshot(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    SleepWidgetStore.clearSnapshot()
    reloadWidget()
    resolve(true)
  }

  @objc
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(SleepWidgetStore.defaults != nil)
  }
}
