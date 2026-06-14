import AppIntents
import UIKit


@available(iOS 16.0, *)
struct OpenDashboardIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Dashboard"
  static var description = IntentDescription("Open the Where's My Gear dashboard.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://dashboard")
    return .result()
  }
}

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
struct FindGearIntent: AppIntent {
  static var title: LocalizedStringResource = "Find Gear"
  static var description = IntentDescription("Search for a gear item in Where's My Gear.")
  static var openAppWhenRun: Bool = true

  @Parameter(title: "Gear Name")
  var gearName: String

  @MainActor
  func perform() async throws -> some IntentResult {
    let encodedGearName = gearName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? gearName
    openDeepLink("wheres-my-gear://search?query=\(encodedGearName)")
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenScannerIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Scanner"
  static var description = IntentDescription("Open the Where's My Gear QR and barcode scanner.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://scanner")
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenGearAssistantIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Gear Assistant"
  static var description = IntentDescription("Open Gear Assistant in Where's My Gear.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://gear-assistant")
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenChecklistsIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Checklists"
  static var description = IntentDescription("Open Where's My Gear checklists.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    openDeepLink("wheres-my-gear://checklist")
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenTripsIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Trips"
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
      intent: OpenDashboardIntent(),
      phrases: [
        "Open dashboard in \(.applicationName)",
        "Show dashboard in \(.applicationName)",
        "Open the dashboard in \(.applicationName)"
      ],
      shortTitle: "Open Dashboard",
      systemImageName: "square.grid.2x2"
    )

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
      intent: OpenScannerIntent(),
      phrases: [
        "Open scanner in \(.applicationName)",
        "Scan gear in \(.applicationName)",
        "Open QR scanner in \(.applicationName)",
        "Open barcode scanner in \(.applicationName)"
      ],
      shortTitle: "Open Scanner",
      systemImageName: "qrcode.viewfinder"
    )

    AppShortcut(
      intent: OpenGearAssistantIntent(),
      phrases: [
        "Open Gear Assistant in \(.applicationName)",
        "Start Gear Assistant in \(.applicationName)",
        "Add gear with \(.applicationName)"
      ],
      shortTitle: "Gear Assistant",
      systemImageName: "mic.circle"
    )

    AppShortcut(
      intent: OpenChecklistsIntent(),
      phrases: [
        "Open checklists in \(.applicationName)",
        "Open checklist in \(.applicationName)",
        "Show checklists in \(.applicationName)",
        "Show checklist in \(.applicationName)"
      ],
      shortTitle: "Open Checklists",
      systemImageName: "checklist"
    )

    AppShortcut(
      intent: OpenTripsIntent(),
      phrases: [
        "Open trips in \(.applicationName)",
        "Show trips in \(.applicationName)"
      ],
      shortTitle: "Open Trips",
      systemImageName: "calendar"
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
