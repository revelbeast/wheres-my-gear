import AppIntents
import UIKit


struct SiriGearCache: Decodable {
  let items: [SiriGearCacheItem]
}

struct SiriGearCacheItem: Decodable {
  let id: String
  let name: String
  let compartmentName: String
  let vehicleName: String
}

@available(iOS 16.0, *)
struct GearItemEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Gear Item")
  static var defaultQuery = GearItemQuery()

  let id: String
  let name: String
  let compartmentName: String
  let vehicleName: String

  var displayRepresentation: DisplayRepresentation {
    let location = [compartmentName, vehicleName]
      .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
      .joined(separator: " • ")

    return DisplayRepresentation(
      title: "\(name)",
      subtitle: location.isEmpty ? nil : "\(location)"
    )
  }
}

@available(iOS 16.0, *)
struct GearItemQuery: EntityStringQuery {
  func entities(for identifiers: [GearItemEntity.ID]) async throws -> [GearItemEntity] {
    let allItems = loadSiriGearItems()
    return allItems.filter { identifiers.contains($0.id) }
  }

  func entities(matching string: String) async throws -> [GearItemEntity] {
    let normalizedSearch = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

    guard !normalizedSearch.isEmpty else {
      return Array(loadSiriGearItems().prefix(20))
    }

    return loadSiriGearItems()
      .filter { item in
        item.name.lowercased().contains(normalizedSearch) ||
        item.compartmentName.lowercased().contains(normalizedSearch) ||
        item.vehicleName.lowercased().contains(normalizedSearch)
      }
      .prefix(20)
      .map { $0 }
  }

  func suggestedEntities() async throws -> [GearItemEntity] {
    Array(loadSiriGearItems().prefix(20))
  }

  private func loadSiriGearItems() -> [GearItemEntity] {
    guard let documentsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
      return []
    }

    let cacheUrl = documentsUrl.appendingPathComponent("wmg-siri-gear-cache.json")

    guard
      let data = try? Data(contentsOf: cacheUrl),
      let cache = try? JSONDecoder().decode(SiriGearCache.self, from: data)
    else {
      return []
    }

    return cache.items.map {
      GearItemEntity(
        id: $0.id,
        name: $0.name,
        compartmentName: $0.compartmentName,
        vehicleName: $0.vehicleName
      )
    }
  }
}


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

  @Parameter(title: "Gear Item")
  var gearItem: GearItemEntity

  @MainActor
  func perform() async throws -> some IntentResult {
    let encodedGearName = gearItem.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? gearItem.name
    openDeepLink("wheres-my-gear://search?query=\(encodedGearName)")
    return .result()
  }
}


@available(iOS 16.0, *)
struct CheckGearItemIntent: AppIntent {
  static var title: LocalizedStringResource = "Check Gear Item"
  static var description = IntentDescription("Ask Where's My Gear if you already have a gear item.")
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Item Name")
  var itemName: String

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let searchTerm = itemName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

    guard !searchTerm.isEmpty else {
      return .result(dialog: "Tell me the gear item you want to check.")
    }

    let matches = loadSiriGearCacheItems().filter { item in
      item.name.lowercased().contains(searchTerm)
    }

    guard !matches.isEmpty else {
      return .result(dialog: "I couldn't find \(itemName) in Where's My Gear.")
    }

    if matches.count == 1, let item = matches.first {
      let location = [item.compartmentName, item.vehicleName]
        .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        .joined(separator: ", ")

      if location.isEmpty {
        return .result(dialog: "Yes, you already have \(item.name) in Where's My Gear.")
      }

      return .result(dialog: "Yes, you already have \(item.name). It is in \(location).")
    }

    let names = matches.prefix(3).map { $0.name }.joined(separator: ", ")
    return .result(dialog: "Yes, I found \(matches.count) matching items in Where's My Gear: \(names).")
  }

  private func loadSiriGearCacheItems() -> [SiriGearCacheItem] {
    guard let documentsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
      return []
    }

    let cacheUrl = documentsUrl.appendingPathComponent("wmg-siri-gear-cache.json")

    guard
      let data = try? Data(contentsOf: cacheUrl),
      let cache = try? JSONDecoder().decode(SiriGearCache.self, from: data)
    else {
      return []
    }

    return cache.items
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
      intent: FindGearIntent(),
      phrases: [
        "Find \(\.$gearItem) in \(.applicationName)",
        "Where is \(\.$gearItem) in \(.applicationName)",
        "Where's \(\.$gearItem) in \(.applicationName)"
      ],
      shortTitle: "Find Gear",
      systemImageName: "magnifyingglass.circle"
    )


    AppShortcut(
      intent: CheckGearItemIntent(),
      phrases: [
        "Do I already have \(\.$itemName) in \(.applicationName)",
        "Do I have \(\.$itemName) in \(.applicationName)",
        "Check if I have \(\.$itemName) in \(.applicationName)",
        "Do I own \(\.$itemName) in \(.applicationName)"
      ],
      shortTitle: "Check Gear",
      systemImageName: "questionmark.circle"
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
