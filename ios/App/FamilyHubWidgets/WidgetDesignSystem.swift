import SwiftUI
import WidgetKit

// MARK: - Family Hub Widget Design System
// Matches the web app's teal/warm theme

struct WidgetColors {
    // Primary - Teal (matches tailwind teal-500, teal-600)
    static let teal = Color(red: 0.08, green: 0.72, blue: 0.65)      // #14b8a6
    static let tealDark = Color(red: 0.05, green: 0.58, blue: 0.53)  // #0d9488
    static let tealLight = Color(red: 0.37, green: 0.92, blue: 0.83) // #5eead4

    // Accent - Coral/Orange (matches tailwind coral-500)
    static let coral = Color(red: 0.98, green: 0.45, blue: 0.09)     // #f97316
    static let coralLight = Color(red: 0.99, green: 0.73, blue: 0.45) // #fdba74

    // Warm backgrounds (matches tailwind warm-50)
    static let warmBackground = Color(red: 1.0, green: 0.99, blue: 0.98) // #fffef9
    static let warmBackgroundDark = Color(red: 0.11, green: 0.11, blue: 0.12) // slate-900

    // Text colors
    static let textPrimary = Color(red: 0.2, green: 0.2, blue: 0.2)   // #333333
    static let textSecondary = Color(red: 0.5, green: 0.5, blue: 0.5) // #808080
    static let textMuted = Color(red: 0.7, green: 0.7, blue: 0.7)     // #b3b3b3

    // Urgency colors (for bins, deadlines, etc.)
    static let urgentRed = Color(red: 0.94, green: 0.27, blue: 0.27)   // #ef4444
    static let warningOrange = Color(red: 0.98, green: 0.45, blue: 0.09) // #f97316
    static let cautionYellow = Color(red: 0.98, green: 0.77, blue: 0.14) // #f9c514
    static let safeGreen = Color(red: 0.13, green: 0.77, blue: 0.37)   // #22c55e

    // F1 specific - keep red for brand recognition
    static let f1Red = Color(red: 0.89, green: 0.0, blue: 0.13)       // #e30022 (F1 brand)
}

struct WidgetFonts {
    // Title fonts - bold, attention grabbing
    static func title(_ size: CGFloat = 17) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }

    // Headline fonts
    static func headline(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }

    // Body fonts
    static func body(_ size: CGFloat = 14) -> Font {
        .system(size: size, weight: .medium)
    }

    // Caption fonts
    static func caption(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .medium)
    }

    // Mono fonts for countdowns
    static func mono(_ size: CGFloat = 14) -> Font {
        .system(size: size, weight: .bold, design: .monospaced)
    }
}

struct WidgetSpacing {
    static let small: CGFloat = 4
    static let medium: CGFloat = 8
    static let large: CGFloat = 12
    static let xlarge: CGFloat = 16
}

// MARK: - Reusable Widget Components

struct WidgetHeader: View {
    let icon: String
    let title: String
    var iconColor: Color = WidgetColors.teal

    var body: some View {
        HStack(spacing: WidgetSpacing.small) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(iconColor)
            Text(title)
                .font(WidgetFonts.caption(12))
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
        }
    }
}

struct WidgetBadge: View {
    let text: String
    var color: Color = WidgetColors.teal
    var textColor: Color = .white
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 4) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
            }
            Text(text)
                .font(WidgetFonts.caption(11))
                .fontWeight(.bold)
        }
        .foregroundColor(textColor)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(color)
        .cornerRadius(8)
    }
}

struct WidgetAccentBar: View {
    var color: Color = WidgetColors.teal
    var width: CGFloat = 3

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: width)
            .cornerRadius(width / 2)
    }
}

// MARK: - Date Helpers

extension Date {
    func countdownString() -> String {
        let now = Date()
        let interval = self.timeIntervalSince(now)

        if interval <= 0 {
            return "Now"
        }

        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60

        if hours >= 48 {
            let days = hours / 24
            return "\(days)d"
        } else if hours >= 24 {
            let days = hours / 24
            let remainingHours = hours % 24
            return "\(days)d \(remainingHours)h"
        } else if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    func countdownStringFull() -> String {
        let now = Date()
        let interval = self.timeIntervalSince(now)

        if interval <= 0 {
            return "Now!"
        }

        let days = Int(interval) / 86400
        let hours = (Int(interval) % 86400) / 3600
        let minutes = (Int(interval) % 3600) / 60

        if days > 0 {
            return "\(days)D \(hours)H \(minutes)M"
        } else if hours > 0 {
            return "\(hours)H \(minutes)M"
        } else {
            return "\(minutes) MIN"
        }
    }
}

// MARK: - Text Helpers

extension String {
    /// Abbreviate common long names for widgets
    func widgetAbbreviated() -> String {
        self.replacingOccurrences(of: "Grand Prix", with: "GP")
            .replacingOccurrences(of: "United States", with: "USA")
            .replacingOccurrences(of: "Great Britain", with: "British")
            .replacingOccurrences(of: "United Arab Emirates", with: "UAE")
            .replacingOccurrences(of: "Saudi Arabia", with: "Saudi")
    }
}
