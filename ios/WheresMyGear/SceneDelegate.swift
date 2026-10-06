import UIKit
import React

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // A retained single scene reconnects to the existing root, never a new one.
    if let existingWindow = appDelegate.window {
      window = existingWindow
      existingWindow.windowScene = windowScene
      existingWindow.makeKeyAndVisible()
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
      for activity in connectionOptions.userActivities {
        self.scene(scene, continue: activity)
      }
      return
    }

    var launchOptions = appDelegate.initialLaunchOptions ?? [:]
    if let context = connectionOptions.urlContexts.first {
      launchOptions[.url] = context.url
      launchOptions[.sourceApplication] = context.options.sourceApplication
      launchOptions[.annotation] = context.options.annotation
    }
    if let activity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }) ?? connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity
      ]
    }

    let sceneWindow = UIWindow(windowScene: windowScene)
    window = sceneWindow
    appDelegate.window = sceneWindow
    // Cold URLs go through factory launch options (including Dev Client) and
    // Linking.getInitialURL, not a second, potentially premature JS URL event.
    factory.startReactNative(withModuleName: "main", in: sceneWindow, launchOptions: launchOptions)
    appDelegate.initialLaunchOptions = nil

    // Non-web activities are not interpreted by RN's initial URL reader.
    for activity in connectionOptions.userActivities where activity.activityType != NSUserActivityTypeBrowsingWeb {
      self.scene(scene, continue: activity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    guard let appDelegate else { return }
    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace
      ]
      options[.sourceApplication] = context.options.sourceApplication
      options[.annotation] = context.options.annotation
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func scene(_ scene: UIScene, willContinueUserActivityWithType userActivityType: String) {
    _ = appDelegate?.application(UIApplication.shared, willContinueUserActivityWithType: userActivityType)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
