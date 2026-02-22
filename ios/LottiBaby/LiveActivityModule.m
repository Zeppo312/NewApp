#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startSleepActivity:(NSString *)startTimeISO
                  elapsedTimeText:(NSString *)elapsedTimeText
                  babyName:(NSString * _Nullable)babyName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateSleepActivity:(NSString *)activityId
                  elapsedTimeText:(NSString *)elapsedTimeText
                  quality:(NSString * _Nullable)quality
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endSleepActivity:(NSString *)activityId
                  elapsedTimeText:(NSString *)elapsedTimeText
                  quality:(NSString * _Nullable)quality
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCurrentSleepActivity:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endAllSleepActivities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startFeedingActivity:(NSString *)startTimeISO
                  elapsedTimeText:(NSString *)elapsedTimeText
                  babyName:(NSString * _Nullable)babyName
                  feedingType:(NSString * _Nullable)feedingType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateFeedingActivity:(NSString *)activityId
                  elapsedTimeText:(NSString *)elapsedTimeText
                  feedingType:(NSString * _Nullable)feedingType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endFeedingActivity:(NSString *)activityId
                  elapsedTimeText:(NSString *)elapsedTimeText
                  feedingType:(NSString * _Nullable)feedingType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCurrentFeedingActivity:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endAllFeedingActivities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
