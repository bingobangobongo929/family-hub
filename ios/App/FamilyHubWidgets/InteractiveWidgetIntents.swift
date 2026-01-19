import AppIntents
import WidgetKit
import SwiftUI

// MARK: - Interactive Widget Intents (iOS 17+)

/// Toggle shopping item completion from widget
@available(iOS 17.0, *)
struct ToggleShoppingItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Shopping Item"
    static var description = IntentDescription("Mark a shopping item as complete or incomplete")

    @Parameter(title: "Item ID")
    var itemId: String

    init() {}

    init(itemId: String) {
        self.itemId = itemId
    }

    func perform() async throws -> some IntentResult {
        // Read current data
        guard let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName),
              var data = defaults.data(forKey: AppGroupConstants.shoppingDataKey),
              var decoded = try? JSONDecoder().decode(ShoppingWidgetData.self, from: data) else {
            return .result()
        }

        // Toggle the item
        if let index = decoded.items.firstIndex(where: { $0.id == itemId }) {
            decoded.items[index].isCompleted.toggle()
            decoded.lastUpdated = Date()

            // Save back
            if let encoded = try? JSONEncoder().encode(decoded) {
                defaults.set(encoded, forKey: AppGroupConstants.shoppingDataKey)
                defaults.synchronize()
            }

            // Refresh widget
            WidgetCenter.shared.reloadTimelines(ofKind: "ShoppingListWidget")
        }

        return .result()
    }
}

/// Complete a routine step from widget
@available(iOS 17.0, *)
struct CompleteRoutineStepIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Routine Step"
    static var description = IntentDescription("Mark a routine step as complete")

    @Parameter(title: "Routine ID")
    var routineId: String

    @Parameter(title: "Step Index")
    var stepIndex: Int

    init() {}

    init(routineId: String, stepIndex: Int) {
        self.routineId = routineId
        self.stepIndex = stepIndex
    }

    func perform() async throws -> some IntentResult {
        // Read current data
        guard let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName),
              var data = defaults.data(forKey: AppGroupConstants.routinesDataKey),
              var decoded = try? JSONDecoder().decode(RoutinesWidgetData.self, from: data) else {
            return .result()
        }

        // Update the routine
        if let index = decoded.routines.firstIndex(where: { $0.id == routineId }) {
            decoded.routines[index].completedSteps = min(
                decoded.routines[index].completedSteps + 1,
                decoded.routines[index].totalSteps
            )
            decoded.lastUpdated = Date()

            // Save back
            if let encoded = try? JSONEncoder().encode(decoded) {
                defaults.set(encoded, forKey: AppGroupConstants.routinesDataKey)
                defaults.synchronize()
            }

            // Refresh widget
            WidgetCenter.shared.reloadTimelines(ofKind: "RoutineStatusWidget")
        }

        return .result()
    }
}

// MARK: - Interactive Shopping Widget (iOS 17+)

@available(iOS 17.0, *)
struct InteractiveShoppingItemView: View {
    let item: ShoppingItem

    var body: some View {
        Button(intent: ToggleShoppingItemIntent(itemId: item.id)) {
            HStack(spacing: 8) {
                // Checkbox
                ZStack {
                    Circle()
                        .stroke(item.isCompleted ? Color.teal : Color.gray.opacity(0.3), lineWidth: 2)
                        .frame(width: 22, height: 22)

                    if item.isCompleted {
                        Circle()
                            .fill(Color.teal)
                            .frame(width: 16, height: 16)

                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                    }
                }

                // Item name
                Text(item.name)
                    .font(.subheadline)
                    .foregroundColor(item.isCompleted ? .secondary : .primary)
                    .strikethrough(item.isCompleted)
                    .lineLimit(1)

                Spacer()

                // Quantity
                if let quantity = item.quantity, quantity > 1 {
                    Text("×\(quantity)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Interactive Routine Widget (iOS 17+)

@available(iOS 17.0, *)
struct InteractiveRoutineView: View {
    let routine: RoutineStatus

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text(routine.emoji)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(routine.title)
                        .font(.headline)
                        .lineLimit(1)

                    Text(routine.memberName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Progress
                Text("\(routine.completedSteps)/\(routine.totalSteps)")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(routine.completedSteps == routine.totalSteps ? .green : .primary)
            }

            // Next step button
            if routine.completedSteps < routine.totalSteps {
                Button(intent: CompleteRoutineStepIntent(routineId: routine.id, stepIndex: routine.completedSteps)) {
                    HStack {
                        Image(systemName: "checkmark.circle")
                        Text("Complete Step \(routine.completedSteps + 1)")
                    }
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.teal)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            } else {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text("All done!")
                }
                .font(.subheadline)
                .foregroundColor(.green)
            }
        }
        .padding()
    }
}

// MARK: - Conditional Interactive Views

struct ConditionalInteractiveShoppingItem: View {
    let item: ShoppingItem

    var body: some View {
        if #available(iOS 17.0, *) {
            InteractiveShoppingItemView(item: item)
        } else {
            // Non-interactive fallback
            HStack(spacing: 8) {
                Circle()
                    .stroke(item.isCompleted ? Color.teal : Color.gray.opacity(0.3), lineWidth: 2)
                    .frame(width: 22, height: 22)
                    .overlay(
                        item.isCompleted ?
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.teal)
                        : nil
                    )

                Text(item.name)
                    .font(.subheadline)
                    .foregroundColor(item.isCompleted ? .secondary : .primary)
                    .strikethrough(item.isCompleted)
                    .lineLimit(1)

                Spacer()
            }
            .padding(.vertical, 6)
        }
    }
}
