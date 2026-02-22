import ActivityKit

@available(iOS 16.1, *)
struct SleepActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var isTracking: Bool
    var elapsedTimeText: String
    var quality: String?
    var feedingType: String?
  }

  var startTime: String
  var startTimestamp: Double?
  var elapsedTimeText: String?
  var babyName: String?
  var activityType: String?
  var feedingType: String?
}
