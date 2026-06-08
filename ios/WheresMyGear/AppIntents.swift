import AppIntents
import UIKit

@available(iOS 16.0, *)
struct AddGearItemIntent: AppIntent {
  static var title: LocalizedStringResource = "Add Gear Item"
  static var description = IntentDescription("Open Where's My Gear to add a new gear item.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://add-item")
    return .result()
  }
}

@available(iOS 16.0, *)
struct SearchGearIntent: AppIntent {
  static var title: LocalizedStringResource = "Search Gear"
  static var description = IntentDescription("Open Where's My Gear to search your inventory.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://search")
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenChecklistIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Checklist"
  static var description = IntentDescription("Open Where's My Gear checklists.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://checklist")
    return .result()
  }
}

@available(iOS 16.0, *)
struct StartTripPrepIntent: AppIntent {
  static var title: LocalizedStringResource = "Start Trip Prep"
  static var description = IntentDescription("Open Where's My Gear to prepare for an upcoming trip.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://trip-prep")
    return .result()
  }
}


@available(iOS 16.0, *)
struct WheresMyGearShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddGearItemIntent(),
      phrases: [
        "Add gear in \(.applicationName)",
        "Add gear item in \(.applicationName)"
      ],
      shortTitle: "Add Gear",
      systemImageName: "plus.circle"
    )

    AppShortcut(
      intent: SearchGearIntent(),
      phrases: [
        "Search gear in \(.applicationName)",
        "Find gear in \(.applicationName)"
      ],
      shortTitle: "Search Gear",
      systemImageName: "magnifyingglass"
    )

    AppShortcut(
      intent: OpenChecklistIntent(),
      phrases: [
        "Open checklist in \(.applicationName)",
        "Show checklist in \(.applicationName)"
      ],
      shortTitle: "Open Checklist",
      systemImageName: "checklist"
    )

    AppShortcut(
      intent: StartTripPrepIntent(),
      phrases: [
        "Start trip prep in \(.applicationName)",
        "Prepare for a trip in \(.applicationName)"
      ],
      shortTitle: "Trip Prep",
      systemImageName: "backpack"
    )
  }
}

@MainActor
private func openDeepLink(_ urlString: String) {
  guard let url = URL(string: urlString) else {
    return
  }

  UIApplication.shared.open(url)
}
