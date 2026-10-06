import ExpoModulesCore
import FoundationModels

public final class AppleGearRecognizerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleGearRecognizer")

    AsyncFunction("getAvailability") { () -> [String: Any] in
      guard #available(iOS 27.0, *) else {
        return ["available": false, "vision": false, "guidedGeneration": false,
                "reason": "ios_27_required"]
      }
      return self.modelAvailability()
    }
  }

  @available(iOS 27.0, *)
  private func modelAvailability() -> [String: Any] {
    let model = SystemLanguageModel.default
    let vision = model.capabilities.contains(.vision)
    let guidedGeneration = model.capabilities.contains(.guidedGeneration)
    var result: [String: Any] = [
      "available": false, "vision": vision, "guidedGeneration": guidedGeneration
    ]

    switch model.availability {
    case .available:
      if !vision {
        result["reason"] = "vision_unavailable"
      } else if !guidedGeneration {
        result["reason"] = "guided_generation_unavailable"
      } else {
        result["available"] = true
      }
    case .unavailable(let reason):
      switch reason {
      case .deviceNotEligible: result["reason"] = "device_not_eligible"
      case .appleIntelligenceNotEnabled: result["reason"] = "apple_intelligence_not_enabled"
      case .modelNotReady: result["reason"] = "model_not_ready"
      @unknown default: result["reason"] = "model_unavailable"
      }
    }
    return result
  }
}
