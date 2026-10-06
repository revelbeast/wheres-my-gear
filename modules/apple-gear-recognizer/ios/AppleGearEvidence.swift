import Foundation

enum AppleGearEvidence {
  struct Observation {
    let text: String
    let confidence: Float
  }

  // Experimental starting threshold; OCR confidence does not prove brand identity.
  static let minimumBrandOCRConfidence: Float = 0.90

  static func normalized(_ value: String) -> String {
    value.precomposedStringWithCanonicalMapping
      .components(separatedBy: .whitespacesAndNewlines)
      .filter { !$0.isEmpty }
      .joined(separator: " ")
      .lowercased(with: Locale(identifier: "en_US_POSIX"))
      .precomposedStringWithCanonicalMapping
  }

  static func acceptedBrand(_ proposed: String?, observations: [Observation]?) -> String? {
    guard let proposed, !normalized(proposed).isEmpty else { return nil }
    let expected = normalized(proposed)
    guard observations?.contains(where: {
      $0.confidence.isFinite && $0.confidence >= minimumBrandOCRConfidence &&
      $0.confidence <= 1 && normalized($0.text) == expected
    }) == true else { return nil }
    return proposed.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  // nil observations denotes OCR failure; both failure and no evidence suppress risky fields.
  static func result(identified: Bool, itemName: String?, proposedBrand: String?,
                     description: String?, observations: [Observation]?) -> [String: Any] {
    [
      "ok": true, "identified": identified,
      "itemName": itemName as Any? ?? NSNull(),
      "brand": acceptedBrand(proposedBrand, observations: observations) as Any? ?? NSNull(),
      "model": NSNull(),
      "description": description as Any? ?? NSNull()
    ]
  }
}
