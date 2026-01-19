import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Timer Live Activity for Dynamic Island

/// Attributes for the timer Live Activity
struct TimerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var timeRemaining: Int // seconds
        var totalDuration: Int // seconds
        var isPaused: Bool
        var endTime: Date
    }

    var timerName: String
    var emoji: String
}

// MARK: - Timer Live Activity Widget

@available(iOS 16.1, *)
struct TimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TimerActivityAttributes.self) { context in
            // Lock Screen / Banner view
            TimerLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded regions
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.emoji)
                        .font(.title)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatTime(context.state.timeRemaining))
                        .font(.title2)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                        .foregroundColor(context.state.timeRemaining < 60 ? .red : .primary)
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.timerName)
                        .font(.headline)
                        .lineLimit(1)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    // Progress bar
                    ProgressView(value: progress(for: context))
                        .tint(progressColor(for: context))
                }
            } compactLeading: {
                Text(context.attributes.emoji)
            } compactTrailing: {
                Text(formatTimeCompact(context.state.timeRemaining))
                    .monospacedDigit()
                    .foregroundColor(context.state.timeRemaining < 60 ? .red : .primary)
            } minimal: {
                Text(context.attributes.emoji)
            }
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d", minutes, secs)
    }

    private func formatTimeCompact(_ seconds: Int) -> String {
        if seconds >= 60 {
            return "\(seconds / 60)m"
        }
        return "\(seconds)s"
    }

    private func progress(for context: ActivityViewContext<TimerActivityAttributes>) -> Double {
        let remaining = Double(context.state.timeRemaining)
        let total = Double(context.state.totalDuration)
        return max(0, min(1, 1 - (remaining / total)))
    }

    private func progressColor(for context: ActivityViewContext<TimerActivityAttributes>) -> Color {
        let remaining = context.state.timeRemaining
        if remaining < 30 { return .red }
        if remaining < 60 { return .orange }
        return .teal
    }
}

// MARK: - Lock Screen View

@available(iOS 16.1, *)
struct TimerLockScreenView: View {
    let context: ActivityViewContext<TimerActivityAttributes>

    var body: some View {
        HStack(spacing: 16) {
            // Emoji
            Text(context.attributes.emoji)
                .font(.system(size: 40))

            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.timerName)
                    .font(.headline)
                    .foregroundColor(.primary)

                HStack {
                    Text(timeDisplay)
                        .font(.system(.title, design: .monospaced))
                        .fontWeight(.bold)
                        .foregroundColor(timerColor)

                    if context.state.isPaused {
                        Text("PAUSED")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.orange.opacity(0.2))
                            .cornerRadius(4)
                    }
                }
            }

            Spacer()

            // Circular progress
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.3), lineWidth: 4)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(timerColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: 44, height: 44)
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
    }

    private var timeDisplay: String {
        let seconds = context.state.timeRemaining
        let minutes = seconds / 60
        let secs = seconds % 60
        return String(format: "%d:%02d", minutes, secs)
    }

    private var progress: Double {
        let remaining = Double(context.state.timeRemaining)
        let total = Double(context.state.totalDuration)
        return max(0, min(1, 1 - (remaining / total)))
    }

    private var timerColor: Color {
        let remaining = context.state.timeRemaining
        if remaining < 30 { return .red }
        if remaining < 60 { return .orange }
        return .teal
    }
}

// MARK: - Live Activity Manager

@available(iOS 16.1, *)
class TimerActivityManager {
    static let shared = TimerActivityManager()

    private var currentActivity: Activity<TimerActivityAttributes>?

    /// Start a new timer Live Activity
    func startTimer(name: String, emoji: String, duration: Int) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("Live Activities are not enabled")
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
        } catch {
            print("Failed to start Live Activity: \(error)")
        }
    }

    /// Update the timer Live Activity
    func updateTimer(timeRemaining: Int, isPaused: Bool = false) {
        guard let activity = currentActivity else { return }

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
        }
    }

    /// End the timer Live Activity
    func endTimer(completed: Bool = true) {
        guard let activity = currentActivity else { return }

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
        }

        currentActivity = nil
    }
}
