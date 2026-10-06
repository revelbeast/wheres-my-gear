Pod::Spec.new do |s|
  s.name = 'AppleGearRecognizer'
  s.version = '0.1.0'
  s.summary = 'Local WMG Apple model availability bridge'
  s.description = 'Reports on-device image and guided-generation availability.'
  s.author = 'Where\'s My Gear'
  s.license = { :type => 'Proprietary' }
  s.homepage = 'https://wheresmygear.app'
  s.source = { :git => 'https://wheresmygear.app' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
