import WidgetKit
import SwiftUI

@main
struct FamilyHubWidgetsBundle: WidgetBundle {
    var body: some Widget {
        ShoppingListWidget()
        TodaysEventsWidget()
        RoutineStatusWidget()
        NextEventWidget()
        F1CountdownWidget()
        BinDayWidget()
        QuickActionsWidget()
    }
}
