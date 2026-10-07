import Foundation

struct AppleGearRequestResult: Sendable {
  let reason: String?
  let identified: Bool
  let itemName: String?
  let brand: String?
  let description: String?

  static func failure(_ reason: String) -> Self {
    Self(reason: reason, identified: false, itemName: nil, brand: nil, description: nil)
  }

  var dictionary: [String: Any] {
    if let reason { return ["ok": false, "reason": reason] }
    return ["ok": true, "identified": identified,
            "itemName": itemName as Any? ?? NSNull(),
            "brand": brand as Any? ?? NSNull(), "model": NSNull(),
            "description": description as Any? ?? NSNull()]
  }
}

// All mutable fields are protected by lock. Never hold the lock while cancelling tasks
// or Vision: cancellation handlers may synchronously call back into request state.
final class AppleGearRequestContext: @unchecked Sendable {
  let id: String
  private let lock = NSLock()
  private var cause: String?
  private var stoppedAt: TimeInterval?
  private var finished = false
  private var task: Task<AppleGearRequestResult, Never>?
  private var deadline: Task<Void, Never>?
  private var cancelVision: (() -> Void)?

  init(id: String) { self.id = id }

  func checkCancellation() throws {
    lock.lock()
    let stopped = cause != nil
    lock.unlock()
    if stopped { throw CancellationError() }
    try Task.checkCancellation()
  }

  func attachTask(_ value: Task<AppleGearRequestResult, Never>) {
    lock.lock()
    if !finished { task = value }
    let stopped = cause != nil
    lock.unlock()
    if stopped { value.cancel() }
  }

  func attachDeadline(_ value: Task<Void, Never>) {
    lock.lock()
    if !finished { deadline = value }
    let done = finished
    lock.unlock()
    if done { value.cancel() }
  }

  // Linearizes OCR admission with cancellation. The worker checks again before perform().
  func beginVision(cancel: @escaping () -> Void) -> Bool {
    lock.lock()
    let allowed = cause == nil && !finished
    if allowed { cancelVision = cancel }
    lock.unlock()
    return allowed
  }

  func endVision() {
    lock.lock()
    cancelVision = nil
    lock.unlock()
  }

  func stop(reason: String) {
    lock.lock()
    guard !finished, cause == nil else { lock.unlock(); return }
    cause = reason
    stoppedAt = ProcessInfo.processInfo.systemUptime
    let currentTask = task
    let vision = cancelVision
    lock.unlock()
    #if DEBUG
    print("APPLE GEAR REQUEST:", id, reason, "visionCancellationRequested:", vision != nil)
    #endif
    currentTask?.cancel()
    vision?()
  }

  // Called only after the entire operation, including synchronous Vision, has returned.
  func finish(_ result: AppleGearRequestResult) -> AppleGearRequestResult {
    lock.lock()
    finished = true
    let final = cause.map(AppleGearRequestResult.failure) ?? result
    let timer = deadline
    let elapsed = stoppedAt.map { Int((ProcessInfo.processInfo.systemUptime - $0) * 1000) }
    deadline = nil
    task = nil
    cancelVision = nil
    lock.unlock()
    timer?.cancel()
    #if DEBUG
    print("APPLE GEAR REQUEST:", id, "settled:", final.reason ?? "success",
          "cancellationToSettlementMs:", elapsed.map(String.init) ?? "n/a")
    #endif
    return final
  }
}

// One active chain, not a job scheduler. Synchronous registration/cancellation is lock-isolated;
// the Expo async bridge may deliver cancel before recognize even when JS calls recognize first.
final class AppleGearRequestCoordinator: @unchecked Sendable {
  private let lock = NSLock()
  private var active: AppleGearRequestContext?
  private var knownIDs = Set<String>()
  private var pendingCancellation = Set<String>()
  private var closed = false
  private var cancellationHistoryFull = false
  private let historyLimit: Int
  private let sleepUntilDeadline: @Sendable (UInt64) async throws -> Void

  init(historyLimit: Int = 4096,
       sleepUntilDeadline: @escaping @Sendable (UInt64) async throws -> Void = {
         try await Task.sleep(nanoseconds: $0)
       }) {
    self.historyLimit = historyLimit
    self.sleepUntilDeadline = sleepUntilDeadline
  }

  private func register(_ id: String) -> (AppleGearRequestContext?, String?) {
    lock.lock()
    defer { lock.unlock() }
    guard !closed else { return (nil, "cancelled") }
    if active?.id == id { return (nil, "duplicate_request_id") }
    if pendingCancellation.remove(id) != nil { return (nil, "cancelled") }
    if knownIDs.contains(id) { return (nil, "request_id_reused") }
    // Fail closed rather than evict an early cancellation or permit ID reuse.
    // This bounded per-module history resets on app/runtime restart.
    guard !cancellationHistoryFull, knownIDs.count < historyLimit else {
      return (nil, "request_history_full")
    }
    guard active == nil else { return (nil, "recognition_busy") }
    let context = AppleGearRequestContext(id: id)
    knownIDs.insert(id)
    active = context
    return (context, nil)
  }

  func cancel(_ id: String) {
    guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, id.count <= 128 else { return }
    lock.lock()
    let context = active?.id == id ? active : nil
    if context == nil && !knownIDs.contains(id) && !closed {
      if knownIDs.count < historyLimit {
        knownIDs.insert(id)
        pendingCancellation.insert(id)
      } else {
        cancellationHistoryFull = true
      }
    }
    lock.unlock()
    context?.stop(reason: "cancelled")
  }

  func shutdown() {
    lock.lock()
    closed = true
    let context = active
    pendingCancellation.removeAll()
    lock.unlock()
    context?.stop(reason: "cancelled")
  }

  private func remove(_ context: AppleGearRequestContext) {
    lock.lock()
    defer { lock.unlock() }
    if active === context { active = nil }
  }

  var activeCount: Int {
    lock.lock()
    defer { lock.unlock() }
    return active == nil ? 0 : 1
  }

  func run(id: String,
           operation: @escaping @Sendable (AppleGearRequestContext) async -> AppleGearRequestResult)
    async -> AppleGearRequestResult {
    guard !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, id.count <= 128 else {
      return .failure("invalid_request_id")
    }
    let (registered, error) = register(id)
    guard let context = registered else { return .failure(error ?? "recognition_failed") }
    defer { remove(context) }
    #if DEBUG
    print("APPLE GEAR REQUEST:", id, "registered")
    #endif
    let timer = Task { [sleepUntilDeadline] in
      do {
        try await sleepUntilDeadline(10_000_000_000)
        try Task.checkCancellation()
        context.stop(reason: "timeout")
      } catch { /* Normal completion cancels the deadline task. */ }
    }
    context.attachDeadline(timer)
    let worker = Task {
      let result: AppleGearRequestResult
      do {
        try context.checkCancellation()
        result = await operation(context)
      } catch {
        result = .failure("cancelled")
      }
      return context.finish(result)
    }
    context.attachTask(worker)
    return await withTaskCancellationHandler {
      // Never race this await against a timer or resume it while OCR may still read the image.
      await worker.value
    } onCancel: {
      context.stop(reason: "cancelled")
    }
  }
}
