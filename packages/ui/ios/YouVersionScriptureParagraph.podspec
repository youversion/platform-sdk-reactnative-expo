Pod::Spec.new do |s|
  s.name           = 'YouVersionScriptureParagraph'
  s.version        = '1.0.0'
  s.summary        = 'Native hanging-indent scripture paragraph (ADR 0011)'
  s.description    = 'Renders serialized scripture runs with NSParagraphStyle hanging indent.'
  s.author         = 'YouVersion'
  s.homepage       = 'https://developers.youversion.com'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
