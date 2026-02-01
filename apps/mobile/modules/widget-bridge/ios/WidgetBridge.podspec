Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '0.0.1'
  s.summary        = 'Bridge for writing widget data to shared storage'
  s.description    = 'Expo module for writing to UserDefaults/SharedPreferences and reloading widgets'
  s.author         = ''
  s.homepage       = 'https://github.com/example'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
