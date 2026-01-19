import Foundation
import Capacitor
import ActivityKit

/// Capacitor plugin for managing Live Activities
@available(iOS 16.1, *)
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startTimerActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateTimerActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endTimerActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
    ]

    private var currentActivity: Activity<TimerActivityAttributes>?

    @objc func isAvailable(_ call: CAPPluginCall) {
        let available = ActivityAuthorizationInfo().areActivitiesEnabled
        call.resolve(["available": available])
    }

    @objc func startTimerActivity(_ call: CAPPluginCall) {
        guard let name = call.getString("name"),
              let emoji = call.getString("emoji"),
              let duration = call.getInt("duration") else {
            call.reject("Missing required parameters")
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are not enabled")
            return
        }

        let attributes = TimerActivityAttributes(timerName: name, emoji: emoji)
        let endTime = Date().addingTimeInterval(TimeInterval(duration))

        let contentState = TimerActivityAttributes.ContentState(
            timeRemaining: duration,
            totalDuration: duration,
            isPaused: false,
            endTime: endTime
        )

        do {
            currentActivity = try Activity.request(
                attributes: attributes,
                content: .init(state: contentState, staleDate: endTime),
                pushType: nil
            )

            call.resolve(["activityId": currentActivity?.id ?? "unknown"])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func updateTimerActivity(_ call: CAPPluginCall) {
        guard let timeRemaining = call.getInt("timeRemaining") else {
            call.reject("Missing timeRemaining parameter")
            return
        }

        let isPaused = call.getBool("isPaused") ?? false

        guard let activity = currentActivity else {
            call.reject("No active timer activity")
            return
        }

        Task {
            let endTime = isPaused ? Date() : Date().addingTimeInterval(TimeInterval(timeRemaining))

            let contentState = TimerActivityAttributes.ContentState(
                timeRemaining: timeRemaining,
                totalDuration: activity.content.state.totalDuration,
                isPaused: isPaused,
                endTime: endTime
            )

            await activity.update(
                ActivityContent(state: contentState, staleDate: endTime)
            )

            call.resolve()
        }
    }

    @objc func endTimerActivity(_ call: CAPPluginCall) {
        let completed = call.getBool("completed") ?? true

        guard let activity = currentActivity else {
            call.resolve()
            return
        }

        Task {
            let finalState = TimerActivityAttributes.ContentState(
                timeRemaining: 0,
                totalDuration: activity.content.state.totalDuration,
                isPaused: false,
                endTime: Date()
            )

            await activity.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .immediate
            )

            self.currentActivity = nil
            call.resolve()
        }
    }
}

// Objective-C wrapper for iOS version check
@objc(LiveActivityPluginWrapper)
public class LiveActivityPluginWrapper: CAPPlugin {
    public override func load() {
        if #available(iOS 16.1, *) {
            // Plugin is available
        }
    }
}
