import ActivityKit

@available(iOS 16.1, *)
struct SleepActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var isTracking: Bool
    var elapsedTimeText: String
    var quality: String?
  }

  var startTime: String
  var startTimestamp: Double?
  var elapsedTimeText: String?
}
