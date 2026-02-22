import ActivityKit
import Foundation
import React

private enum LiveActivityDateParser {
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
}

@available(iOS 16.1, *)
private enum LiveActivityType: String {
  case sleep
  case feeding

  static func from(_ rawValue: String?) -> LiveActivityType {
    guard let normalized = rawValue?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased(),
      !normalized.isEmpty
    else {
      return .sleep
    }

    return LiveActivityType(rawValue: normalized) ?? .sleep
  }
}

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(isSupported:rejecter:)
  func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.1, *) {
      resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
    } else {
      resolve(false)
    }
  }

  @available(iOS 16.1, *)
  private func normalizeFeedingType(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }

    return value.uppercased()
  }

  @available(iOS 16.1, *)
  private func matches(
    _ activity: Activity<SleepActivityAttributes>,
    type expectedType: LiveActivityType
  ) -> Bool {
    let currentType = LiveActivityType.from(activity.attributes.activityType)
    return currentType == expectedType
  }

  @available(iOS 16.1, *)
  private func makeAttributes(
    startTimeISO: String,
    elapsedTimeText: String,
    babyName: String?,
    activityType: LiveActivityType,
    feedingType: String?
  ) -> SleepActivityAttributes {
    SleepActivityAttributes(
      startTime: startTimeISO,
      startTimestamp: LiveActivityDateParser.parse(startTimeISO)?.timeIntervalSince1970 ?? Date().timeIntervalSince1970,
      elapsedTimeText: elapsedTimeText,
      babyName: babyName,
      activityType: activityType.rawValue,
      feedingType: feedingType
    )
  }

  @available(iOS 16.1, *)
  private func makeState(
    isTracking: Bool,
    elapsedTimeText: String,
    quality: String? = nil,
    feedingType: String? = nil
  ) -> SleepActivityAttributes.ContentState {
    SleepActivityAttributes.ContentState(
      isTracking: isTracking,
      elapsedTimeText: elapsedTimeText,
      quality: quality,
      feedingType: feedingType
    )
  }

  @available(iOS 16.1, *)
  private func findActivity(
    withId activityId: String,
    type expectedType: LiveActivityType
  ) -> Activity<SleepActivityAttributes>? {
    Activity<SleepActivityAttributes>.activities.first { activity in
      activity.id == activityId && matches(activity, type: expectedType)
    }
  }

  @available(iOS 16.1, *)
  private func serialize(
    _ activity: Activity<SleepActivityAttributes>
  ) -> [String: Any] {
    [
      "id": activity.id,
      "startTime": activity.attributes.startTime,
      "startTimestamp": activity.attributes.startTimestamp as Any,
      "elapsedTimeText": activity.contentState.elapsedTimeText,
      "isTracking": activity.contentState.isTracking,
      "quality": activity.contentState.quality as Any,
      "babyName": activity.attributes.babyName as Any,
      "activityType": activity.attributes.activityType as Any,
      "feedingType": (activity.contentState.feedingType ?? activity.attributes.feedingType) as Any,
    ]
  }

  @objc(startSleepActivity:elapsedTimeText:babyName:resolver:rejecter:)
  func startSleepActivity(
    _ startTimeISO: String,
    elapsedTimeText: String,
    babyName: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      resolve(nil)
      return
    }

    Task {
      do {
        for activity in Activity<SleepActivityAttributes>.activities where matches(activity, type: .sleep) {
          await activity.end(using: activity.contentState, dismissalPolicy: .immediate)
        }

        let attributes = makeAttributes(
          startTimeISO: startTimeISO,
          elapsedTimeText: elapsedTimeText,
          babyName: babyName,
          activityType: .sleep,
          feedingType: nil
        )

        let state = makeState(
          isTracking: true,
          elapsedTimeText: elapsedTimeText,
          quality: nil,
          feedingType: nil
        )

        let activity = try Activity<SleepActivityAttributes>.request(
          attributes: attributes,
          contentState: state,
          pushType: nil
        )

        resolve(activity.id)
      } catch {
        reject("E_LIVE_ACTIVITY_START", "Failed to start sleep live activity", error)
      }
    }
  }

  @objc(updateSleepActivity:elapsedTimeText:quality:resolver:rejecter:)
  func updateSleepActivity(
    _ activityId: String,
    elapsedTimeText: String,
    quality: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    guard let activity = findActivity(withId: activityId, type: .sleep) else {
      resolve(false)
      return
    }

    Task {
      let state = makeState(
        isTracking: true,
        elapsedTimeText: elapsedTimeText,
        quality: quality,
        feedingType: nil
      )
      await activity.update(using: state)
      resolve(true)
    }
  }

  @objc(endSleepActivity:elapsedTimeText:quality:resolver:rejecter:)
  func endSleepActivity(
    _ activityId: String,
    elapsedTimeText: String,
    quality: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    guard let activity = findActivity(withId: activityId, type: .sleep) else {
      resolve(false)
      return
    }

    Task {
      let finalState = makeState(
        isTracking: false,
        elapsedTimeText: elapsedTimeText,
        quality: quality,
        feedingType: nil
      )
      await activity.end(using: finalState, dismissalPolicy: .immediate)
      resolve(true)
    }
  }

  @objc(getCurrentSleepActivity:rejecter:)
  func getCurrentSleepActivity(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    guard let activity = Activity<SleepActivityAttributes>.activities.first(where: { matches($0, type: .sleep) }) else {
      resolve(nil)
      return
    }

    resolve(serialize(activity))
  }

  @objc(endAllSleepActivities:rejecter:)
  func endAllSleepActivities(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    Task {
      for activity in Activity<SleepActivityAttributes>.activities where matches(activity, type: .sleep) {
        await activity.end(using: activity.contentState, dismissalPolicy: .immediate)
      }
      resolve(true)
    }
  }

  @objc(startFeedingActivity:elapsedTimeText:babyName:feedingType:resolver:rejecter:)
  func startFeedingActivity(
    _ startTimeISO: String,
    elapsedTimeText: String,
    babyName: String?,
    feedingType: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      resolve(nil)
      return
    }

    Task {
      do {
        for activity in Activity<SleepActivityAttributes>.activities where matches(activity, type: .feeding) {
          await activity.end(using: activity.contentState, dismissalPolicy: .immediate)
        }

        let normalizedFeedingType = normalizeFeedingType(feedingType) ?? "BREAST"

        let attributes = makeAttributes(
          startTimeISO: startTimeISO,
          elapsedTimeText: elapsedTimeText,
          babyName: babyName,
          activityType: .feeding,
          feedingType: normalizedFeedingType
        )

        let state = makeState(
          isTracking: true,
          elapsedTimeText: elapsedTimeText,
          quality: nil,
          feedingType: normalizedFeedingType
        )

        let activity = try Activity<SleepActivityAttributes>.request(
          attributes: attributes,
          contentState: state,
          pushType: nil
        )

        resolve(activity.id)
      } catch {
        reject("E_LIVE_ACTIVITY_START", "Failed to start feeding live activity", error)
      }
    }
  }

  @objc(updateFeedingActivity:elapsedTimeText:feedingType:resolver:rejecter:)
  func updateFeedingActivity(
    _ activityId: String,
    elapsedTimeText: String,
    feedingType: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    guard let activity = findActivity(withId: activityId, type: .feeding) else {
      resolve(false)
      return
    }

    Task {
      let normalizedFeedingType = normalizeFeedingType(feedingType)
        ?? activity.contentState.feedingType
        ?? activity.attributes.feedingType
        ?? "BREAST"

      let state = makeState(
        isTracking: true,
        elapsedTimeText: elapsedTimeText,
        quality: nil,
        feedingType: normalizedFeedingType
      )
      await activity.update(using: state)
      resolve(true)
    }
  }

  @objc(endFeedingActivity:elapsedTimeText:feedingType:resolver:rejecter:)
  func endFeedingActivity(
    _ activityId: String,
    elapsedTimeText: String,
    feedingType: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    guard let activity = findActivity(withId: activityId, type: .feeding) else {
      resolve(false)
      return
    }

    Task {
      let normalizedFeedingType = normalizeFeedingType(feedingType)
        ?? activity.contentState.feedingType
        ?? activity.attributes.feedingType
        ?? "BREAST"

      let finalState = makeState(
        isTracking: false,
        elapsedTimeText: elapsedTimeText,
        quality: nil,
        feedingType: normalizedFeedingType
      )
      await activity.end(using: finalState, dismissalPolicy: .immediate)
      resolve(true)
    }
  }

  @objc(getCurrentFeedingActivity:rejecter:)
  func getCurrentFeedingActivity(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(nil)
      return
    }

    guard let activity = Activity<SleepActivityAttributes>.activities.first(where: { matches($0, type: .feeding) }) else {
      resolve(nil)
      return
    }

    resolve(serialize(activity))
  }

  @objc(endAllFeedingActivities:rejecter:)
  func endAllFeedingActivities(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(false)
      return
    }

    Task {
      for activity in Activity<SleepActivityAttributes>.activities where matches(activity, type: .feeding) {
        await activity.end(using: activity.contentState, dismissalPolicy: .immediate)
      }
      resolve(true)
    }
  }
}
